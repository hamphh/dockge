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

        if (imageInfo.localDigests.length > 0 && !image.startsWith("sha256:")) {
            const resRemote = await childProcessAsync.spawn("skopeo", [ "inspect", "--no-tags", "--format", "{{ .Digest }}", "docker://" + image ], {
                encoding: "utf-8",
            });

            let remoteDigest = "";
            if (resRemote.stdout) {
                remoteDigest = resRemote.stdout?.toString().trim();
            }

            imageInfo = new ImageInfo(remoteDigest, imageInfo.localDigests, imageInfo.localId);
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
        let localDigests: string[] = [];
        if (resLocal.stdout) {
            const localInspect = JSON.parse(resLocal.stdout!.toString());
            if (Array.isArray(localInspect) && localInspect[0]) {
                localId = localInspect[0].Id;

                const localRepoDigests = localInspect[0].RepoDigests;
                if (Array.isArray(localRepoDigests)) {
                    // An image can accumulate several digest references for the same tag
                    // (e.g. an upstream re-push that changes only the index digest) and can
                    // also carry digests of other repositories. Keep every digest belonging
                    // to the referenced repository instead of blindly using entry [0].
                    const repo = ImageRepository.imageRepo(image);
                    let repoDigests = localRepoDigests.filter((repoDigest: string) => repoDigest.startsWith(repo + "@"));
                    if (repoDigests.length === 0) {
                        // Repository name normalization may differ (e.g. "docker.io/" prefix
                        // in the compose file vs. short name in RepoDigests) - fall back to
                        // all entries rather than reporting no local digest at all.
                        repoDigests = localRepoDigests;
                    }
                    localDigests = repoDigests
                        .map((repoDigest: string) => repoDigest.substring(repoDigest.indexOf("@") + 1))
                        .filter((digest: string) => !!digest);
                }
            }
        }

        if (!(localDigests.length > 0 && !!localId)) {
            log.warn("updateLocal", "Image '" + image + "': Local id '" + localId + "' digests '" + localDigests.join(", ") + "'");
        }

        imageInfo = new ImageInfo(imageInfo.remoteDigest, localDigests, localId);
        this.updateInfo(stack, service, image, imageInfo);

        return imageInfo;
    }

    getImageInfo(stack: string, service: string, image: string) : ImageInfo {
        return this.imageInfos.get(stack)?.get(this.imageKey(service, image)) ?? new ImageInfo("", [], "");
    }

    /**
     * Strips the tag or digest from an image reference, leaving the repository
     * part as it appears in RepoDigests entries.
     */
    static imageRepo(image: string): string {
        const indexOfAt = image.indexOf("@");
        if (indexOfAt > 0) {
            return image.substring(0, indexOfAt);
        }
        const indexOfColon = image.lastIndexOf(":");
        if (indexOfColon > image.lastIndexOf("/")) {
            return image.substring(0, indexOfColon);
        }
        return image;
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
        public readonly localDigests: string[],
        public readonly localId: string
    ) {}

    isImageUpdateAvailable() {
        return this.localDigests.length > 0 && !!this.remoteDigest && !this.localDigests.includes(this.remoteDigest);
    }
}
