import { DockgeServer } from "./dockge-server";
import fs, { promises as fsAsync } from "fs";
import { log } from "./log";
import yaml from "yaml";
import { DockgeSocket, fileExists, ValidationError } from "./util-server";
import path from "path";
import {
    acceptedComposeFileNames,
    COMBINED_TERMINAL_COLS,
    COMBINED_TERMINAL_ROWS,
    CREATED_FILE,
    CREATED_STACK,
    EXITED, getCombinedTerminalName,
    getComposeTerminalName, getContainerTerminalName,
    getContainerLogName,
    RUNNING, RUNNING_AND_EXITED, UNHEALTHY,
    TERMINAL_ROWS, UNKNOWN
} from "../common/util-common";
import { InteractiveTerminal, Terminal } from "./terminal";
import childProcessAsync from "promisify-child-process";
import { Settings } from "./settings";
import { ImageRepository } from "./image-repository";

export class Stack {

    name: string;
    protected _status: number = UNKNOWN;
    protected _composeYAML?: string;
    protected _composeENV?: string;
    protected _configFilePath?: string;
    protected _composeFileName: string = "compose.yaml";
    protected _unhealthy: boolean = false;
    protected _serviceProperties: Map<string, object> = new Map<string, object>();
    protected server: DockgeServer;

    protected combinedTerminal? : Terminal;

    protected static managedStackList: Map<string, Stack> = new Map();

    protected static imageRepository : ImageRepository = new ImageRepository();

    constructor(server : DockgeServer, name : string, composeYAML? : string, composeENV? : string) {
        this.name = name;
        this.server = server;
        this._composeYAML = composeYAML;
        this._composeENV = composeENV;

        // Check if compose file name is different from compose.yaml
        for (const filename of acceptedComposeFileNames) {
            if (fs.existsSync(path.join(this.path, filename))) {
                this._composeFileName = filename;
                break;
            }
        }
    }

    async toJSON(endpoint : string) : Promise<object> {

        // Since we have multiple agents now, embed primary hostname in the stack object too.
        let primaryHostname = await Settings.get("primaryHostname");
        if (!primaryHostname) {
            if (!endpoint) {
                primaryHostname = "localhost";
            } else {
                // Use the endpoint as the primary hostname
                try {
                    primaryHostname = (new URL("https://" + endpoint).hostname);
                } catch (e) {
                    // Just in case if the endpoint is in a incorrect format
                    primaryHostname = "localhost";
                }
            }
        }

        let obj = this.toSimpleJSON(endpoint);
        return {
            ...obj,
            composeYAML: this.composeYAML,
            composeENV: this.composeENV,
            primaryHostname,
            serviceProperties: Object.fromEntries(this._serviceProperties),
        };
    }

    toSimpleJSON(endpoint : string) : object {
        return {
            name: this.name,
            status: this._status,
            started: this.isStarted,
            imageUpdatesAvailable: Stack.imageRepository.isStackUpdateAvailable(this.name),
            tags: [],
            isManagedByDockge: this.isManagedByDockge,
            composeFileName: this._composeFileName,
            endpoint,
        };
    }

    get isManagedByDockge() : boolean {
        return fs.existsSync(this.path) && fs.statSync(this.path).isDirectory();
    }

    get status() : number {
        return this._status;
    }

    get isStarted(): boolean {
        return this._status == RUNNING || this._status == RUNNING_AND_EXITED || this._status == UNHEALTHY;
    }

    validate() {
        // Check name, allows [a-z][0-9] _ - only
        if (!this.name.match(/^[a-z0-9_-]+$/)) {
            throw new ValidationError("Stack name can only contain [a-z][0-9] _ - only");
        }

        // Check YAML format
        yaml.parse(this.composeYAML);

        let lines = this.composeENV.split("\n");

        // Check if the .env is able to pass docker-compose
        // Prevent "setenv: The parameter is incorrect"
        // It only happens when there is one line and it doesn't contain "="
        if (lines.length === 1 && !lines[0].includes("=") && lines[0].length > 0) {
            throw new ValidationError("Invalid .env format");
        }
    }

    get composeYAML() : string {
        if (this._composeYAML === undefined) {
            try {
                this._composeYAML = fs.readFileSync(path.join(this.path, this._composeFileName), "utf-8");
            } catch (e) {
                this._composeYAML = "";
            }
        }
        return this._composeYAML;
    }

    get composeENV() : string {
        if (this._composeENV === undefined) {
            try {
                this._composeENV = fs.readFileSync(path.join(this.path, ".env"), "utf-8");
            } catch (e) {
                this._composeENV = "";
            }
        }
        return this._composeENV;
    }

    get path() : string {
        return path.join(this.server.stacksDir, this.name);
    }

    get fullPath() : string {
        let dir = this.path;

        // Compose up via node-pty
        let fullPathDir;

        // if dir is relative, make it absolute
        if (!path.isAbsolute(dir)) {
            fullPathDir = path.join(process.cwd(), dir);
        } else {
            fullPathDir = dir;
        }
        return fullPathDir;
    }

    /**
     * Save the stack to the disk
     * @param isAdd
     */
    async save(isAdd : boolean) {
        this.validate();

        let dir = this.path;

        // Check if the name is used if isAdd
        if (isAdd) {
            if (await fileExists(dir)) {
                throw new ValidationError("Stack name already exists");
            }

            // Create the stack folder
            await fsAsync.mkdir(dir);
        } else {
            if (!await fileExists(dir)) {
                throw new ValidationError("Stack not found");
            }
        }

        // Write or overwrite the compose.yaml
        await fsAsync.writeFile(path.join(dir, this._composeFileName), this.composeYAML);

        const envPath = path.join(dir, ".env");

        // Write or overwrite the .env
        // If .env is not existing and the composeENV is empty, we don't need to write it
        if (await fileExists(envPath) || this.composeENV.trim() !== "") {
            await fsAsync.writeFile(envPath, this.composeENV);
        }
    }

    async deploy(socket : DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", "--remove-orphans" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to deploy, please check the terminal output for more information.");
        }

        // Update image infos
        this.updateImageInfos();

        return exitCode;
    }

    async delete(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "down", "--remove-orphans" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to delete, please check the terminal output for more information.");
        }

        // Remove the stack folder
        await fsAsync.rm(this.path, {
            recursive: true,
            force: true
        });

        return exitCode;
    }

    async updateData(includeStats: boolean = false) {
        const serviceProperties = new Map<string, object>();
        this._unhealthy = false;

        try {
            const serviceStats = new Map<string, object>();
            if (includeStats) {
                const statsRes = await childProcessAsync.spawn("docker", [ "compose", "stats", "--no-stream", "--format", "json" ], {
                    cwd: this.path,
                    encoding: "utf-8",
                });

                if (statsRes.stdout) {
                    const statsLines = statsRes.stdout?.toString().split("\n");

                    for (let statsLine of statsLines) {
                        if (statsLine != "") {
                            const stats = JSON.parse(statsLine);
                            serviceStats.set(stats.Name, stats);
                        }
                    }
                }
            }

            const res = await childProcessAsync.spawn("docker", [ "compose", "ps", "--all", "--format", "json" ], {
                cwd: this.path,
                encoding: "utf-8",
            });

            if (!res.stdout) {
                return;
            }

            const lines = res.stdout?.toString().split("\n");

            let runningCount = 0;
            let exitedCount = 0;

            for (let line of lines) {
                if (line != "") {
                    const serviceInfo = JSON.parse(line);
                    serviceProperties.set(serviceInfo.Service, {
                        ...serviceInfo,
                        ImageUpdateAvailable: Stack.imageRepository.isImageUpdateAvailable(serviceInfo.Image),
                        Stats: serviceStats.get(serviceInfo.Name)
                    });

                    if (serviceInfo.State === "running") {
                        runningCount++;
                    } else if (serviceInfo.State == "exited") {
                        exitedCount++;
                    } else {
                        log.warn("updateStackData", "Unexpected service state '" + serviceInfo.State + "'");
                    }

                    if (serviceInfo.Health === "unhealthy") {
                        this._unhealthy = true;
                    }
                }
            }

            if (runningCount > 0 && exitedCount > 0) {
                this._status = RUNNING_AND_EXITED;
            } else if (runningCount > 0) {
                this._status = RUNNING;
            } else if (exitedCount > 0) {
                this._status = EXITED;
            } else {
                this._status = UNKNOWN;
            }

            if (this._unhealthy) {
                this._status = UNHEALTHY;
            }

            this._serviceProperties = serviceProperties;
        } catch (e) {
            log.error("updateStackData", e);
        }
    }

    async updateImageInfos() {
        const serviceInfos = this._serviceProperties as Map<string, {Image: string, Service: string}>;

        Stack.imageRepository.resetStack(this.name);
        for (const serviceInfo of serviceInfos.values()) {
            try {
                await Stack.imageRepository.update(this.name, serviceInfo.Image);
            } catch (e) {
                log.error("updateImageInfos", "Image '" + serviceInfo.Image + "': " + e);
            }
        }
    }

    /**
     * Checks if a compose file exists in the specified directory.
     * @async
     * @static
     * @param {string} stacksDir - The directory of the stack.
     * @param {string} filename - The name of the directory to check for the compose file.
     * @returns {Promise<boolean>} A promise that resolves to a boolean indicating whether any compose file exists.
     */
    static async composeFileExists(stacksDir : string, filename : string) : Promise<boolean> {
        let filenamePath = path.join(stacksDir, filename);
        // Check if any compose file exists
        for (const filename of acceptedComposeFileNames) {
            let composeFile = path.join(filenamePath, filename);
            if (await fileExists(composeFile)) {
                return true;
            }
        }
        return false;
    }

    static async getStackList(server : DockgeServer, useCacheForManaged = false) : Promise<Map<string, Stack>> {
        let stacksDir = server.stacksDir;
        let stackList : Map<string, Stack>;

        // Use cached stack list?
        if (useCacheForManaged && this.managedStackList.size > 0) {
            stackList = this.managedStackList;
        } else {
            stackList = new Map<string, Stack>();

            // Scan the stacks directory, and get the stack list
            let filenameList = await fsAsync.readdir(stacksDir);

            for (let filename of filenameList) {
                try {
                    // Check if it is a directory
                    let stat = await fsAsync.stat(path.join(stacksDir, filename));
                    if (!stat.isDirectory()) {
                        continue;
                    }
                    // If no compose file exists, skip it
                    if (!await Stack.composeFileExists(stacksDir, filename)) {
                        continue;
                    }
                    let stack = await this.getStack(server, filename, false);
                    stack._status = CREATED_FILE;
                    stackList.set(filename, stack);
                } catch (e) {
                    if (e instanceof Error) {
                        log.warn("getStackList", `Failed to get stack ${filename}, error: ${e.message}`);
                    }
                }
            }

            // Cache by copying
            this.managedStackList = new Map(stackList);
        }

        // Get status from docker compose ls
        let res = await childProcessAsync.spawn("docker", [ "compose", "ls", "--all", "--format", "json" ], {
            encoding: "utf-8",
        });

        if (!res.stdout) {
            return stackList;
        }

        let composeList = JSON.parse(res.stdout.toString());
        log.debug("getStackList", "Updating status.");

        for (let composeStack of composeList) {
            let stack = stackList.get(composeStack.Name);

            // This stack probably is not managed by Dockge, but we still want to show it
            if (!stack) {
                // Skip the dockge stack if it is not managed by Dockge
                if (composeStack.Name === "dockge") {
                    continue;
                }
                stack = new Stack(server, composeStack.Name);
                stackList.set(composeStack.Name, stack);
            }

            stack._configFilePath = composeStack.ConfigFiles;

            if (composeStack.Status.startsWith("created")) {
                stack._status = CREATED_STACK;
            } else if (composeStack.Status.includes("exited") && composeStack.Status.includes("running")) {
                stack._status = RUNNING_AND_EXITED;
            } else if (composeStack.Status.includes("exited")) {
                stack._status = EXITED;
            } else if (composeStack.Status.startsWith("running")) {
                stack._status = RUNNING;
            } else {
                stack._status = UNKNOWN;
            }

            if (stack._unhealthy) {
                stack._status = UNHEALTHY;
            }
        }

        return stackList;
    }

    static async getStack(server: DockgeServer, stackName: string, useCache = true) : Promise<Stack> {
        let dir = path.join(server.stacksDir, stackName);

        if (useCache) {
            const cachedStack = this.managedStackList.get(stackName);
            if (cachedStack) {
                return cachedStack;
            }
        }

        if (!await fileExists(dir) || !(await fsAsync.stat(dir)).isDirectory()) {
            // Maybe it is a stack managed by docker compose directly
            let stackList = await this.getStackList(server, true);
            let stack = stackList.get(stackName);

            if (stack) {
                return stack;
            } else {
                // Really not found
                throw new ValidationError("Stack not found");
            }
        }

        let stack : Stack;

        stack = new Stack(server, stackName);
        stack._configFilePath = path.resolve(dir);

        await stack.updateData();

        return stack;
    }

    async start(socket: DockgeSocket) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", "--remove-orphans" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to start, please check the terminal output for more information.");
        }

        // Update image infos
        this.updateImageInfos();

        return exitCode;
    }

    async stop(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "stop" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to stop, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async restart(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "restart" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }

        // Update image infos
        this.updateImageInfos();

        return exitCode;
    }

    async stopService(socket: DockgeSocket, service: string): Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "stop", service ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to stop service, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async startService(socket: DockgeSocket, service: string): Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "start", service ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to start service, please check the terminal output for more information.");
        }

        // Update image infos
        this.updateImageInfos();

        return exitCode;
    }

    async restartService(socket: DockgeSocket, service: string): Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "restart", service ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart service, please check the terminal output for more information.");
        }

        // Update image infos
        this.updateImageInfos();

        return exitCode;
    }

    async down(socket: DockgeSocket) : Promise<number> {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "down" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to down, please check the terminal output for more information.");
        }
        return exitCode;
    }

    async update(socket: DockgeSocket) {
        const terminalName = getComposeTerminalName(socket.endpoint, this.name);
        let exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "pull" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to pull, please check the terminal output for more information.");
        }

        // If the stack is not running, we don't need to restart it
        await this.updateData();
        log.debug("update", "Status: " + this.status);
        if (!this.isStarted) {
            return exitCode;
        }

        exitCode = await Terminal.exec(this.server, socket, terminalName, "docker", [ "compose", "up", "-d", "--remove-orphans" ], this.path);
        if (exitCode !== 0) {
            throw new Error("Failed to restart, please check the terminal output for more information.");
        }

        // Update image infos
        this.updateImageInfos();

        return exitCode;
    }

    async joinCombinedTerminal(socket: DockgeSocket) {
        const terminalName = getCombinedTerminalName(socket.endpoint, this.name);
        const terminal = Terminal.getOrCreateTerminal(this.server, terminalName, "docker", [ "compose", "logs", "-f", "--tail", "100" ], this.path);
        terminal.enableKeepAlive = true;
        terminal.rows = COMBINED_TERMINAL_ROWS;
        terminal.cols = COMBINED_TERMINAL_COLS;
        terminal.join(socket);
        terminal.start();
    }

    async joinContainerTerminal(socket: DockgeSocket, serviceName: string, shell : string = "sh", index: number = 0) {
        const terminalName = getContainerTerminalName(socket.endpoint, this.name, serviceName, shell, index);
        let terminal = Terminal.getTerminal(terminalName);

        if (!terminal) {
            terminal = new InteractiveTerminal(this.server, terminalName, "docker", [ "compose", "exec", serviceName, shell ], this.path);
            terminal.enableKeepAlive = true;
            terminal.rows = TERMINAL_ROWS;
            log.debug("joinContainerTerminal", "Terminal created");
        }

        terminal.join(socket);
        terminal.start();
    }

    async joinContainerLog(socket: DockgeSocket, serviceName: string, index: number = 0) {
        const terminalName = getContainerLogName(socket.endpoint, this.name, serviceName, index);
        let terminal = Terminal.getTerminal(terminalName);

        if (!terminal) {
            terminal = new Terminal(this.server, terminalName, "docker", [ "compose", "logs", "-f", "--tail", "100", serviceName ], this.path);
            terminal.enableKeepAlive = true;
            terminal.rows = TERMINAL_ROWS;
            log.debug("joinContainerLog", "Terminal created");
        }

        terminal.join(socket);
        terminal.start();
    }
}
