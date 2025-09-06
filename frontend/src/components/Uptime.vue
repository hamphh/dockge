<template>
    <span :class="className">{{ statusName }}</span>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { statusColor, statusNameShort } from "../../../common/util-common";
import { SimpleStackData } from "../../../common/types";

export default defineComponent({
    props: {
        stack: {
            type: Object as PropType<SimpleStackData>,
            default: null,
        },
        fixedWidth: {
            type: Boolean,
            default: false,
        },
    },

    computed: {
        uptime() {
            return this.$t("notAvailableShort");
        },

        color() {
            return statusColor(this.stack?.status);
        },

        statusName() {
            return this.$t(statusNameShort(this.stack?.status));
        },

        className() {
            let className = `badge rounded-pill bg-${this.color}`;

            if (this.fixedWidth) {
                className += " fixed-width";
            }
            return className;
        },
    },
});
</script>

<style scoped>
.badge {
    min-width: 62px;

}

.fixed-width {
    width: 62px;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
