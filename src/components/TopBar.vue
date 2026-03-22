<script setup lang="ts">
import type { ConnectionState } from '../utils';

defineProps<{
  connectionState: ConnectionState;
  isLightMode: boolean;
  statusLabel: string;
  reconnectProgress: number;
  totalMessageCount: number;
}>();

defineEmits<{
  toggleTheme: [];
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
      <button
        class="theme-switch"
        type="button"
        :aria-pressed="isLightMode"
        :title="isLightMode ? '切换到暗色模式' : '切换到亮色模式'"
        @click="$emit('toggleTheme')"
      >
        <span
          class="theme-switch-icon theme-switch-icon-sun"
          :class="{ 'is-active': isLightMode }"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4"></circle>
            <path d="M12 2.75v2.5"></path>
            <path d="M12 18.75v2.5"></path>
            <path d="M4.93 4.93l1.77 1.77"></path>
            <path d="M17.3 17.3l1.77 1.77"></path>
            <path d="M2.75 12h2.5"></path>
            <path d="M18.75 12h2.5"></path>
            <path d="M4.93 19.07l1.77-1.77"></path>
            <path d="M17.3 6.7l1.77-1.77"></path>
          </svg>
        </span>
        <span class="theme-switch-track">
          <span class="theme-switch-thumb" :class="{ 'is-dark': !isLightMode }"></span>
        </span>
        <span
          class="theme-switch-icon theme-switch-icon-moon"
          :class="{ 'is-active': !isLightMode }"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7.8 7.8 0 1 0 10.5 10.5Z"
            ></path>
          </svg>
        </span>
      </button>
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
  background: var(--topbar-bg);
  border: 1px solid var(--panel-border);
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
  background: var(--pill-bg);
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
  background: var(--warn);
  box-shadow: none;
}

.status-pill[data-state='waiting_reconnect'],
.status-pill[data-state='reconnecting'] {
  color: var(--warn);
}

.status-pill[data-state='disconnected'] .status-dot {
  background: var(--danger);
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
  background: var(--warn);
  animation: reconnect-dot-pulse 2s ease-in-out infinite;
}

.theme-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 5px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: var(--pill-bg);
  color: var(--muted);
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease;
}

.theme-switch:hover {
  border-color: var(--focus-border);
  color: var(--text-strong);
}

.theme-switch svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.theme-switch-icon {
  color: var(--muted);
  transition: color 160ms ease;
}

.theme-switch-icon.is-active {
  color: var(--theme-switch-icon-active);
}

.theme-switch-track {
  position: relative;
  width: 28px;
  height: 18px;
  border-radius: 999px;
  background: var(--toolbar-switch-off);
}

.theme-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--toolbar-switch-handle);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.24);
  transition:
    transform 180ms ease,
    background 180ms ease;
}

.theme-switch-thumb.is-dark {
  transform: translateX(10px);
}

.reconnect-indicator {
  position: relative;
  width: 16px;
  height: 16px;
  display: inline-grid;
  place-items: center;
  color: var(--warn);
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
  stroke: var(--warn-track);
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
