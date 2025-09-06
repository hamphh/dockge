<template>
    <div class="stats-container">
        <div class="d-flex justify-content-between stats gap-2 mt-1">
            <div class="stat">
                <div class="stat-label">
                    {{ $t('cpu') }}
                </div>
                <div>
                    {{ stats.cpuPerc }}
                </div>
            </div>
            <div class="stat">
                <div class="stat-label">
                    {{ $t('memory') }}
                </div>
                <div>
                    {{ stats.memUsage }} ({{ stats.memPerc }})
                </div>
            </div>
            <div class="stat">
                <div class="stat-label">
                    {{ $t('networkIO') }}
                </div>
                <div>
                    {{ stats.netIO }}
                </div>
            </div>
            <div class="stat">
                <div class="stat-label">
                    {{ $t('blockIO') }}
                </div>
                <div>
                    {{ stats.blockIO }}
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from "vue";
import { StatsData } from "../../../common/types";

export default defineComponent({
    props: {
        stats: {
            type: Object as PropType<StatsData>,
            required: true
        }
    },
});
</script>

<style lang="scss" scoped>
.stats-container {
    container-type: inline-size;

    .stats {
        container-type: inline-size;

        .stat {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        @container (width < 420px) {
            flex-direction: column;

            .stat {
                flex-direction: row;
            }

            .stat-label::after {
                content: ':'
            }
        }
    }
}

.stats {
    font-size: 0.8rem;
    color: #6c757d;
}

.stat-label {
    font-weight: bold;
}

</style>
