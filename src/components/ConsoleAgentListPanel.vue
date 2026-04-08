<script setup lang="ts">
import AgentListSection from './AgentListSection.vue';
import type { AgentInfo } from '../types';

defineProps<{
  agents: AgentInfo[];
}>();

const emit = defineEmits<{
  selectAgent: [agentName: string];
}>();
</script>

<template>
  <div class="console-panel">
    <AgentListSection
      :agents="agents"
      @select-agent="emit('selectAgent', $event)"
    />
  </div>
</template>

<style scoped>
.console-panel {
  min-height: 0;
  min-width: 0;
  display: flex;
}

.console-panel > * {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 100%;
}
</style>
