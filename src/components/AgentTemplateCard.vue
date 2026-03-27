<script setup lang="ts">
import AgentCardBase from './AgentCardBase.vue';

defineProps<{
  agentName: string;
  selected: boolean;
  variant?: 'template' | 'featured';
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
    :variant="variant || 'template'"
    @click="$emit('click')"
  />
</template>
