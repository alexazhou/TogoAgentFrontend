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
  activeTeamName: string;
}>();

const emit = defineEmits<{
  toggleTheme: [];
  selectTeam: [teamId: number];
  openCreateTeam: [];
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
        <h1>{{ activeTeamName }}</h1>
      </div>
      <div class="team-switcher">
        <label for="team-switcher">当前团队</label>
        <select id="team-switcher" :value="activeTeamId ?? ''" @change="handleTeamChange">
          <option v-for="team in teams" :key="team.id" :value="team.id">{{ team.name }}</option>
        </select>
      </div>
      <button class="nav-action" type="button" :disabled="activeTeamId === null" @click="emit('openTeamDetail')">
        团队详情
      </button>
      <button class="nav-action nav-action-accent" type="button" @click="emit('openCreateTeam')">
        创建团队
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
  padding: 8px 12px;
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
}

.brand-group h1 {
  margin: 2px 0 0;
  color: var(--text-strong);
  font-size: 1rem;
  line-height: 1.05;
}

.team-switcher {
  display: grid;
  gap: 2px;
}

.team-switcher label {
  color: var(--muted);
  font-size: 0.68rem;
}

.team-switcher select {
  min-width: 180px;
  height: 32px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--pill-bg);
  color: var(--text-strong);
  padding: 0 10px;
}

.nav-action {
  height: 32px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--pill-bg);
  color: var(--text-strong);
  padding: 0 12px;
  cursor: pointer;
}

.nav-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.nav-action-accent {
  border-color: var(--focus-border);
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

  .status-group {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
