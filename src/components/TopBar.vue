<script setup lang="ts">
import type { TeamSummary } from '../types';
import type { ConnectionState } from '../utils';

const props = defineProps<{
  connectionState: ConnectionState;
  isLightMode: boolean;
  statusLabel: string;
  reconnectProgress: number;
  totalMessageCount: number;
  teams: TeamSummary[];
  activeTeamId: number | null;
}>();

const emit = defineEmits<{
  toggleTheme: [];
  selectTeam: [teamId: number];
  openCreateTeam: [];
  openSettings: [];
  openTeamDetail: [];
}>();

function handleTeamChange(event: Event): void {
  const value = Number((event.target as HTMLSelectElement).value);
  if (Number.isFinite(value)) {
    emit('selectTeam', value);
  }
}
</script>

<template>
  <header class="topbar">
    <div class="brand-group">
      <div>
        <p class="eyebrow">Team Agent Web Console</p>
      </div>
      <div class="team-switcher">
        <select id="team-switcher" :value="activeTeamId ?? ''" @change="handleTeamChange">
          <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
        </select>
      </div>
      <button
        class="nav-action nav-icon-button"
        type="button"
        :disabled="activeTeamId === null"
        title="系统设置"
        aria-label="系统设置"
        @click="emit('openSettings')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.5h16"></path>
          <path d="M4 12h16"></path>
          <path d="M4 18.5h16"></path>
          <circle cx="8" cy="5.5" r="2"></circle>
          <circle cx="15" cy="12" r="2"></circle>
          <circle cx="11" cy="18.5" r="2"></circle>
        </svg>
      </button>
      <button
        class="nav-action nav-icon-button"
        type="button"
        :disabled="activeTeamId === null"
        title="团队详情"
        aria-label="团队详情"
        @click="emit('openTeamDetail')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 0 1 4.21 16.9l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.3l.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2.4a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
        </svg>
      </button>
      <button
        class="nav-action nav-action-accent nav-icon-button"
        type="button"
        title="创建团队"
        aria-label="创建团队"
        @click="emit('openCreateTeam')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14"></path>
          <path d="M5 12h14"></path>
        </svg>
      </button>
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
        @click="emit('toggleTheme')"
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
            <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7.8 7.8 0 1 0 10.5 10.5Z"></path>
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

.brand-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.eyebrow {
  margin: 0;
  color: var(--accent);
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  line-height: 1;
}

.team-switcher {
  display: flex;
  align-items: center;
}

.team-switcher select {
  appearance: none;
  -webkit-appearance: none;
  min-width: 180px;
  height: 28px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background-color: var(--pill-bg);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%236f8298' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E");
  background-position: right 9px center;
  background-repeat: no-repeat;
  background-size: 12px 12px;
  color: var(--text-strong);
  padding: 0 28px 0 10px;
  outline: none;
  box-shadow: none;
}

.nav-action {
  appearance: none;
  -webkit-appearance: none;
  height: 28px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--pill-bg);
  color: var(--text-strong);
  padding: 0 12px;
  cursor: pointer;
  outline: none;
  box-shadow: none;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease;
}

.nav-icon-button {
  width: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.nav-action:not(:disabled):hover {
  border-color: var(--focus-border);
  color: var(--text-strong);
}

.team-switcher select:focus-visible,
.nav-action:focus-visible,
.theme-switch:focus-visible {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 2px var(--focus-glow);
}

.status-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
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
  appearance: none;
  -webkit-appearance: none;
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
  outline: none;
  box-shadow: none;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease;
}

.theme-switch:hover {
  border-color: var(--focus-border);
  color: var(--text-strong);
}

.theme-switch svg,
.nav-icon-button svg {
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
  transition: transform 180ms ease;
}

.theme-switch-thumb.is-dark {
  transform: translateX(10px);
}

.reconnect-indicator {
  display: inline-flex;
}

.reconnect-ring {
  width: 14px;
  height: 14px;
  transform: rotate(-90deg);
}

.reconnect-ring-track,
.reconnect-ring-progress {
  fill: none;
  stroke-width: 2;
}

.reconnect-ring-track {
  stroke: var(--warn-track);
}

.reconnect-ring-progress {
  stroke: var(--warn);
  stroke-dasharray: 34.56;
  stroke-dashoffset: calc(34.56 * (1 - var(--reconnect-progress)));
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
    align-items: flex-start;
    flex-direction: column;
  }

  .brand-group {
    width: 100%;
  }

  .status-group {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
