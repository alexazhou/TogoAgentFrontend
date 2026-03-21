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

<style scoped>
.topbar {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  min-height: 0;
  background: #1c2733;
  border: 1px solid #223040;
  border-radius: 10px;
  padding: 4px 10px;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.status-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.status-pill,
.metric-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 3px 8px;
  background: #223040;
  color: var(--muted);
  font-size: 0.78rem;
}

.status-pill[data-state='connected'] {
  color: var(--good);
}

.status-pill[data-state='connected'] .status-dot {
  background: var(--good);
  box-shadow: none;
}

.status-pill[data-state='reconnecting'] .status-dot,
.status-pill[data-state='connecting'] .status-dot {
  background: #ffce54;
  box-shadow: none;
}

.status-pill[data-state='disconnected'] .status-dot {
  background: var(--danger);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #4c5e72;
}

@media (max-width: 980px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
