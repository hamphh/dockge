<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ $t("terminal") }} ({{ shell }}) - {{ serviceName }} ({{ stackName }})</h1>

            <div class="mb-3 btn-group" role="group">
                <router-link v-if="shell !== 'bash'" :to="bashRouteLink" class="btn btn-normal me-1">{{ $t("Switch to") + " bash" }}</router-link>
                <router-link v-if="shell !== 'sh'" :to="shRouteLink" class="btn btn-normal me-1">{{ $t("Switch to") + " sh " }}</router-link>
                <router-link v-if="shell !== 'zsh'" :to="zshRouteLink" class="btn btn-normal me-1">{{ $t("Switch to") + " zsh" }}</router-link>
            </div>

            <Terminal class="terminal" :rows="20" mode="interactive" :name="terminalName" :stack-name="stackName" :service-name="serviceName" :shell="shell" :endpoint="endpoint"></Terminal>
        </div>
    </transition>
</template>

<script>
import { getContainerTerminalName } from "../../../common/util-common";

export default {
    components: {
    },
    data() {
        return {

        };
    },
    computed: {
        stackName() {
            return this.$route.params.stackName;
        },
        endpoint() {
            return this.$route.params.endpoint || "";
        },
        shell() {
            return this.$route.params.type;
        },
        serviceName() {
            return this.$route.params.serviceName;
        },
        terminalName() {
            return getContainerTerminalName(this.endpoint, this.stackName, this.serviceName, this.shell, 0);
        },
        shRouteLink() {
            return this.shellRouteLink("sh");
        },
        bashRouteLink() {
            return this.shellRouteLink("bash");
        },
        zshRouteLink() {
            return this.shellRouteLink("zsh");
        },
    },
    mounted() {
        this.$root.emitAgent(this.endpoint, "joinContainerTerminal", this.stackName, this.serviceName, this.shell, (res) => {});
    },
    methods: {
        shellRouteLink(shell) {
            let endpoint = this.$route.params.endpoint;

            let data = {
                name: "containerTerminal",
                params: {
                    stackName: this.stackName,
                    serviceName: this.serviceName,
                    type: shell,
                },
            };

            if (endpoint) {
                data.name = "containerTerminalEndpoint";
                data.params.endpoint = endpoint;
            }

            return data;
        }
    }
};
</script>

<style scoped lang="scss">
.terminal {
    height: 410px;
}
</style>
