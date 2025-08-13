<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ $t("log") }} - {{ serviceName }} ({{ stackName }})</h1>

            <Terminal class="terminal" :rows="20" mode="displayOnly" :name="terminalName" :stack-name="stackName" :service-name="serviceName" :endpoint="endpoint"></Terminal>
        </div>
    </transition>
</template>

<script>
import { getContainerLogName } from "../../../common/util-common";

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
        serviceName() {
            return this.$route.params.serviceName;
        },
        terminalName() {
            return getContainerLogName(this.endpoint, this.stackName, this.serviceName, 0);
        },
    },
    mounted() {
        this.$root.emitAgent(this.endpoint, "joinContainerLog", this.stackName, this.serviceName, (res) => {});
    },
    methods: {
    }
};
</script>

<style scoped lang="scss">
.terminal {
    height: 410px;
}
</style>
