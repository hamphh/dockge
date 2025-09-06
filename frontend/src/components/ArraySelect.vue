<template>
    <div>
        <div v-if="composeArray.isValid() && !composeArray.containsObjects()">
            <ul class="list-group">
                <li v-for="(value, index) in array" :key="index" class="list-group-item">
                    <select v-model="array[index]" class="no-bg domain-input">
                        <option value="">{{ $t(`Select a network...`) }}</option>
                        <option v-for="option in options" :key="String(option)" :value="option">{{ option }}</option>
                    </select>

                    <font-awesome-icon icon="times" class="action remove ms-2 me-3 text-danger" @click="composeArray.delete(index)" />
                </li>
            </ul>

            <button class="btn btn-normal btn-sm mt-3" @click="composeArray.add('')">{{ $t("addListItem", [ displayName ]) }}</button>
        </div>
        <div v-else>
            Long syntax is not supported here. Please use the YAML editor.
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { ComposeArray } from "../../../common/compose-document";

export default defineComponent({
    props: {
        composeArray: {
            type: Object as PropType<ComposeArray>,
            required: true,
        },
        placeholder: {
            type: String,
            default: "",
        },
        displayName: {
            type: String,
            required: true,
        },
        options: {
            type: Array,
            required: true,
        },
    },
    data() {
        return {};
    },
    computed: {
        array() {
            return this.composeArray.composeData.data;
        }
    },
    created() {

    },
    methods: {

    }
});
</script>

<style lang="scss" scoped>
@import "../styles/vars.scss";

.list-group {
    background-color: $dark-bg2;

    li {
        display: flex;
        align-items: center;
        padding: 10px 0 10px 10px;

        .domain-input {
            flex-grow: 1;
            background-color: $dark-bg2;
            border: none;
            color: $dark-font-color;
            outline: none;

            &::placeholder {
                color: #1d2634;
            }
        }
    }
}
</style>
