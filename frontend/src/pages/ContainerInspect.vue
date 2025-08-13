<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ $t("inspect") }} - {{ containerName }}</h1>

            <div class="shadow-box mb-3 editor-box">
                <prism-editor
                    v-model="inspectData"
                    class="json-viewer"
                    readonly
                    :highlight="highlighterJSON"
                ></prism-editor>
            </div>
        </div>
    </transition>
</template>

<script>
import { highlight, languages } from "prismjs/components/prism-core";
import { PrismEditor } from "vue-prism-editor";
import "prismjs/components/prism-json";
import "prismjs/themes/prism-tomorrow.css";
import "vue-prism-editor/dist/prismeditor.min.css";

export default {
    components: {
        PrismEditor,
    },
    data() {
        return {
            inspectData: "fetching ...",
        };
    },
    computed: {
        stackName() {
            return this.$route.params.stackName;
        },
        endpoint() {
            return this.$route.params.endpoint || "";
        },
        containerName() {
            return this.$route.params.containerName;
        },
    },
    mounted() {
        this.$root.emitAgent(this.endpoint, "containerInspect", this.containerName, (res) => {
            if (res.ok) {
                const inspectObj = JSON.parse(res.inspectData);
                if (inspectObj) {
                    this.inspectData = JSON.stringify(inspectObj, undefined, 2);
                }
            }
        });
    },
    methods: {
        highlighterJSON(code) {
            return highlight(code, languages.json);
        }
    }
};
</script>

<style scoped lang="scss">

.editor-box {
    font-family: 'JetBrains Mono', monospace;
    font-size: 14px;
    height: 500px;
}

</style>
