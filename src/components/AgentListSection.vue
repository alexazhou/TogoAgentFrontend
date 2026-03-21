<script setup lang="ts">
import type { AgentInfo } from '../types';

defineProps<{
  agents: AgentInfo[];
}>();
</script>

<template>
  <section class="sidebar-block">
    <div class="block-head">
      <h2>Agent</h2>
      <span>{{ agents.length }}</span>
    </div>

    <div class="sidebar-scroll agent-list">
      <div v-for="agent in agents" :key="agent.name" class="agent-card">
        <div>
          <strong>{{ agent.name }}</strong>
          <p>{{ agent.model }}</p>
        </div>
        <div class="agent-state" :data-state="agent.status">
          <span class="status-dot"></span>
          {{ agent.status === 'active' ? '忙碌' : '空闲' }}
        </div>
      </div>
    </div>
  </section>
</template>
