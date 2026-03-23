<script setup lang="ts">
import TeamMemberGraph from './TeamMemberGraph.vue';

defineProps<{
  teamName: string;
  selectedAgents: string[];
}>();

const emit = defineEmits<{
  toggleAgent: [agentName: string];
}>();
</script>

<template>
  <section class="member-panel">
    <div class="member-panel-head">
      <span class="panel-label">团队成员</span>
    </div>

    <TeamMemberGraph :team-name="teamName" :selected-agents="selectedAgents" @toggle-agent="emit('toggleAgent', $event)" />
  </section>
</template>

<style scoped>
.member-panel {
  display: grid;
  gap: 8px;
  border: 1px solid var(--team-create-panel-border);
  border-radius: 20px;
  background: var(--panel-bg);
  box-shadow: var(--panel-shadow);
  padding: 10px 12px;
  min-height: 0;
  overflow: hidden;
  align-self: stretch;
}

.member-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 0;
}

.panel-label {
  color: var(--text-strong);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}
</style>
