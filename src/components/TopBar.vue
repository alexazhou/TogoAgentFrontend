<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
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
  activeTeamEnabled: boolean;
  showConnectionStatus?: boolean;
  scheduleState?: string;
  scheduleNotRunningReason?: string;
}>();

const emit = defineEmits<{
  toggleTheme: [];
  selectTeam: [teamId: number];
  openSettings: [];
}>();

const teamMenuOpen = ref(false);
const activeTeamName = computed(() => (
  props.teams.find((team) => team.id === props.activeTeamId)?.name ?? '选择团队'
));
const enabledTeams = computed(() => props.teams
  .filter((team) => team.enabled)
  .slice()
  .sort((left, right) => left.id - right.id));
const disabledTeams = computed(() => props.teams
  .filter((team) => !team.enabled)
  .slice()
  .sort((left, right) => left.id - right.id));
const scheduleLabel = computed(() => {
  switch (props.scheduleState) {
    case 'blocked': return '调度阻塞';
    case 'stopped': return '调度停止';
    default: return '';
  }
});
const scheduleTooltip = computed(() => {
  if (!props.scheduleState || props.scheduleState === 'running') {
    return '';
  }
  return props.scheduleNotRunningReason || (props.scheduleState === 'blocked' ? '未配置大模型服务' : '调度已停止');
});

function selectTeam(teamId: number): void {
  teamMenuOpen.value = false;
  emit('selectTeam', teamId);
}

function toggleTeamMenu(): void {
  if (!props.teams.length) {
    return;
  }
  teamMenuOpen.value = !teamMenuOpen.value;
}

function handleWindowPointerDown(event: PointerEvent): void {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  if (!target.closest('.team-switcher')) {
    teamMenuOpen.value = false;
  }
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    teamMenuOpen.value = false;
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleWindowPointerDown);
  window.removeEventListener('keydown', handleWindowKeydown);
});

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', handleWindowPointerDown);
  window.addEventListener('keydown', handleWindowKeydown);
}

function handleTeamButtonKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    toggleTeamMenu();
    return;
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    teamMenuOpen.value = true;
  }
}

function handleTeamOptionKeydown(event: KeyboardEvent, teamId: number): void {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectTeam(teamId);
  }
}

function isActiveTeam(teamId: number): boolean {
  return props.activeTeamId === teamId;
}

function optionTabIndex(teamId: number): number {
  return isActiveTeam(teamId) ? 0 : -1;
}

function listboxId(): string {
  return 'topbar-team-switcher-listbox';
}

function buttonLabelId(): string {
  return 'topbar-team-switcher-label';
}

function optionId(teamId: number): string {
  return `topbar-team-option-${teamId}`;
}

function activeOptionId(): string | undefined {
  return props.activeTeamId !== null ? optionId(props.activeTeamId) : undefined;
}

function optionLabel(team: TeamSummary): string {
  return `${team.name} #${team.id}`;
}
</script>

<template>
  <header class="topbar">
    <div class="brand-group">
      <div>
        <p class="eyebrow">Team Agent Web Console</p>
      </div>
      <div class="team-switcher">
        <button
          :id="buttonLabelId()"
          type="button"
          class="team-switcher-button"
          :aria-expanded="teamMenuOpen"
          :aria-controls="listboxId()"
          aria-haspopup="listbox"
          @click="toggleTeamMenu"
          @keydown="handleTeamButtonKeydown"
        >
          <span class="team-switcher-button__label">{{ activeTeamName }}</span>
          <svg class="team-switcher-button__icon" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>

        <div
          v-if="teamMenuOpen"
          :id="listboxId()"
          class="team-switcher-menu"
          role="listbox"
          :aria-labelledby="buttonLabelId()"
          :aria-activedescendant="activeOptionId()"
        >
          <section v-if="enabledTeams.length" class="team-switcher-group">
            <div class="team-switcher-group__head">
              <span class="team-switcher-group__title">启用中</span>
              <span class="team-switcher-group__count">{{ enabledTeams.length }} 团队</span>
            </div>
            <button
              v-for="team in enabledTeams"
              :id="optionId(team.id)"
              :key="team.id"
              type="button"
              class="team-switcher-option"
              :class="{ 'is-active': isActiveTeam(team.id) }"
              role="option"
              :aria-selected="isActiveTeam(team.id)"
              :aria-label="optionLabel(team)"
              :tabindex="optionTabIndex(team.id)"
              @click="selectTeam(team.id)"
              @keydown="handleTeamOptionKeydown($event, team.id)"
            >
              <span class="team-switcher-option__name">{{ team.name }}</span>
              <span class="team-switcher-option__meta">#{{ team.id }}</span>
            </button>
          </section>

          <section v-if="disabledTeams.length" class="team-switcher-group">
            <div class="team-switcher-group__head">
              <span class="team-switcher-group__title">已停用</span>
              <span class="team-switcher-group__count">{{ disabledTeams.length }} 团队</span>
            </div>
            <button
              v-for="team in disabledTeams"
              :id="optionId(team.id)"
              :key="team.id"
              type="button"
              class="team-switcher-option team-switcher-option--disabled"
              :class="{ 'is-active': isActiveTeam(team.id) }"
              role="option"
              :aria-selected="isActiveTeam(team.id)"
              :aria-label="optionLabel(team)"
              :tabindex="optionTabIndex(team.id)"
              @click="selectTeam(team.id)"
              @keydown="handleTeamOptionKeydown($event, team.id)"
            >
              <span class="team-switcher-option__name">{{ team.name }}</span>
              <span class="team-switcher-option__meta">#{{ team.id }}</span>
            </button>
          </section>
        </div>
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
          <circle cx="12" cy="12" r="3.5"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 0 1 4.21 16.9l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.3l.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2.4a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
        </svg>
      </button>
    </div>

    <div class="status-group">
      <div v-if="!activeTeamEnabled" class="team-disabled-pill">本团队已停用</div>
      <div
        v-if="scheduleLabel"
        class="schedule-state-pill-wrapper"
      >
        <div
          class="schedule-state-pill"
          :data-state="scheduleState"
        >
          <span class="schedule-dot"></span>
          {{ scheduleLabel }}
        </div>
        <div v-if="scheduleTooltip" class="schedule-tooltip">{{ scheduleTooltip }}</div>
      </div>
      <div v-if="showConnectionStatus" class="status-pill" :data-state="connectionState">
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
      <div v-if="showConnectionStatus" class="metric-pill">{{ totalMessageCount }} 条消息</div>
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
  position: relative;
  z-index: 8;
  isolation: isolate;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
  min-height: 0;
  background: var(--topbar-bg);
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 4px 10px;
  overflow: visible;
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
  position: relative;
}

.team-switcher-button {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 180px;
  height: 28px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--pill-bg);
  color: var(--text-strong);
  padding: 0 10px;
  outline: none;
  box-shadow: none;
  cursor: pointer;
}

.team-switcher-button__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-switcher-button__icon {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.team-switcher-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 24;
  min-width: 220px;
  max-height: 240px;
  overflow: auto;
  padding: 6px;
  display: grid;
  gap: 4px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--panel-bg) 96%, var(--surface-soft) 4%);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
}

:root[data-theme='light'] .team-switcher-menu {
  background: #ffffff;
}

.team-switcher-group {
  display: grid;
  gap: 4px;
}

.team-switcher-group + .team-switcher-group {
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--panel-border) 82%, transparent 18%);
}

.team-switcher-group__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 2px 4px;
}

.team-switcher-group__title {
  color: var(--muted);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.team-switcher-group__count {
  color: var(--hint-text);
  font-size: 0.64rem;
}

.team-switcher-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  min-height: 30px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-strong);
  cursor: pointer;
  text-align: left;
}

.team-switcher-option--disabled {
  color: color-mix(in srgb, var(--muted) 82%, var(--text-strong) 18%);
}

.team-switcher-option:hover,
.team-switcher-option:focus-visible {
  border-color: color-mix(in srgb, var(--focus-border) 42%, transparent);
  background: color-mix(in srgb, var(--selected) 56%, var(--panel-bg) 44%);
  outline: none;
}

.team-switcher-option.is-active {
  border-color: color-mix(in srgb, var(--focus-border) 56%, var(--panel-border) 44%);
  background: color-mix(in srgb, var(--selected) 72%, var(--panel-bg) 28%);
}

.team-switcher-option__name {
  min-width: 0;
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-switcher-option__meta {
  min-width: 42px;
  text-align: right;
  color: var(--hint-text);
  font-size: 0.68rem;
  flex: 0 0 auto;
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

.team-switcher-button:focus-visible,
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

.team-disabled-pill,
.status-pill,
.metric-pill,
.schedule-state-pill {
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

.team-disabled-pill {
  border-color: color-mix(in srgb, var(--warn) 28%, var(--panel-border) 72%);
  background: color-mix(in srgb, var(--warn) 16%, var(--pill-bg) 84%);
  color: color-mix(in srgb, var(--warn) 82%, var(--text-strong) 18%);
}

.schedule-state-pill-wrapper {
  position: relative;
  display: inline-flex;
}

.schedule-state-pill {
  border-color: color-mix(in srgb, var(--warn) 28%, var(--panel-border) 72%);
  background: color-mix(in srgb, var(--warn) 12%, var(--pill-bg) 88%);
  color: color-mix(in srgb, var(--warn) 82%, var(--text-strong) 18%);
}

.schedule-state-pill[data-state='stopped'] {
  border-color: color-mix(in srgb, var(--danger) 28%, var(--panel-border) 72%);
  background: color-mix(in srgb, var(--danger) 12%, var(--pill-bg) 88%);
  color: color-mix(in srgb, var(--danger) 82%, var(--text-strong) 18%);
}

.schedule-tooltip {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%) scale(0.95);
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  color: var(--text);
  font-size: 0.75rem;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.schedule-state-pill-wrapper:hover .schedule-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) scale(1);
}

.schedule-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--warn);
}

.schedule-state-pill[data-state='stopped'] .schedule-dot {
  background: var(--danger);
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
