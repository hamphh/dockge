<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 v-if="isAdd" class="mb-3">{{ $t("compose") }}</h1>
            <h1 v-else class="mb-3">
                <Uptime :stack="stack" :pill="true" /> {{ stack.name }}
                <span v-if="agentCount > 1 && endpoint !== ''" class="agent-name">
                    ({{ endpointDisplay }})
                </span>
            </h1>

            <div v-if="stack.isManagedByDockge" class="mb-3">
                <div class="btn-group me-2" role="group">
                    <button v-if="isEditMode" class="btn btn-primary me-1" :disabled="processing" @click="deployStack">
                        <font-awesome-icon icon="rocket" class="me-1" />
                        {{ $t("deployStack") }}
                    </button>

                    <button v-if="isEditMode" class="btn btn-normal me-1" :disabled="processing" @click="saveStack">
                        <font-awesome-icon icon="save" class="me-1" />
                        {{ $t("saveStackDraft") }}
                    </button>

                    <button v-if="!isEditMode" class="btn btn-secondary me-1" :disabled="processing" @click="enableEditMode">
                        <font-awesome-icon icon="pen" class="me-1" />
                        <span class="d-none d-xl-inline">{{ $t("editStack") }}</span>
                    </button>

                    <button v-if="!isEditMode && (hasExitedServices || !stack.started)" class="btn btn-primary me-1" :disabled="processing" @click="startStack">
                        <font-awesome-icon icon="play" class="me-1" />
                        <span class="d-none d-xl-inline">{{ $t("startStack") }}</span>
                    </button>

                    <button v-if="!isEditMode && hasRunningServices" class="btn btn-normal me-1" :disabled="processing" @click="restartStack">
                        <font-awesome-icon icon="rotate" class="me-1" />
                        <span class="d-none d-xl-inline">{{ $t("restartStack") }}</span>
                    </button>

                    <button v-if="!isEditMode" class="btn me-1" :class="stack.imageUpdatesAvailable ? 'btn-info' : 'btn-normal'" :disabled="processing" @click="updateStack">
                        <font-awesome-icon icon="cloud-arrow-down" class="me-1" />
                        <span class="d-none d-xl-inline">{{ $t("updateStack") }}</span>
                    </button>

                    <button v-if="!isEditMode && hasRunningServices" class="btn btn-normal me-1" :disabled="processing" @click="stopStack">
                        <font-awesome-icon icon="stop" class="me-1" />
                        <span class="d-none d-xl-inline">{{ $t("stopStack") }}</span>
                    </button>

                    <BDropdown menu-class="compose-dropdown-menu" right text="" variant="dark" :disabled="processing">
                        <BDropdownItem link-class="compose-dropdown-item-normal mb-1" @click="downStack">
                            <font-awesome-icon icon="stop" class="me-1" />
                            <span>{{ $t("downStack") }}</span>
                        </BDropdownItem>
                        <BDropdownItem link-class="compose-dropdown-item-danger" @click="showDeleteDialog = !showDeleteDialog">
                            <font-awesome-icon icon="trash" class="me-1" />
                            <span>{{ $t("deleteStack") }}</span>
                        </BDropdownItem>
                    </BDropdown>
                </div>

                <button v-if="isEditMode && !isAdd" class="btn btn-normal" :disabled="processing" @click="discardStack">{{ $t("discardStack") }}</button>
            </div>

            <!-- URLs -->
            <div v-if="urls.length > 0" class="mb-3">
                <a v-for="(url, index) in urls" :key="index" target="_blank" :href="url.url">
                    <span class="badge bg-secondary me-2">{{ url.display }}</span>
                </a>
            </div>

            <!-- Progress Terminal -->
            <div v-if="!isEditMode">
                <div :class="showProgressTerminal ? 'mb-1' : 'mb-3'" @click="showProgressTerminal = !showProgressTerminal">
                    <font-awesome-icon :icon="showProgressTerminal ? 'chevron-circle-down' : 'chevron-circle-right'" class="me-2" />
                    {{ $t("terminal") }}
                </div>
                <transition name="slide-fade" appear>
                    <Terminal
                        v-show="showProgressTerminal"
                        ref="progressTerminal"
                        class="mb-3 terminal"
                        :name="terminalName"
                        :endpoint="endpoint"
                        :rows="progressTerminalRows"
                        @has-data="terminalHasData"
                    ></Terminal>
                </transition>
            </div>

            <div v-if="stack.isManagedByDockge" class="row">
                <div class="col-lg-6">
                    <!-- General -->
                    <div v-if="isAdd">
                        <h4 class="mb-3">{{ $t("general") }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <!-- Stack Name -->
                            <div>
                                <label for="name" class="form-label">{{ $t("stackName") }}</label>
                                <input id="name" v-model="stack.name" type="text" class="form-control" required @blur="stackNameToLowercase">
                                <div class="form-text">{{ $t("Lowercase only") }}</div>
                            </div>

                            <!-- Endpoint -->
                            <div class="mt-3">
                                <label for="name" class="form-label">{{ $t("dockgeAgent") }}</label>
                                <select v-model="stack.endpoint" class="form-select">
                                    <option v-for="(agent, endpoint) in agentList" :key="endpoint" :value="endpoint" :disabled="agentStatusList[endpoint] != 'online'">
                                        ({{ agentStatusList[endpoint] }}) {{ (agent.name !== '') ? agent.name : agent.url || $t("Controller") }}
                                    </option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Containers -->
                    <h4 class="mb-3">{{ $tc("container", 2) }}</h4>

                    <div v-if="isEditMode" class="input-group mb-3">
                        <input
                            v-model="newContainerName"
                            :placeholder="$t(`New Container Name...`)"
                            class="form-control"
                            @keyup.enter="addContainer"
                        />
                        <button class="btn btn-primary" @click="addContainer">
                            {{ $t("addContainer") }}
                        </button>
                    </div>

                    <div ref="containerList">
                        <Container
                            v-for="(service, name) in composeDocument.services.getServices()"
                            :key="name"
                            :name="name"
                            :is-edit-mode="isEditMode"
                            :service="getServiceData(name)"
                            :stats="getServiceStats(name)"
                        />
                    </div>

                    <!-- General -->
                    <div v-if="isEditMode">
                        <h4 class="mb-3">{{ $t("extra") }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <!-- URLs -->
                            <div class="mb-4">
                                <label class="form-label">
                                    {{ $tc("url", 2) }}
                                </label>
                                <ArrayInput :composeArray="composeDocument.xDockge.urls" :display-name="$t('url')" placeholder="https://" />
                            </div>
                        </div>
                    </div>

                    <!-- Combined Terminal Output -->
                    <div v-show="!isEditMode">
                        <h4 class="mb-3">{{ $t("log") }}</h4>
                        <Terminal
                            ref="combinedTerminal"
                            class="mb-3 terminal"
                            :name="combinedTerminalName"
                            :endpoint="endpoint"
                            :rows="combinedTerminalRows"
                            :cols="combinedTerminalCols"
                            style="height: 315px;"
                        ></Terminal>
                    </div>
                </div>
                <div class="col-lg-6">
                    <h4 class="mb-3">{{ stack.composeFileName }}</h4>

                    <!-- YAML editor -->
                    <div class="shadow-box mb-3 editor-box" :class="{'edit-mode' : isEditMode}">
                        <button v-if="isEditMode" v-b-modal.compose-editor-modal class="expand-button yaml-expand-button">
                            <font-awesome-icon icon="expand" />
                        </button>
                        <prism-editor
                            ref="editor"
                            v-model="stack.composeYAML"
                            class="yaml-editor"
                            :highlight="highlighterYAML"
                            line-numbers :readonly="!isEditMode"
                            @input="yamlCodeChange"
                            @focus="editorFocus = true"
                            @blur="editorFocus = false"
                        ></prism-editor>
                    </div>
                    <div v-if="isEditMode" class="mb-3">
                        {{ yamlError }}
                    </div>

                    <!-- YAML modal fullscreen editor -->
                    <BModal id="compose-editor-modal" :title="stack.composeFileName" scrollable size="xl" hide-footer>
                        <div class="shadow-box mb-3 editor-box" :class="{'edit-mode' : isEditMode}">
                            <prism-editor
                                ref="editor"
                                v-model="stack.composeYAML"
                                class="yaml-editor"
                                :highlight="highlighterYAML"
                                line-numbers :readonly="!isEditMode"
                                @input="yamlCodeChange"
                                @focus="editorFocus = true"
                                @blur="editorFocus = false"
                            ></prism-editor>
                        </div>
                        <div v-if="isEditMode" class="mb-3">
                            {{ yamlError }}
                        </div>
                    </BModal>

                    <!-- ENV editor -->
                    <div v-if="isEditMode">
                        <h4 class="mb-3">.env</h4>
                        <div class="shadow-box mb-3 editor-box" :class="{'edit-mode' : isEditMode}">
                            <prism-editor
                                ref="editor"
                                v-model="stack.composeENV"
                                class="env-editor"
                                :highlight="highlighterENV"
                                line-numbers :readonly="!isEditMode"
                                @focus="editorFocus = true"
                                @blur="editorFocus = false"
                            ></prism-editor>
                        </div>
                    </div>

                    <div v-if="isEditMode">
                        <!-- Volumes -->
                        <div v-if="false">
                            <h4 class="mb-3">{{ $tc("volume", 2) }}</h4>
                            <div class="shadow-box big-padding mb-3">
                            </div>
                        </div>

                        <!-- Networks -->
                        <h4 class="mb-3">{{ $tc("network", 2) }}</h4>
                        <div class="shadow-box big-padding mb-3">
                            <NetworkInput />
                        </div>
                    </div>

                    <!-- <div class="shadow-box big-padding mb-3">
                        <div class="mb-3">
                            <label for="name" class="form-label"> Search Templates</label>
                            <input id="name" v-model="name" type="text" class="form-control" placeholder="Search..." required>
                        </div>

                        <prism-editor v-if="false" v-model="yamlConfig" class="yaml-editor" :highlight="highlighter" line-numbers @input="yamlCodeChange"></prism-editor>
                    </div>-->
                </div>
            </div>

            <div v-if="!stack.isManagedByDockge && !processing">
                {{ $t("stackNotManagedByDockgeMsg") }}
            </div>

            <!-- Delete Dialog -->
            <BModal v-model="showDeleteDialog" :cancelTitle="$t('cancel')" :okTitle="$t('deleteStack')" okVariant="danger" @ok="deleteDialog">
                {{ $t("deleteStackMsg") }}
            </BModal>
        </div>
    </transition>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import { highlight, languages } from "prismjs/components/prism-core";
import { PrismEditor } from "vue-prism-editor";
import "prismjs/components/prism-yaml";

import "prismjs/themes/prism-tomorrow.css";
import "vue-prism-editor/dist/prismeditor.min.css";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import {
    COMBINED_TERMINAL_COLS,
    COMBINED_TERMINAL_ROWS,
    getCombinedTerminalName,
    getComposeTerminalName,
    PROGRESS_TERMINAL_ROWS,
    UNKNOWN
} from "../../../common/util-common";
import { StackData } from "../../../common/types";
import { ComposeDocument } from "../../../common/compose-document";
import { BModal } from "bootstrap-vue-next";
import NetworkInput from "../components/NetworkInput.vue";

const template = `
services:
  nginx:
    image: nginx:latest
    restart: unless-stopped
    ports:
      - "8080:80"
`;

const envDefault = "# VARIABLE=value #comment";

let yamlErrorTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
let updateStackDataTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
let updateServiceStatsTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
let autoHideTerminalTimout: ReturnType<typeof setTimeout> | undefined = undefined;

let prismjsSymbolDefinition = {
    "symbol": {
        pattern: /(?<!\$)\$(\{[^{}]*\}|\w+)/,
    }
};

export default defineComponent({
    components: {
        NetworkInput,
        FontAwesomeIcon,
        PrismEditor,
        BModal,
    },
    beforeRouteUpdate(to, from, next) {
        this.exitConfirm(next);
    },
    beforeRouteLeave(to, from, next) {
        this.exitConfirm(next);
    },
    data(this: {composeDocument: ComposeDocument, stack: StackData}) {
        return {
            editorFocus: false,
            composeDocument: new ComposeDocument(),
            yamlError: "",
            processing: true,
            showProgressTerminal: false,
            progressTerminalRows: PROGRESS_TERMINAL_ROWS,
            combinedTerminalRows: COMBINED_TERMINAL_ROWS,
            combinedTerminalCols: COMBINED_TERMINAL_COLS,
            stack: {},
            serviceStats: undefined,
            isEditMode: false,
            submitted: false,
            showDeleteDialog: false,
            newContainerName: "",
            stopUpdateTimeouts: false,
        };
    },
    computed: {

        endpointDisplay(): string {
            return this.$root.endpointDisplayFunction(this.endpoint);
        },

        agentCount(): number {
            return this.$root.agentCount;
        },

        agentList() {
            return this.$root.agentList;
        },

        agentStatusList() {
            return this.$root.agentStatusList;
        },

        urls(this: {composeDocument: ComposeDocument}): {display: string, url: string}[] {
            let urls: {display: string, url: string}[] = [];
            for (const url of this.composeDocument.xDockge.urls.values) {
                let display;
                try {
                    let obj = new URL(url);
                    let pathname = obj.pathname;
                    if (pathname === "/") {
                        pathname = "";
                    }
                    display = obj.host + pathname + obj.search;
                } catch (e) {
                    display = url;
                }

                urls.push({
                    display,
                    url,
                });
            }
            return urls;
        },

        isAdd(): boolean {
            return this.$route.path === "/compose" && !this.submitted;
        },

        terminalName(): string {
            if (!this.stack.name) {
                return "";
            }
            return getComposeTerminalName(this.endpoint, this.stack.name);
        },

        combinedTerminalName(): string {
            if (!this.stack.name) {
                return "";
            }
            return getCombinedTerminalName(this.endpoint, this.stack.name);
        },

        endpoint(): string {
            return this.stack.endpoint || this.$route.params.endpoint || "";
        },

        url(): string {
            if (this.stack.endpoint) {
                return `/compose/${this.stack.name}/${this.stack.endpoint}`;
            } else {
                return `/compose/${this.stack.name}`;
            }
        },

        hasExitedServices(this: {stack: StackData}): boolean {
            return Object.values(this.stack.services).some(service => service.state === "exited");
        },

        hasRunningServices(this: {stack: StackData}): boolean {
            return Object.values(this.stack.services).some(service => service.state === "running");
        }
    },
    watch: {
        "stack.composeYAML": {
            handler() {
                if (this.editorFocus) {
                    console.debug("yaml code changed");
                    this.yamlCodeChange();
                }
            },
            deep: true,
        },

        "stack.composeENV": {
            handler() {
                if (this.editorFocus) {
                    console.debug("env code changed");
                    this.yamlCodeChange();
                }
            },
            deep: true,
        },

        composeDocument: {
            handler() {
                if (!this.editorFocus) {
                    console.debug("composeDocument changed");
                    this.stack.composeYAML = this.composeDocument.toYAML();
                }
            },
            deep: true,
        },

        $route(to, from) {

        }
    },
    mounted() {
        if (this.isAdd) {
            this.processing = false;
            this.isEditMode = true;

            let composeYAML: string;
            let composeENV: string;

            if (this.$root.composeTemplate) {
                composeYAML = this.$root.composeTemplate;
                this.$root.composeTemplate = "";
            } else {
                composeYAML = template;
            }
            if (this.$root.envTemplate) {
                composeENV = this.$root.envTemplate;
                this.$root.envTemplate = "";
            } else {
                composeENV = envDefault;
            }

            this.stack = {
                name: "",
                status: UNKNOWN,
                started: false,
                imageUpdatesAvailable: false,
                tags: [],
                composeYAML: composeYAML,
                composeENV: composeENV,
                isManagedByDockge: true,
                composeFileName: "",
                endpoint: "",
                primaryHostname: "",
                services: {}
            };
            this.yamlCodeChange();
        } else {
            this.stack.name = this.$route.params.stackName;
            this.loadStack();
        }

        this.updateStackData();
        this.startUpdateServiceStatsTimeout();
    },
    unmounted() {

    },
    methods: {
        startUpdateStackDataTimeout() {
            clearTimeout(updateStackDataTimeout);
            updateStackDataTimeout = setTimeout(async () => {
                this.updateStackData();
            }, 5000);
        },

        updateStackData() {
            if (!this.isAdd && !this.isEditMode) {
                this.$root.emitAgent(this.endpoint, "updateStackData", this.stack.name, (res) => {
                    if (res.ok) {
                        this.stack = res.stack;
                    }
                });
            }

            if (!this.stopUpdateTimeouts) {
                this.startUpdateStackDataTimeout();
            }
        },

        startUpdateServiceStatsTimeout() {
            clearTimeout(updateServiceStatsTimeout);
            updateServiceStatsTimeout = setTimeout(async () => {
                this.updateServiceStats();
            }, 2000);
        },

        updateServiceStats() {
            if (!this.isAdd && !this.isEditMode) {
                this.$root.emitAgent(this.endpoint, "updateServiceStats", this.stack.name, (res) => {
                    if (res.ok) {
                        this.serviceStats = res.serviceStats;
                    }
                });
            }

            if (!this.stopUpdateTimeouts) {
                this.startUpdateServiceStatsTimeout();
            }
        },

        getServiceData(serviceName) {
            return this.stack.services[serviceName];
        },

        getServiceStats(serviceName) {
            return this.serviceStats?.[this.getServiceData(serviceName)?.containerName];
        },

        exitConfirm(next) {
            if (this.isEditMode) {
                if (confirm(this.$t("confirmLeaveStack"))) {
                    this.exitAction();
                    next();
                } else {
                    next(false);
                }
            } else {
                this.exitAction();
                next();
            }
        },

        exitAction() {
            console.log("exitAction");
            this.stopUpdateTimeouts = true;
            clearTimeout(updateStackDataTimeout);
        },

        bindTerminal() {
            this.$refs.progressTerminal?.bind(this.endpoint, this.terminalName);
        },

        terminalHasData() {
            this.showProgressTerminal = true;
            this.submitted = true;
            this.startTerminalAutoHideTimeout();
        },

        startTerminalAutoHideTimeout() {
            clearTimeout(autoHideTerminalTimout);
            autoHideTerminalTimout = setTimeout(async () => {
                if (!this.processing) {
                    this.showProgressTerminal = false;
                } else {
                    this.startTerminalAutoHideTimeout();
                }
            }, 10000);
        },

        loadStack() {
            this.processing = true;
            this.$root.emitAgent(this.endpoint, "getStack", this.stack.name, (res) => {
                if (res.ok) {
                    this.stack = res.stack;
                    this.yamlCodeChange();
                    this.processing = false;
                    this.bindTerminal();
                } else {
                    this.$root.toastRes(res);
                }
            });
        },

        deployStack() {
            this.processing = true;

            if (this.composeDocument.services.isEmpty()) {
                this.$root.toastError("No services found in compose.yaml");
                this.processing = false;
                return;
            }

            let serviceNames = this.composeDocument.services.names;

            // Set the stack name if empty, use the first container name
            if (!this.stack.name && serviceNames.length > 0) {
                const serviceName = serviceNames[0];
                const service = this.composeDocument.services.getService(serviceName);

                this.stack.name = service.get("container_name", serviceName);
            }

            this.bindTerminal();

            this.$root.emitAgent(this.stack.endpoint, "deployStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.isEditMode = false;
                    this.$router.push(this.url);
                }
            });
        },

        saveStack() {
            this.processing = true;

            this.$root.emitAgent(this.stack.endpoint, "saveStack", this.stack.name, this.stack.composeYAML, this.stack.composeENV, this.isAdd, (res) => {
                this.processing = false;
                this.$root.toastRes(res);

                if (res.ok) {
                    this.isEditMode = false;
                    this.$router.push(this.url);
                }
            });
        },

        startStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "startStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        stopStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "stopStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        downStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "downStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        restartStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "restartStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        updateStack() {
            this.processing = true;

            this.$root.emitAgent(this.endpoint, "updateStack", this.stack.name, (res) => {
                this.processing = false;
                this.$root.toastRes(res);
            });
        },

        deleteDialog() {
            this.$root.emitAgent(this.endpoint, "deleteStack", this.stack.name, (res) => {
                this.$root.toastRes(res);
                if (res.ok) {
                    this.$router.push("/");
                }
            });
        },

        discardStack() {
            this.loadStack();
            this.isEditMode = false;
        },

        highlighterYAML(code) {
            if (!languages.yaml_with_symbols) {
                languages.yaml_with_symbols = languages.insertBefore("yaml", "punctuation", {
                    "symbol": prismjsSymbolDefinition["symbol"]
                });
            }
            return highlight(code, languages.yaml_with_symbols);
        },

        highlighterENV(code) {
            if (!languages.docker_env) {
                languages.docker_env = {
                    "comment": {
                        pattern: /(^#| #).*$/m,
                        greedy: true
                    },
                    "keyword": {
                        pattern: /^\w*(?=[:=])/m,
                        greedy: true
                    },
                    "value": {
                        pattern: /(?<=[:=]).*?((?= #)|$)/m,
                        greedy: true,
                        inside: {
                            "string": [
                                {
                                    pattern: /^ *'.*?(?<!\\)'/m,
                                },
                                {
                                    pattern: /^ *".*?(?<!\\)"|^.*$/m,
                                    inside: prismjsSymbolDefinition
                                },
                            ],
                        },
                    },
                };
            }
            return highlight(code, languages.docker_env);
        },

        yamlCodeChange() {
            try {
                this.composeDocument = new ComposeDocument(this.stack.composeYAML, this.stack.composeENV);

                clearTimeout(yamlErrorTimeout);
                this.yamlError = "";
            } catch (e) {
                console.log("ymlError", e);

                clearTimeout(yamlErrorTimeout);

                if (this.yamlError) {
                    this.yamlError = e.message;

                } else {
                    yamlErrorTimeout = setTimeout(() => {
                        this.yamlError = e.message;
                    }, 3000);
                }
            }
        },

        enableEditMode() {
            this.isEditMode = true;
        },

        checkYAML() {

        },

        addContainer() {
            this.checkYAML();

            if (this.composeDocument.services.has(this.newContainerName)) {
                this.$root.toastError("Container name already exists");
                return;
            }

            if (!this.newContainerName) {
                this.$root.toastError("Container name cannot be empty");
                return;
            }

            this.composeDocument.services.set(
                this.newContainerName,
                { restart: "unless-stopped" }
            );

            this.newContainerName = "";
            let element = this.$refs.containerList.lastElementChild;
            element.scrollIntoView({
                block: "start",
                behavior: "smooth"
            });
        },

        stackNameToLowercase() {
            this.stack.name = this.stack?.name?.toLowerCase();
        },

    }
});
</script>

<style scoped lang="scss">
@import "../styles/vars.scss";

.terminal {
    height: 200px;
}

.editor-box {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    &.edit-mode {
        background-color: #2c2f38 !important;
    }
    position: relative;
}

.expand-button {
    all: unset;
    cursor: pointer;
}

.expand-button svg {
    width:20px;
    height: 20px;
}

.expand-button:hover {
    color: white;
}

.yaml-expand-button {
    position: absolute;
    right: 15px;
    top: 15px;
    z-index: 10;
}

.agent-name {
    font-size: 13px;
    color: $dark-font-color3;
}

:deep(.compose-dropdown-menu) {
    --bs-dropdown-bg: #{$dark-bg};
    --bs-dropdown-padding-x: 0.5rem;
}

:deep(.compose-dropdown-item-normal) {
    $bg-color: $dark-header-bg;
    $fg-color: $dark-font-color4;

    background-color: $bg-color;
    color: $fg-color;

    &:hover {
        background-color: lighten($bg-color, 8%);
        color: $fg-color;
    }
}

:deep(.compose-dropdown-item-danger) {
    $bg-color: $danger;
    $fg-color: white;

    background-color: $bg-color;
    color: $fg-color;

    &:hover {
        background-color: darken($bg-color, 8%);
        color: $fg-color;
    }
}

</style>
