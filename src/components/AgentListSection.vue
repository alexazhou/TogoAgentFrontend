<script setup lang="ts">
import { getAgentAvatarUrl } from '../avatar';
import type { AgentInfo } from '../types';

defineProps<{
  agents: AgentInfo[];
}>();

const emit = defineEmits<{
  selectAgent: [agentName: string];
}>();
</script>

<template>
  <section class="sidebar-card panel">
    <div class="block-head">
      <h2>团队成员</h2>
      <span>{{ agents.length }}</span>
    </div>

    <div class="sidebar-scroll agent-list">
      <button
        v-for="agent in agents"
        :key="agent.name"
        class="agent-card sidebar-item-card"
        type="button"
        @click="emit('selectAgent', agent.name)"
      >
        <div class="agent-primary">
          <img class="agent-avatar" :src="getAgentAvatarUrl(agent.name)" :alt="`${agent.name} avatar`" />
          <div>
          <strong>{{ agent.name }}</strong>
          <p>{{ agent.model }}</p>
          </div>
        </div>
        <div class="agent-state" :data-state="agent.status">
          <span class="status-dot" :class="{ 'status-dot-pulse': agent.status === 'active' }"></span>
          {{ agent.status === 'active' ? '忙碌' : '空闲' }}
        </div>
      </button>
    </div>
  </section>
</template>

<style scoped>
.agent-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.agent-card {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border: none;
  cursor: pointer;
  color: inherit;
  text-align: left;
}

.agent-primary {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.agent-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  flex-shrink: 0;
  object-fit: cover;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--panel-border-strong) 30%, transparent);
}

.agent-card strong {
  display: block;
  font-size: 0.84rem;
  line-height: 1.1;
  color: var(--text-strong);
}

.agent-card p {
  margin: 0;
  color: var(--muted);
  font-size: 0.72rem;
  white-space: nowrap;
  transform: translateY(2px);
}

.agent-state {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  white-space: nowrap;
  font-size: 0.72rem;
}

.agent-state[data-state='active'] .status-dot {
  background: var(--good);
  box-shadow: none;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--status-dot-idle);
}

.status-dot-pulse {
  width: 6px;
  height: 6px;
  background: var(--good);
  animation: agent-dot-pulse 2s ease-in-out infinite;
}

@keyframes agent-dot-pulse {
  0%,
  100% {
    transform: scale(0.85);
    opacity: 0.55;
  }

  50% {
    transform: scale(1.35);
    opacity: 1;
  }
}
</style>
