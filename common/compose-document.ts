/* eslint-disable @typescript-eslint/no-explicit-any */
import { Document, Pair, parseDocument, Scalar } from "yaml";
import dotenv, { DotenvParseOutput } from "dotenv";
import { LooseObject } from "./util-common";
// @ts-ignore
import { replaceVariablesSync } from "@inventage/envsubst";

function convertToBoolean(value: any, fallbackVal: boolean | undefined = undefined): boolean | undefined {
    if (value === true || value === "true") {
        return true;
    }

    if (value === false || value === "false") {
        return false;
    }

    return fallbackVal;
}

export type ComposeData = {
    data: any,
    envsubstData: any
}

export const X_DOCKGE = "x-dockge";

export class ComposeDocument {

    public readonly composeData: ComposeData;
    protected doc: Document;

    constructor(composeYAML?: string, composeENV?: string) {
        if (composeYAML) {
            const mainDoc = this.parseYAML(composeYAML);
            const envsubstData = composeENV ? this.parseYAML(envsubstYAML(composeYAML, dotenv.parse(composeENV))).data : mainDoc.data;

            this.doc = mainDoc.doc;
            this.composeData = {
                data: mainDoc.data,
                envsubstData
            };
        } else {
            this.composeData = {
                data: {},
                envsubstData: {}
            };
            this.doc = new Document();
        }
    }

    private parseYAML(yaml: string) {
        const doc = parseDocument(yaml);
        if (doc.errors.length > 0) {
            throw doc.errors[0];
        }

        const data = doc.toJS() ?? {};

        // "services" must be an object
        if (!data.services) {
            data.services = {};
        }
        if (Array.isArray(data.services) || typeof data.services !== "object") {
            throw new Error("Services must be an object");
        }

        return {
            data,
            doc
        };
    }

    get networks(): ComposeNetworks {
        return new ComposeNetworks(this.composeData);
    }

    get services(): ComposeServices {
        return new ComposeServices(this.composeData);
    }

    get xDockge(): ComposeDockge {
        return new ComposeDockge(this.composeData);
    }

    toYAML(): string {
        const doc = new Document(this.composeData.data);

        // Stick back the yaml comments
        copyYAMLComments(doc, this.doc);

        return doc.toString();
    }
}

export abstract class ComposeNode {
    public readonly composeData: ComposeData;

    protected valid = true;

    constructor(public name: string, protected baseComposeData: ComposeData, protected parentNode?: ComposeNode) {
        this.composeData = {
            data: this.check(baseComposeData.data[name]),
            envsubstData: this.check(baseComposeData.envsubstData[name])
        };
    }

    private check(data: any) {
        if (data) {
            if (this.checkType(data)) {
                return data;
            } else {
                this.valid = false;
                return this.createData();
            }
        } else {
            return this.createData();
        }
    }

    protected abstract checkType(data: any): boolean;

    protected abstract createData(): any;

    abstract isEmpty(): boolean;

    isValid(): boolean {
        return this.valid;
    }

    get exists() {
        return this.name in this.baseComposeData.data;
    }

    replace(data: any) {
        if (this.checkType(data)) {
            this.prepareWrite();
            this.composeData.data = data;
            this.baseComposeData.data[this.name] = data;
        } else {
            throw new Error("Invalid type '" + (typeof data) + "' for '" + this.constructor.name + "'");
        }
    }

    prepareWrite() {
        if (this.parentNode) {
            this.parentNode.prepareWrite();
        }

        let nodeData = this.baseComposeData.data[this.name];
        if (!nodeData) {
            this.baseComposeData.data[this.name] = this.composeData.data;
        }
    }

    removeIfEmpty() {
        if (this.isEmpty() && this.exists) {
            delete this.baseComposeData.data[this.name];
        }
    }
}

export class ComposeMap extends ComposeNode {

    constructor(public name: string, protected baseComposeData: ComposeData, protected parentNode?: ComposeNode) {
        super(name, baseComposeData, parentNode);
    }

    protected checkType(data: any): boolean {
        return typeof data === "object";
    }

    protected createData(): any {
        return {};
    }

    isEmpty(): boolean {
        return this.names.length === 0;
    }

    get names() {
        return Object.keys(this.composeData.data);
    }

    entries<T = any>(mapFct: (key: any) => T = (key => this.get(key))): Record<string, T> {
        return this.names.reduce<Record<string, T>>(
            (acc, name) => {
                acc[name] = mapFct(name);
                return acc;
            },
            {} as Record<string, T>
        );
    }

    has(name: string) {
        return !!this.composeData.data[name];
    }

    get(name: string, defaultVal: any = undefined, envsubst: boolean = false): any {
        const val = envsubst ? this.composeData.envsubstData[name] : this.composeData.data[name];
        return val !== undefined ? val : defaultVal;
    }

    getComposeArray(name: string) {
        return new ComposeArray(name, this.composeData, this);
    }

    getComposeMap(name: string) {
        return new ComposeMap(name, this.composeData, this);
    }

    set(name: string, value: any) {
        this.prepareWrite();
        this.composeData.data[name] = value;
    }

    delete(name: string) {
        if (name in this.composeData.data) {
            delete this.composeData.data[name];
        }
    }
}

export class ComposeArray extends ComposeNode {
    constructor(public name: string, protected baseComposeData: ComposeData, protected parentNode?: ComposeNode) {
        super(name, baseComposeData, parentNode);
    }

    protected checkType(data: any): boolean {
        return Array.isArray(data);
    }

    protected createData(): any {
        return [];
    }

    isEmpty(): boolean {
        return this.composeData.data.length === 0;
    }

    containsObjects(): boolean {
        for (const item of this.values) {
            if (typeof item === "object") {
                return true;
            }
        }
        return false;
    }

    get values(): any[] {
        return this.composeData.envsubstData;
    }

    set values(values: any[]) {
        this.replace(values);
    }

    add(value: any) {
        this.prepareWrite();
        this.composeData.data.push(value);
    }

    delete(index: number) {
        this.prepareWrite();
        this.composeData.data.splice(index, 1);
    }
}

export class ComposeNetworks extends ComposeMap {

    constructor(protected baseComposeData: ComposeData) {
        super("networks", baseComposeData);
    }

    getNetwork(name: string): ComposeNetwork {
        return new ComposeNetwork(name, this);
    }

    getNetworks(): Record<string, ComposeNetwork> {
        return this.entries((name: string) => this.getNetwork(name));
    }
}

export class ComposeNetwork extends ComposeMap {

    constructor(public name: string, protected networks: ComposeNetworks) {
        super(name, networks.composeData, networks);
    }

    get external(): boolean {
        return convertToBoolean(this.composeData.data.external, false) as boolean;
    }

    set external(set: boolean) {
        this.prepareWrite();
        if (set) {
            this.composeData.data.external = true;
        } else {
            delete this.composeData.data.external;
        }
    }
}

export class ComposeServices extends ComposeMap {

    constructor(protected baseComposeData: ComposeData) {
        super("services", baseComposeData);
    }

    getService(name: string): ComposeService {
        return new ComposeService(name, this);
    }

    getServices(): Record<string, ComposeService> {
        return this.entries((name: string) => this.getService(name));
    }
}

export class ComposeService extends ComposeMap {

    constructor(public name: string, protected services: ComposeServices) {
        super(name, services.composeData, services);
    }

    get networks() : ComposeArray {
        return this.getComposeArray("networks");
    }

    get ports(): ComposeArray {
        return this.getComposeArray("ports");
    }

    get volumes(): ComposeArray {
        return this.getComposeArray("volumes");
    }

    get environment(): ComposeArray {
        return this.getComposeArray("environment");
    }

    get dependsOn(): ComposeArray {
        return this.getComposeArray("depends_on");
    }

    get image(): string {
        return this.composeData.envsubstData.image;
    }

    set image(image: string) {
        this.set("image", image);
    }

    get imageName(): string {
        if (this.image) {
            return this.image.split(":")[0];
        } else {
            return "";
        }
    }

    get imageTag(): string {
        if (this.image) {
            let tag = this.image.split(":")[1];
            return tag ? tag : "latest";
        } else {
            return "";
        }
    }

    get containerName(): string {
        return this.get("container_name");
    }

    set containerName(name: string) {
        this.set("container_name", name);
    }

    get restart(): string {
        return this.get("restart", "");
    }

    set restart(value: string) {
        this.set("restart", value);
    }

    get labels(): ComposeLabels {
        return new ComposeLabels(this.composeData, this);
    }
}

export class ComposeDockge extends ComposeMap {

    constructor(protected baseComposeData: ComposeData) {
        super(X_DOCKGE, baseComposeData);
    }

    get urls(): ComposeArray {
        return this.getComposeArray("urls");
    }
}

export class ComposeLabels extends ComposeNode {

    constructor(protected baseComposeData: ComposeData, protected parentNode?: ComposeNode) {
        super("labels", baseComposeData, parentNode);
    }

    protected checkType(data: any): boolean {
        // Labels could be defined as array or map
        return typeof data === "object" || Array.isArray(data);
    }

    protected createData() {
        // default is map style
        return {};
    }

    isEmpty(): boolean {
        if (this.isArray) {
            return this.composeData.data.length === 0;
        } else {
            return Object.keys(this.composeData.data).length === 0;
        }
    }

    get isArray() {
        return Array.isArray(this.composeData.data);
    }

    getLabels(envsubst = false): Record<string, any> {
        const data = envsubst ? this.composeData.envsubstData : this.composeData.data;
        if (this.isArray) {
            return (data as string[]).reduce(
                (acc, label) => {
                    const indexOfValue = label.indexOf("=");
                    const key = indexOfValue > 0 ? label.substring(0, indexOfValue) : label;
                    const value = indexOfValue > 0 ? label.substring(indexOfValue + 1) : "";

                    acc[key] = value;
                    return acc;
                },
                {} as Record<string, string>
            );
        } else {
            return data;
        }
    }

    setLabels(labels: Record<string, any>) {
        this.prepareWrite();
        if (this.isArray) {
            this.replace(Object.entries(labels).map(([ key, value ]) => `${key}=${value ? value : ""}`));
        } else {
            this.replace(labels);
        }
    }

    get(key: string, defaultVal: any = undefined, envsubst = false) {
        const value = this.getLabels(envsubst)[key];
        return value ? value : defaultVal;
    }

    set(key: string, value: string) {
        const labels = this.getLabels();
        labels[key] = value;
        this.setLabels(labels);
    }

    delete(key: string) {
        const labels = this.getLabels();
        if (key in labels) {
            delete labels[key];
            this.setLabels(labels);
        }
    }

    isFalse(key: string, envsubst = false) {
        return convertToBoolean(this.getLabels(envsubst)[key]) === false;
    }

    isTrue(key: string, envsubst = false) {
        return convertToBoolean(this.getLabels(envsubst)[key]) === true;
    }

    isSet(key: string, envsubst = false) {
        return key in this.getLabels(envsubst);
    }
}

function envsubst(string : string, variables : LooseObject) : string {
    return replaceVariablesSync(string, variables)[0];
}

/**
 * Traverse all values in the yaml and for each value, if there are template variables, replace it environment variables
 * Emulates the behavior of how docker-compose handles environment variables in yaml files
 * @param content Yaml string
 * @param env Environment variables
 * @returns string Yaml string with environment variables replaced
 */
function envsubstYAML(content : string, env : DotenvParseOutput) : string {
    const doc = parseDocument(content);
    if (doc.contents) {
        // @ts-ignore
        for (const item of doc.contents.items) {
            traverseYAML(item, env);
        }
    }
    return doc.toString();
}

/**
 * Used for envsubstYAML(...)
 * @param pair
 * @param env
 */
function traverseYAML(pair : Pair, env : DotenvParseOutput) : void {
    // @ts-ignore
    if (pair.value && pair.value.items) {
        // @ts-ignore
        for (const item of pair.value.items) {
            if (item instanceof Pair) {
                traverseYAML(item, env);
            } else if (item instanceof Scalar) {
                let value = item.value as unknown;

                if (typeof(value) === "string") {
                    item.value = envsubst(value, env);
                }
            }
        }
    // @ts-ignore
    } else if (pair.value && typeof(pair.value.value) === "string") {
        // @ts-ignore
        pair.value.value = envsubst(pair.value.value, env);
    }
}

function copyYAMLComments(doc : Document, src : Document) {
    doc.comment = src.comment;
    doc.commentBefore = src.commentBefore;

    if (doc && doc.contents && src && src.contents) {
        // @ts-ignore
        copyYAMLCommentsItems(doc.contents.items, src.contents.items);
    }
}

/**
 * Copy yaml comments from srcItems to items
 * Attempts to preserve comments by matching content rather than just array indices
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function copyYAMLCommentsItems(items: any, srcItems: any) {
    if (!items || !srcItems) {
        return;
    }

    // First pass - try to match items by their content
    for (let i = 0; i < items.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item: any = items[i];

        // Try to find matching source item by content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const srcIndex = srcItems.findIndex((srcItem: any) =>
            JSON.stringify(srcItem.value) === JSON.stringify(item.value) &&
            JSON.stringify(srcItem.key) === JSON.stringify(item.key)
        );

        if (srcIndex !== -1) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const srcItem: any = srcItems[srcIndex];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nextSrcItem: any = srcItems[srcIndex + 1];

            if (item.key && srcItem.key) {
                item.key.comment = srcItem.key.comment;
                item.key.commentBefore = srcItem.key.commentBefore;
            }

            if (srcItem.comment) {
                item.comment = srcItem.comment;
            }

            // Handle comments between array items
            if (nextSrcItem && nextSrcItem.commentBefore) {
                if (items[i + 1]) {
                    items[i + 1].commentBefore = nextSrcItem.commentBefore;
                }
            }

            // Handle trailing comments after array items
            if (srcItem.value && srcItem.value.comment) {
                if (item.value) {
                    item.value.comment = srcItem.value.comment;
                }
            }

            if (item.value && srcItem.value) {
                if (typeof item.value === "object" && typeof srcItem.value === "object") {
                    item.value.comment = srcItem.value.comment;
                    item.value.commentBefore = srcItem.value.commentBefore;

                    if (item.value.items && srcItem.value.items) {
                        copyYAMLCommentsItems(item.value.items, srcItem.value.items);
                    }
                }
            }
        }
    }
}
