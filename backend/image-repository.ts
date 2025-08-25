import { log } from "./log";
import childProcessAsync from "promisify-child-process";

export class ImageRepository {

    private imagesWithUpdate: Set<string> = new Set();
    private stacksWithUpdate: Set<string> = new Set();

    resetStack(stack: string) {
        this.stacksWithUpdate.delete(stack);
    }

    resetImage(image: string) {
        this.imagesWithUpdate.delete(image);
    }

    async update(stack: string, image: string) {
        this.imagesWithUpdate.delete(image);

        // local
        const resLocal = await childProcessAsync.spawn("docker", [ "inspect", "--format", "{{index .RepoDigests 0}}", image ], {
            encoding: "utf-8",
        });

        let localDigest = "";
        if (resLocal.stdout) {
            const resStr = resLocal.stdout?.toString();
            localDigest = resStr.substring(resStr.indexOf("@") + 1).trim();
        }

        // remote
        const resRemote = await childProcessAsync.spawn("skopeo", [ "inspect", "--no-tags", "--format", "{{ .Digest }}", "docker://" + image ], {
            encoding: "utf-8",
        });

        let remoteDigest = "";
        if (resRemote.stdout) {
            remoteDigest = resRemote.stdout?.toString().trim();
        }

        if (localDigest != "" && remoteDigest != "" && localDigest != remoteDigest) {

            log.debug("ImageRepository", "Update available - stack: " + stack + " image: " + image + " localDigest: '" + localDigest + "' remteDigest: '" + remoteDigest + "'");

            this.imagesWithUpdate.add(image);
            this.stacksWithUpdate.add(stack);
        }
    }

    isStackUpdateAvailable(stack: string) : boolean {
        return this.stacksWithUpdate.has(stack);
    }

    isImageUpdateAvailable(image: string) : boolean {
        return this.imagesWithUpdate.has(image);
    }
}
