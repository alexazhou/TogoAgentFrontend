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
          <div class="agent-copy">
            <strong class="agent-name-line">
              <span class="agent-name">{{ agent.name }}</span>
              <span v-if="agent.template_name" class="agent-template">{{ agent.template_name }}</span>
            </strong>
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
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.agent-list::-webkit-scrollbar {
  width: 10px;
}

.agent-list::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 999px;
}

.agent-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 999px;
  border: 2px solid var(--scrollbar-track);
}

.agent-list::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
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

.agent-copy {
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

.agent-name-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 0.84rem;
  line-height: 1.1;
  min-width: 0;
}

.agent-name {
  color: var(--text-strong);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-template {
  color: var(--hint-text);
  font-size: 0.72rem;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
