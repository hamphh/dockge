<template>
    <div class="stats-container">
        <div class="d-flex justify-content-between stats gap-2 mt-1">
            <div class="stat">
                <div class="stat-label">
                    {{ $t('cpu') }}
                </div>
                <div>
                    {{ stats.CPUPerc }}
                </div>
            </div>
            <div class="stat">
                <div class="stat-label">
                    {{ $t('memory') }}
                </div>
                <div>
                    {{ stats.MemUsage }} ({{ stats.MemPerc }})
                </div>
            </div>
            <div class="stat">
                <div class="stat-label">
                    {{ $t('networkIO') }}
                </div>
                <div>
                    {{ stats.NetIO }}
                </div>
            </div>
            <div class="stat">
                <div class="stat-label">
                    {{ $t('blockIO') }}
                </div>
                <div>
                    {{ stats.BlockIO }}
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        stats: {
            type: Object,
            required: true
        }
    },
};
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
