<script setup lang="ts">
import type { ConnectionState } from '../utils';

defineProps<{
  connectionState: ConnectionState;
  statusLabel: string;
  reconnectProgress: number;
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
        <span
          v-if="connectionState === 'waiting_reconnect'"
          class="reconnect-indicator"
          :style="{ '--reconnect-progress': reconnectProgress.toString() }"
          aria-hidden="true"
        >
          <svg viewBox="0 0 16 16" class="reconnect-ring">
            <circle class="reconnect-ring-track" cx="8" cy="8" r="5.5" />
            <circle class="reconnect-ring-progress" cx="8" cy="8" r="5.5" />
          </svg>
        </span>
        <span
          v-else
          class="status-dot"
          :class="{ 'status-dot-pulse': connectionState === 'reconnecting' }"
        ></span>
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

.status-pill[data-state='waiting_reconnect'] .status-dot,
.status-pill[data-state='reconnecting'] .status-dot,
.status-pill[data-state='connecting'] .status-dot {
  background: #ffce54;
  box-shadow: none;
}

.status-pill[data-state='waiting_reconnect'],
.status-pill[data-state='reconnecting'] {
  color: #ffce54;
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

.status-dot-pulse {
  width: 6px;
  height: 6px;
  background: #ffce54;
  animation: reconnect-dot-pulse 1.6s ease-in-out infinite;
}

.reconnect-indicator {
  position: relative;
  width: 16px;
  height: 16px;
  display: inline-grid;
  place-items: center;
  color: #ffce54;
}

.reconnect-ring {
  width: 16px;
  height: 16px;
  transform: rotate(-90deg);
}

.reconnect-ring-track,
.reconnect-ring-progress {
  fill: none;
  stroke-width: 1.7;
}

.reconnect-ring-track {
  stroke: rgba(255, 206, 84, 0.22);
}

.reconnect-ring-progress {
  stroke: currentColor;
  stroke-linecap: round;
  stroke-dasharray: 34.56;
  stroke-dashoffset: calc(34.56 * (1 - var(--reconnect-progress, 0)));
}

@keyframes reconnect-dot-pulse {
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

@media (max-width: 980px) {
  .topbar {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
