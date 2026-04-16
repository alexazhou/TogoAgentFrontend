<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import i18n from '../i18n';
import { setLanguage } from '../api';
import type { TeamSummary } from '../types';
import type { ConnectionState } from '../utils';
import type { AppLocale } from '../i18n';

const { t } = useI18n();

const props = defineProps<{
  connectionState: ConnectionState;
  isLightMode: boolean;
  statusLabel: string;
  reconnectProgress: number;
  totalMessageCount: number;
  teams: TeamSummary[];
  activeTeamId: number | null;
  activeTeamEnabled: boolean;
  activeTeamEnabledPending: boolean;
  showTeamDisabledPill?: boolean;
  showConnectionStatus?: boolean;
  scheduleState?: string;
  scheduleNotRunningReason?: string;
}>();

const emit = defineEmits<{
  toggleTheme: [];
  selectTeam: [teamId: number];
  toggleActiveTeamEnabled: [enabled: boolean];
  openSettings: [];
}>();

const teamMenuOpen = ref(false);
const languageMenuOpen = ref(false);
const currentLocale = computed<AppLocale>(() => i18n.global.locale.value);

const activeTeamName = computed(() => (
  props.teams.find((team) => team.id === props.activeTeamId)?.name ?? t('topbar.selectTeam')
));
const activeTeam = computed(() => props.teams.find((team) => team.id === props.activeTeamId) ?? null);
const enabledTeams = computed(() => props.teams
  .filter((team) => team.enabled)
  .slice()
  .sort((left, right) => left.id - right.id));
const disabledTeams = computed(() => props.teams
  .filter((team) => !team.enabled)
  .slice()
  .sort((left, right) => left.id - right.id));
const activeTeamToggleLabel = computed(() => {
  if (props.activeTeamEnabledPending) {
    return t('topbar.teamSwitching');
  }
  return props.activeTeamEnabled ? t('settings.teams.enabled') : t('settings.teams.disabled');
});
const activeTeamToggleAriaLabel = computed(() => (
  `${t('topbar.teamToggleLabel')}：${activeTeamToggleLabel.value}`
));
const scheduleLabel = computed(() => {
  switch (props.scheduleState) {
    case 'blocked': return t('topbar.scheduleBlocked');
    case 'stopped': return t('topbar.scheduleStopped');
    default: return '';
  }
});
const scheduleTooltip = computed(() => {
  if (!props.scheduleState || props.scheduleState === 'running') {
    return '';
  }
  return props.scheduleNotRunningReason || (props.scheduleState === 'blocked' ? t('topbar.scheduleBlockedReason') : t('topbar.scheduleStoppedReason'));
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
  if (!target.closest('.language-switch')) {
    languageMenuOpen.value = false;
  }
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    teamMenuOpen.value = false;
    languageMenuOpen.value = false;
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

function toggleLanguageMenu(): void {
  languageMenuOpen.value = !languageMenuOpen.value;
}

async function handleSetLanguage(lang: AppLocale): Promise<void> {
  try {
    await setLanguage(lang);
    i18n.global.locale.value = lang;
    languageMenuOpen.value = false;
  } catch (error) {
    console.error('Failed to set language:', error);
  }
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

function toggleActiveTeamEnabled(): void {
  if (!activeTeam.value || props.activeTeamEnabledPending) {
    return;
  }
  emit('toggleActiveTeamEnabled', !activeTeam.value.enabled);
}
</script>

<template>
  <header class="topbar">
    <div class="brand-group">
      <button
        class="nav-action nav-icon-button"
        type="button"
        :disabled="activeTeamId === null"
        :title="t('topbar.settings')"
        :aria-label="t('topbar.settings')"
        @click="emit('openSettings')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3.5"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 0 1 4.21 16.9l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.3l.06.06A1.65 1.65 0 0 0 8.92 4a1.65 1.65 0 0 0 1-1.51V2.4a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"></path>
        </svg>
      </button>
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
              <span class="team-switcher-group__title">{{ t('topbar.teamGroupEnabled') }}</span>
              <span class="team-switcher-group__count">{{ t('topbar.teamsCount', { count: enabledTeams.length }) }}</span>
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
              <span class="team-switcher-group__title">{{ t('topbar.teamGroupDisabled') }}</span>
              <span class="team-switcher-group__count">{{ t('topbar.teamsCount', { count: disabledTeams.length }) }}</span>
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
        type="button"
        class="team-enabled-switch topbar-team-enabled-switch"
        :class="{ 'is-enabled': activeTeamEnabled }"
        :disabled="activeTeamId === null || activeTeamEnabledPending"
        :aria-pressed="activeTeamEnabled"
        :aria-label="activeTeamToggleAriaLabel"
        :title="activeTeamToggleAriaLabel"
        @click="toggleActiveTeamEnabled"
      >
        <span class="team-enabled-switch__label">{{ activeTeamToggleLabel }}</span>
        <span class="team-enabled-switch__track">
          <span class="team-enabled-switch__thumb" :class="{ 'is-enabled': activeTeamEnabled }"></span>
        </span>
      </button>
    </div>

    <div class="status-group">
      <div v-if="showTeamDisabledPill && !activeTeamEnabled" class="team-disabled-pill">{{ t('topbar.teamDisabled') }}</div>
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
      <div v-if="showConnectionStatus" class="metric-pill">{{ t('topbar.messagesCount', { count: totalMessageCount }) }}</div>
      <button
        class="theme-switch"
        type="button"
        :aria-pressed="isLightMode"
        :title="isLightMode ? t('topbar.switchToDark') : t('topbar.switchToLight')"
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
      <div class="language-switch">
        <button
          type="button"
          class="lang-button"
          :aria-expanded="languageMenuOpen"
          aria-haspopup="listbox"
          :aria-label="t('language.switcher')"
          :title="t('language.switcher')"
          @click="toggleLanguageMenu"
        >
          <svg class="lang-button__globe" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18Z" />
            <path d="M3.6 9h16.8" />
            <path d="M3.6 15h16.8" />
            <path d="M12 3c2.3 2.2 3.6 5.3 3.6 9s-1.3 6.8-3.6 9c-2.3-2.2-3.6-5.3-3.6-9s1.3-6.8 3.6-9Z" />
          </svg>
          <svg class="lang-button__chevron" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </button>
        <div
          v-if="languageMenuOpen"
          class="lang-menu"
          role="listbox"
        >
          <button
            type="button"
            class="lang-option"
            :class="{ 'is-active': currentLocale === 'zh-CN' }"
            role="option"
            :aria-selected="currentLocale === 'zh-CN'"
            @click="handleSetLanguage('zh-CN')"
          >
            <span class="lang-option__check" aria-hidden="true">{{ currentLocale === 'zh-CN' ? '✓' : '' }}</span>
            {{ t('language.zhCN') }}
          </button>
          <button
            type="button"
            class="lang-option"
            :class="{ 'is-active': currentLocale === 'en' }"
            role="option"
            :aria-selected="currentLocale === 'en'"
            @click="handleSetLanguage('en')"
          >
            <span class="lang-option__check" aria-hidden="true">{{ currentLocale === 'en' ? '✓' : '' }}</span>
            {{ t('language.en') }}
          </button>
        </div>
      </div>
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
  border: 1px solid var(--room-card-border);
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
  border: 1px solid var(--room-card-border);
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
  border-top: 1px solid color-mix(in srgb, var(--room-card-border) 82%, transparent 18%);
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
  border-color: color-mix(in srgb, var(--focus-border) 56%, var(--room-card-border) 44%);
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
  border: 1px solid var(--room-card-border);
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
.theme-switch:focus-visible,
.team-enabled-switch:focus-visible {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 2px var(--focus-glow);
}

.team-enabled-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 6px 0 9px;
  border: 1px solid var(--room-card-border);
  border-radius: 8px;
  background: var(--pill-bg);
  color: var(--text-strong);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.team-enabled-switch:hover:not(:disabled) {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 40%, var(--panel-bg) 60%);
}

.team-enabled-switch:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.team-enabled-switch.is-enabled {
  color: var(--good);
}

.team-enabled-switch__label {
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
}

.team-enabled-switch__track {
  position: relative;
  width: 30px;
  height: 16px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 16%, var(--room-card-border) 84%);
  transition: background 0.18s ease;
}

.team-enabled-switch.is-enabled .team-enabled-switch__track {
  background: color-mix(in srgb, var(--good) 24%, var(--room-card-border) 76%);
}

.team-enabled-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--panel-bg) 88%, white 12%);
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.12);
  transition:
    transform 0.18s ease,
    background 0.18s ease;
}

.team-enabled-switch__thumb.is-enabled {
  transform: translateX(14px);
  background: color-mix(in srgb, var(--panel-bg) 72%, white 28%);
}

.topbar-team-enabled-switch {
  flex: 0 0 auto;
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
  border: 1px solid var(--room-card-border);
  border-radius: 8px;
  padding: 3px 8px;
  background: var(--pill-bg);
  color: var(--muted);
  font-size: 0.78rem;
}

.team-disabled-pill {
  border-color: color-mix(in srgb, var(--warn) 28%, var(--room-card-border) 72%);
  background: color-mix(in srgb, var(--warn) 16%, var(--pill-bg) 84%);
  color: color-mix(in srgb, var(--warn) 82%, var(--text-strong) 18%);
}

.schedule-state-pill-wrapper {
  position: relative;
  display: inline-flex;
}

.schedule-state-pill {
  border-color: color-mix(in srgb, var(--warn) 28%, var(--room-card-border) 72%);
  background: color-mix(in srgb, var(--warn) 12%, var(--pill-bg) 88%);
  color: color-mix(in srgb, var(--warn) 82%, var(--text-strong) 18%);
}

.schedule-state-pill[data-state='stopped'] {
  border-color: color-mix(in srgb, var(--danger) 28%, var(--room-card-border) 72%);
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
  border: 1px solid var(--room-card-border);
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
  border: 1px solid var(--room-card-border);
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

.language-switch {
  position: relative;
  display: flex;
  align-items: center;
}

.lang-button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 6px;
  border: 1px solid var(--room-card-border);
  border-radius: 8px;
  background: var(--pill-bg);
  color: var(--text-strong);
  cursor: pointer;
  outline: none;
  transition: border-color 140ms ease, background 140ms ease;
}

.lang-button:hover {
  border-color: var(--focus-border);
}

.lang-button:focus-visible {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 2px var(--focus-glow);
}

.lang-button__globe,
.lang-button__chevron {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.lang-button__globe {
  width: 14px;
  height: 14px;
}

.lang-button__chevron {
  width: 10px;
  height: 10px;
}

.lang-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 24;
  min-width: 100px;
  padding: 4px;
  display: grid;
  gap: 2px;
  border: 1px solid var(--room-card-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel-bg) 96%, var(--surface-soft) 4%);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
}

:root[data-theme='light'] .lang-menu {
  background: #ffffff;
}

.lang-option {
  display: grid;
  grid-template-columns: 14px 1fr;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--text-strong);
  font-size: 0.72rem;
  text-align: left;
  cursor: pointer;
  outline: none;
}

.lang-option__check {
  color: var(--accent);
  font-size: 0.76rem;
  font-weight: 700;
  text-align: center;
}

.lang-option:hover,
.lang-option:focus-visible {
  border-color: color-mix(in srgb, var(--focus-border) 42%, transparent);
  background: color-mix(in srgb, var(--selected) 56%, var(--panel-bg) 44%);
}

.lang-option.is-active {
  border-color: color-mix(in srgb, var(--focus-border) 56%, var(--room-card-border) 44%);
  background: color-mix(in srgb, var(--selected) 72%, var(--panel-bg) 28%);
  font-weight: 600;
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
