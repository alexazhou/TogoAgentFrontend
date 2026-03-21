<script setup lang="ts">
import type { ConnectionState } from '../utils';

defineProps<{
  connectionState: ConnectionState;
  statusLabel: string;
  totalMessageCount: number;
}>();
</script>

<template>
  <header class="topbar">
    <div>
      <p class="eyebrow">Team Agent Web Console</p>
      <h1>多人协作观测台</h1>
    </div>
    <div class="status-group">
      <div class="status-pill" :data-state="connectionState">
        <span class="status-dot"></span>
        {{ statusLabel }}
      </div>
      <div class="metric-pill">{{ totalMessageCount }} 条消息</div>
    </div>
  </header>
</template>
