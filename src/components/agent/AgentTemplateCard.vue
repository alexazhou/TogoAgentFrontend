<script setup lang="ts">
import AgentCardBase from './AgentCardBase.vue';

defineProps<{
  agentName: string;
  selected: boolean;
  variant?: 'graph';
}>();

defineEmits<{
  click: [];
}>();
</script>

<template>
  <AgentCardBase
    class="agent-card"
    :title="agentName"
    subtitle="Agent"
    :avatar-name="agentName"
    :selected="selected"
    :variant="variant || 'graph'"
    @click="$emit('click')"
  />
</template>
