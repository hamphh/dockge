<template>
    <div class="shadow-box big-padding mb-3 container">
        <div class="row">
            <div class="col-12 col-xxl-7">
                <h4>{{ name }}</h4>
            </div>
            <div class="col-12 col-xxl-5 mb-2 d-flex justify-content-xxl-end align-items-start">
                <button
                    v-if="!isEditMode && service.recreateNecessary"
                    class="btn btn-sm btn-info me-2"
                    :disabled="isProcessing"
                    @click="recreateService"
                >
                    <font-awesome-icon icon="rocket" />
                </button>

                <button
                    v-if="!isEditMode && service.imageUpdateAvailable"
                    v-b-modal="updateModalId"
                    class="btn btn-sm btn-info me-2"
                    :disabled="isProcessing"
                >
                    <font-awesome-icon icon="arrow-up" />
                </button>

                <!-- Image update modal -->
                <BModal :id="updateModalId" :ref="updateModalId" :title="$tc('imageUpdate', 1)" hide-footer>
                    <div class="shadow-box mb-3">
                        <div>
                            <h5>{{ $t("image") }}</h5>
                            <span>{{ composeService.image }}</span>
                        </div>
                        <div v-if="changelogLink" class="mt-3">
                            <h5>{{ $t("changelog") }}</h5>
                            <a :href="changelogLink" target="_blank">{{ changelogLink }}</a>
                        </div>
                        <div class="d-flex justify-content-end mt-4">
                            <button class="btn btn-normal me-4" @click="skipCurrentUpdate">
                                <font-awesome-icon icon="ban" class="me-1" />
                                <span class="d-none d-xl-inline">{{ $t("ignoreUpdate") }}</span>
                            </button>
                            <button class="btn btn-primary" @click="updateService">
                                <font-awesome-icon icon="cloud-arrow-down" class="me-1" />
                                <span class="d-none d-xl-inline">{{ $t("updateStack") }}</span>
                            </button>
                        </div>
                    </div>
                </BModal>

                <div v-if="!isEditMode" class="btn-group me-2" role="group">
                    <router-link v-if="started" class="btn btn-sm btn-normal me-1" :to="logRouteLink" :disabled="isProcessing"><font-awesome-icon icon="file-text" /></router-link>
                    <router-link v-if="started" class="btn btn-sm btn-normal me-1" :to="inspectRouteLink" :disabled="isProcessing"><font-awesome-icon icon="info-circle" /></router-link>
                    <router-link v-if="started" class="btn btn-sm btn-normal me-1" :to="terminalRouteLink" :disabled="isProcessing"><font-awesome-icon icon="terminal" /></router-link>
                </div>

                <div v-if="!isEditMode" class="btn-group" role="group">
                    <button v-if="!started" type="button" class="btn btn-sm btn-success" :disabled="isProcessing" @click="startService"><font-awesome-icon icon="play" /></button>
                    <button v-if="started" type="button" class="btn btn-sm btn-danger me-1" :disabled="isProcessing" @click="stopService"><font-awesome-icon icon="stop" /></button>
                    <button v-if="started" type="button" class="btn btn-sm btn-warning" :disabled="isProcessing" @click="restartService"><font-awesome-icon icon="rotate" /></button>
                </div>
            </div>
        </div>
        <div v-if="!isEditMode" class="row">
            <div v-if="service.recreateNecessary" class="notification mb-2">{{ $t("recreateNecessary") }}</div>
            <div class="d-flex flex-wrap justify-content-between gap-3 mb-2">
                <div class="image">
                    <span class="me-1">{{ composeService.imageName }}:</span><span class="tag">{{ composeService.imageTag }}</span>
                </div>
                <div v-if="started" class="status">
                    {{ service.status }}
                </div>
            </div>
        </div>

        <div v-if="!isEditMode" class="row">
            <div class="col">
                <span class="badge me-1" :class="bgStyle">{{ status }}</span>

                <a v-for="port in composeService.get('ports', [], true)" :key="port" :href="parsePort(port).url" target="_blank">
                    <span v-if="started" class="badge me-1 bg-secondary">{{ parsePort(port).display }}</span>
                </a>
            </div>
        </div>
        <div v-if="!isEditMode && stats" class="mt-2">
            <div class="d-flex align-items-start gap-3">
                <span class="stats-select" @click="expandedStats = !expandedStats">
                    <font-awesome-icon :icon="expandedStats ? 'chevron-circle-down' : 'chevron-circle-right'" />
                </span>
                <template v-if="!expandedStats">
                    <div class="stats">
                        {{ $t('CPU') }}: {{ stats.cpuPerc }}
                    </div>
                    <div class="stats">
                        {{ $t('memoryAbbreviated') }}: {{ stats.memUsage }}
                    </div>
                </template>
            </div>
            <transition name="slide-fade" appear>
                <div v-if="expandedStats" class="d-flex flex-column gap-3 mt-2">
                    <DockerStats :stats="stats" />
                </div>
            </transition>
        </div>

        <div v-if="isEditMode" class="mt-2">
            <button class="btn btn-normal me-2" @click="showConfig = !showConfig">
                <font-awesome-icon icon="edit" />
                {{ $t("Edit") }}
            </button>
            <button v-if="false" class="btn btn-normal me-2">Rename</button>
            <button class="btn btn-danger me-2" @click="remove">
                <font-awesome-icon icon="trash" />
                {{ $t("deleteContainer") }}
            </button>
        </div>

        <transition name="slide-fade" appear>
            <div v-if="isEditMode && showConfig" class="config mt-3">
                <!-- Image -->
                <div class="mb-4">
                    <h5>{{ $t("dockerImage") }}</h5>
                    <div class="input-group mt-3 mb-3">
                        <input
                            v-model="composeService.image"
                            class="form-control"
                            list="image-datalist"
                        />
                    </div>

                    <!-- TODO: Search online: https://hub.docker.com/api/content/v1/products/search?q=louislam%2Fuptime&source=community&page=1&page_size=4 -->
                    <datalist id="image-datalist">
                        <option value="louislam/uptime-kuma:1" />
                    </datalist>
                    <div class="form-text"></div>
                </div>

                <!-- Ports -->
                <div class="mb-4">
                    <h5>{{ $tc("port", 2) }}</h5>
                    <ArrayInput :composeArray="composeService.ports" :display-name="$t('port')" placeholder="HOST:CONTAINER" />
                </div>

                <!-- Volumes -->
                <div class="mb-4">
                    <h5>{{ $tc("volume", 2) }}</h5>
                    <ArrayInput :composeArray="composeService.volumes" :display-name="$t('volume')" placeholder="HOST:CONTAINER" />
                </div>

                <!-- Restart Policy -->
                <div class="mb-4">
                    <h5>{{ $t("restartPolicy") }}</h5>
                    <select v-model="composeService.restart" class="form-select mt-3">
                        <option value="always">{{ $t("restartPolicyAlways") }}</option>
                        <option value="unless-stopped">{{ $t("restartPolicyUnlessStopped") }}</option>
                        <option value="on-failure">{{ $t("restartPolicyOnFailure") }}</option>
                        <option value="no">{{ $t("restartPolicyNo") }}</option>
                    </select>
                </div>

                <!-- Environment Variables -->
                <div class="mb-4">
                    <h5>{{ $tc("environmentVariable", 2) }}</h5>
                    <!-- TODO environmap kann auch Map sein -->
                    <ArrayInput :composeArray="composeService.environment" :display-name="$t('environmentVariable')" placeholder="KEY=VALUE" />
                </div>

                <!-- Container Name -->
                <div v-if="false" class="mb-4">
                    <h5>{{ $t("containerName") }}</h5>
                    <div class="input-group mb-3">
                        <input
                            v-model="composeService.containerName"
                            class="form-control"
                        />
                    </div>
                    <div class="form-text"></div>
                </div>

                <!-- Network -->
                <div class="mb-4">
                    <h5>{{ $tc("network", 2) }}</h5>

                    <div v-if="composeDocument.networks.isEmpty() && !composeService.networks.isEmpty()" class="text-warning mb-3">
                        {{ $t("NoNetworksAvailable") }}
                    </div>

                    <ArraySelect :composeArray="composeService.networks" :display-name="$t('network')" placeholder="Network Name" :options="composeDocument.networks.names" />
                </div>

                <!-- Depends on -->
                <div class="mb-4">
                    <h5>{{ $t("dependsOn") }}</h5>
                    <ArrayInput :composeArray="composeService.dependsOn" :display-name="$t('dependsOn')" :placeholder="$t(`containerName`)" />
                </div>

                <!-- Image Updates-->
                <div class="mb-4">
                    <h5>{{ $tc("imageUpdate", 2) }}</h5>
                    <div class="form-check form-switch ms-2 mt-3">
                        <input
                            id="checkImageUpdates"
                            class="form-check-input"
                            type="checkbox"
                            :checked="checkImageUpdates"
                            @input="updateCheckImageUpdates((($event.target) as any)?.checked)"
                        />
                        <label class="form-check-label" for="checkImageUpdates">
                            {{ $t("checkImageUpdates") }}
                        </label>
                    </div>
                    <div class="input-group mt-3">
                        <input
                            :value="changelogLink"
                            class="form-control"
                            @input="updateChangelogLink(($event.target as any)?.value)"
                        />
                    </div>
                    <div class="form-text ms-3">{{ $t("changelogLink") }}</div>
                </div>
            </div>
        </transition>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { parseDockerPort } from "../../../common/util-common";
import { ServiceData, StatsData, StackData } from "../../../common/types";
import { ComposeDocument, ComposeService, LABEL_IMAGEUPDATES_CHANGLOG, LABEL_IMAGEUPDATES_CHECK, LABEL_IMAGEUPDATES_IGNORE } from "../../../common/compose-document";

export default defineComponent({
    components: {
        FontAwesomeIcon,
    },
    props: {
        name: {
            type: String,
            required: true,
        },
        isEditMode: {
            type: Boolean,
            default: false,
        },
        service: {
            type: Object as PropType<ServiceData>,
            default: {} as ServiceData,
        },
        stats: {
            type: Object as PropType<StatsData>,
            default: undefined,
        }
    },
    emits: [
    ],
    data() {
        return {
            showConfig: false,
            expandedStats: false,
        };
    },
    computed: {

        status(): string {
            const healthStatus = this.service.health;

            if (healthStatus === "") {
                return this.service.state;
            } else {
                return healthStatus;
            }
        },

        bgStyle(): string {
            if (this.status === "running" || this.status === "healthy") {
                return "bg-primary";
            } else if (this.status === "unhealthy") {
                return "bg-danger";
            } else {
                return "bg-secondary";
            }
        },

        started(): boolean {
            return this.status === "starting" || this.status === "running" || this.status === "healthy" || this.status === "unhealthy" || this.status === "stopping";
        },

        logRouteLink() {
            if (this.endpoint) {
                return {
                    name: "containerLogEndpoint",
                    params: {
                        endpoint: this.endpoint,
                        stackName: this.stackName,
                        serviceName: this.name,
                    },
                };
            } else {
                return {
                    name: "containerLog",
                    params: {
                        stackName: this.stackName,
                        serviceName: this.name,
                    },
                };
            }
        },

        inspectRouteLink() {
            if (this.endpoint) {
                return {
                    name: "containerInspectEndpoint",
                    params: {
                        endpoint: this.endpoint,
                        containerName: this.service.containerName,
                    },
                };
            } else {
                return {
                    name: "containerInspect",
                    params: {
                        containerName: this.service.containerName,
                    },
                };
            }
        },

        terminalRouteLink() {
            if (this.endpoint) {
                return {
                    name: "containerTerminalEndpoint",
                    params: {
                        endpoint: this.endpoint,
                        stackName: this.stackName,
                        serviceName: this.name,
                        type: "bash",
                    },
                };
            } else {
                return {
                    name: "containerTerminal",
                    params: {
                        stackName: this.stackName,
                        serviceName: this.name,
                        type: "bash",
                    },
                };
            }
        },

        endpoint(): string {
            return this.$parent.$parent.endpoint;
        },

        stack(): StackData {
            return this.$parent.$parent.stack;
        },

        stackName(): string {
            return this.stack.name;
        },

        composeDocument(): ComposeDocument {
            return this.$parent.$parent.composeDocument;
        },

        composeService(this: {composeDocument: ComposeDocument, name: string}): ComposeService {
            return this.composeDocument.services.getService(this.name);
        },

        updateModalId(): string {
            return "image-update-modal-" + this.name;
        },

        checkImageUpdates(this: {composeService: ComposeService}): boolean {
            return !this.composeService.labels.isFalse(LABEL_IMAGEUPDATES_CHECK);
        },

        changelogLink(this: {composeService: ComposeService}): string {
            return this.composeService.labels.get(LABEL_IMAGEUPDATES_CHANGLOG, "");
        },

        isProcessing(): boolean {
            return this.$parent.$parent.processing;
        }
    },
    mounted() {
    },
    methods: {
        parsePort(port: string) {
            if (this.stack.endpoint) {
                return parseDockerPort(port, this.stack.primaryHostname);
            } else {
                let hostname = this.$root.info.primaryHostname || location.hostname;
                return parseDockerPort(port, hostname);
            }
        },
        remove() {
            this.composeDocument.services.delete(this.name);
        },
        stopService() {
            this.$parent.$parent.processing = true;
            this.$root.emitAgent(this.endpoint, "stopService", this.stack.name, this.name, (res) => {
                this.$parent.$parent.processing = false;
                this.$root.toastRes(res);
            });
        },
        startService() {
            this.$parent.$parent.processing = true;
            this.$root.emitAgent(this.endpoint, "startService", this.stack.name, this.name, (res) => {
                this.$parent.$parent.processing = false;
                this.$root.toastRes(res);
            });
        },
        restartService() {
            this.$parent.$parent.processing = true;
            this.$root.emitAgent(this.endpoint, "restartService", this.stack.name, this.name, (res) => {
                this.$parent.$parent.processing = false;
                this.$root.toastRes(res);
            });
        },
        recreateService() {
            this.$parent.$parent.processing = true;
            this.$root.emitAgent(this.endpoint, "recreateService", this.stack.name, this.name, (res) => {
                this.$parent.$parent.processing = false;
                this.$root.toastRes(res);
            });
        },
        updateService() {
            this.$refs[this.updateModalId].hide();

            this.$parent.$parent.processing = true;
            this.$root.emitAgent(this.endpoint, "updateService", this.stack.name, this.name, (res) => {
                this.$parent.$parent.processing = false;
                this.$root.toastRes(res);
            });
        },
        skipCurrentUpdate() {
            this.$refs[this.updateModalId].hide();

            this.composeService.labels.set(LABEL_IMAGEUPDATES_IGNORE, this.service.remoteImageDigest);

            this.$nextTick(() => {
                // Wait for the adaptation of the Yaml
                this.$parent.$parent.saveStack();
            });
        },
        updateChangelogLink(link: string) {
            const labels = this.composeService.labels;
            if (link) {
                labels.set(LABEL_IMAGEUPDATES_CHANGLOG, link);
            } else {
                labels.delete(LABEL_IMAGEUPDATES_CHANGLOG);
                labels.removeIfEmpty();
            }
        },
        updateCheckImageUpdates(checked: boolean) {
            const labels = this.composeService.labels;
            if (checked) {
                labels.delete(LABEL_IMAGEUPDATES_CHECK);
                labels.removeIfEmpty();
            } else {
                labels.set(LABEL_IMAGEUPDATES_CHECK, false);
            }
        }
    }
});
</script>

<style scoped lang="scss">
@import "../styles/vars";

.container {
    .image {
        font-size: 0.8rem;
        color: #6c757d;
        .tag {
            color: #33383b;
        }
    }

    .status {
        font-size: 0.8rem;
        color: #6c757d;
    }

    .notification {
        font-size: 1rem;
        color: $danger;
    }

    .function {
        align-content: center;
        display: flex;
        height: 100%;
        width: 100%;
        align-items: center;
        justify-content: end;
    }

    .stats-select {
        cursor: pointer;
        font-size: 1rem;
        color: #6c757d;
    }

    .stats {
        font-size: 0.8rem;
        color: #6c757d;
    }
}
</style>
