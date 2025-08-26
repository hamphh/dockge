<template>
    <font-awesome-icon v-if="updateAvailable" icon="arrow-alt-circle-up" class="text-info" />
</template>

<script>

export default {
    props: {
        updateAvailable: {
            type: Boolean,
            default: false,
        }
    },

    computed: {
    },
};

</script>

<style scoped>
</style>
