import { log } from "./log";
import childProcessAsync from "promisify-child-process";

export class ImageRepository {

    static INSTANCE = new ImageRepository();

    private imageInfos: Map<string, Map<string, ImageInfo>> = new Map();

    resetStack(stack: string) {
        this.imageInfos.delete(stack);
    }

    async update(stack: string, service: string, image: string): Promise<ImageInfo> {
        let imageInfo = await this.updateLocal(stack, service, image);

        if (!!imageInfo.localDigest && !image.startsWith("sha256:")) {
            const resRemote = await childProcessAsync.spawn("skopeo", [ "inspect", "--no-tags", "--format", "{{ .Digest }}", "docker://" + image ], {
                encoding: "utf-8",
            });

            let remoteDigest = "";
            if (resRemote.stdout) {
                remoteDigest = resRemote.stdout?.toString().trim();
            }

            imageInfo = new ImageInfo(remoteDigest, imageInfo.localDigest, imageInfo.localId);
            this.updateInfo(stack, service, image, imageInfo);
        }

        return imageInfo;
    }

    async updateLocal(stack: string, service: string, image: string): Promise<ImageInfo> {
        let imageInfo = this.getImageInfo(stack, service, image);

        const resLocal = await childProcessAsync.spawn("docker", [ "inspect", "--format", "json", image ], {
            encoding: "utf-8",
        });

        let localId = "";
        let localDigest = "";
        if (resLocal.stdout) {
            const localInspect = JSON.parse(resLocal.stdout!.toString());
            if (Array.isArray(localInspect) && localInspect[0]) {
                localId = localInspect[0].Id;

                const localRepoDigest = localInspect[0].RepoDigests;
                if (Array.isArray(localRepoDigest)) {
                    localDigest = localRepoDigest[0];
                }
                if (!!localDigest) {
                    const indexOfAt = localDigest.indexOf("@");
                    if (indexOfAt > 0) {
                        localDigest = localDigest.substring(indexOfAt + 1);
                    }
                }
            }
        }

        if (!(!!localDigest && !!localId)) {
            log.warn("updateLocal", "Image '" + image + "': Local id '" + localId + "' digest '" + localDigest + "'");
        }

        imageInfo = new ImageInfo(imageInfo.remoteDigest, localDigest, localId);
        this.updateInfo(stack, service, image, imageInfo);

        return imageInfo;
    }

    getImageInfo(stack: string, service: string, image: string) : ImageInfo {
        return this.imageInfos.get(stack)?.get(this.imageKey(service, image)) ?? new ImageInfo("", "", "");
    }

    private updateInfo(stack: string, service: string, image: string, imageInfo: ImageInfo) {
        if (!this.imageInfos.has(stack)) {
            this.imageInfos.set(stack, new Map());
        }

        this.imageInfos.get(stack)!.set(this.imageKey(service, image), imageInfo);
    }

    private imageKey(service: string, image: string): string {
        return `${service}::${image}`;
    }
}

export class ImageInfo {
    constructor(
        public readonly remoteDigest: string,
        public readonly localDigest: string,
        public readonly localId: string
    ) {}

    isImageUpdateAvailable() {
        return !!this.localDigest && !!this.remoteDigest && this.localDigest !== this.remoteDigest;
    }
}
