<script setup lang="ts">
import type { AgentInfo } from '../types';

defineProps<{
  agents: AgentInfo[];
}>();
</script>

<template>
  <section class="sidebar-card panel">
    <div class="block-head">
      <h2>团队成员</h2>
      <span>{{ agents.length }}</span>
    </div>

    <div class="sidebar-scroll agent-list">
      <div v-for="agent in agents" :key="agent.name" class="agent-card sidebar-item-card">
        <div>
          <strong>{{ agent.name }}</strong>
          <p>{{ agent.model }}</p>
        </div>
        <div class="agent-state" :data-state="agent.status">
          <span class="status-dot" :class="{ 'status-dot-pulse': agent.status === 'active' }"></span>
          {{ agent.status === 'active' ? '忙碌' : '空闲' }}
        </div>
      </div>
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
