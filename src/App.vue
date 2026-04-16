<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterView, useRoute, useRouter } from 'vue-router';
import {
  clearGlobalRequestError,
  connectionState,
  globalRequestErrors,
  globalSuccessToasts,
  reconnectProgress,
  scheduleNotRunningReason,
  scheduleState,
  showGlobalSuccessToast,
  showQuickInit,
  totalMessageCount,
  updateScheduleState,
} from './appUiState';
import { getSystemStatus, setTeamEnabled } from './api';
import QuickInitModal from './components/layout/QuickInitModal.vue';
import TopBar from './components/layout/TopBar.vue';
import ConfirmDialog from './components/ui/ConfirmDialog.vue';
import { startRealtimeClient, stopRealtimeClient } from './realtime/wsClient';
import { findTeamById, firstTeamId, loadTeams, preferredTeamId, setPreferredTeamId, teams, teamsLoaded } from './teamStore';
import { formatConnectionState } from './utils';

type ThemeMode = 'dark' | 'light';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

const themeMode = ref<ThemeMode>((localStorage.getItem('theme-mode') as ThemeMode) || 'dark');

const teamIdFromRoute = computed<number | null>(() => {
  const raw = route.params.teamId;
  if (typeof raw !== 'string') {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
});

const currentTeam = computed(() => findTeamById(teamIdFromRoute.value));
const activeTeamId = computed(() => currentTeam.value?.id ?? preferredTeamId.value ?? firstTeamId.value);
const activeTeam = computed(() => findTeamById(activeTeamId.value));
const activeTeamEnabled = computed(() => {
  const enabled = activeTeam.value?.enabled as boolean | number | undefined;
  return enabled !== false && enabled !== 0;
});
const activeTeamEnabledPending = ref<Record<number, boolean>>({});
const isActiveTeamTogglePending = computed(() => (
  activeTeamId.value !== null ? Boolean(activeTeamEnabledPending.value[activeTeamId.value]) : false
));
const teamToggleConfirm = ref<{
  open: boolean;
  teamId: number | null;
  enabled: boolean;
}>({
  open: false,
  teamId: null,
  enabled: false,
});
const showTeamDisabledPill = computed(() => route.name === 'console' && !activeTeamEnabled.value);
const showTopbarConnectionStatus = computed(() => route.name === 'console');
const statusLabel = computed(() => formatConnectionState(connectionState.value));
const isLightMode = computed(() => themeMode.value === 'light');

// ── V13: Quick Init Modal ──

async function checkSystemStatus(): Promise<void> {
  try {
    const status = await getSystemStatus();
    showQuickInit.value = !status.initialized;
    updateScheduleState(status.schedule_state ?? '', '');
  } catch {
    // Backend unreachable — don't show init modal
    showQuickInit.value = false;
    updateScheduleState('', '');
  }
}

function handleInitSkip(): void {
  showQuickInit.value = false;
}

function handleInitDone(): void {
  showQuickInit.value = false;
  // scheduleState will be updated via WebSocket event
}

function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
}

function toggleTheme(): void {
  themeMode.value = themeMode.value === 'dark' ? 'light' : 'dark';
}

function openSettings(): void {
  if (activeTeamId.value === null) {
    return;
  }
  router.push({ name: 'settings', params: { teamId: activeTeamId.value, section: 'general' } }).catch(console.error);
}

function selectTeam(teamId: number): void {
  setPreferredTeamId(teamId);
  router.push({ name: 'console', params: { teamId } }).catch(console.error);
}

function requestActiveTeamEnabledToggle(enabled: boolean): void {
  if (!activeTeam.value) {
    return;
  }

  teamToggleConfirm.value = {
    open: true,
    teamId: activeTeam.value.id,
    enabled,
  };
}

function closeTeamToggleConfirm(): void {
  teamToggleConfirm.value = {
    open: false,
    teamId: null,
    enabled: false,
  };
}

async function updateTeamEnabledState(teamIdToUpdate: number, enabled: boolean): Promise<void> {
  if (activeTeamEnabledPending.value[teamIdToUpdate]) {
    return;
  }

  activeTeamEnabledPending.value = {
    ...activeTeamEnabledPending.value,
    [teamIdToUpdate]: true,
  };

  try {
    await setTeamEnabled(teamIdToUpdate, enabled);
    await loadTeams();
    showGlobalSuccessToast(enabled ? t('settings.page.teamEnabled') : t('settings.page.teamDisabled'));
  } catch (error) {
    console.error(error);
  } finally {
    const nextPending = { ...activeTeamEnabledPending.value };
    delete nextPending[teamIdToUpdate];
    activeTeamEnabledPending.value = nextPending;
  }
}

function confirmTeamToggle(): void {
  const { teamId: targetTeamId, enabled } = teamToggleConfirm.value;
  closeTeamToggleConfirm();
  if (targetTeamId === null) {
    return;
  }
  void updateTeamEnabledState(targetTeamId, enabled);
}

function redirectToTeam(teamId: number | null): void {
  if (teamId === null) {
    return;
  }
  router.replace({ name: 'console', params: { teamId } }).catch(console.error);
}

watch(currentTeam, (team) => {
  if (team) {
    setPreferredTeamId(team.id);
  }
});

watch(
  [teamsLoaded, teamIdFromRoute, () => route.name],
  ([loaded, routeTeamId, routeName]) => {
    if (!loaded) {
      return;
    }

    if (routeName === 'home') {
      redirectToTeam(preferredTeamId.value ?? firstTeamId.value);
      return;
    }

    if (routeName === 'team-create') {
      return;
    }

    if (routeTeamId === null || !findTeamById(routeTeamId)) {
      redirectToTeam(preferredTeamId.value ?? firstTeamId.value);
    }
  },
  { immediate: true },
);

watch(
  themeMode,
  (mode) => {
    localStorage.setItem('theme-mode', mode);
    applyTheme(mode);
  },
  { immediate: true },
);

onMounted(async () => {
  applyTheme(themeMode.value);
  startRealtimeClient();
  await Promise.all([loadTeams(), checkSystemStatus()]);
});

onBeforeUnmount(() => {
  stopRealtimeClient();
});
</script>

<template>
  <div class="shell">
    <div class="ambient ambient-left"></div>
    <div class="ambient ambient-right"></div>

    <TopBar
      :connection-state="connectionState"
      :is-light-mode="isLightMode"
      :status-label="statusLabel"
      :reconnect-progress="reconnectProgress"
      :total-message-count="totalMessageCount"
      :teams="teams"
      :active-team-id="activeTeamId"
      :active-team-enabled="activeTeamEnabled"
      :active-team-enabled-pending="isActiveTeamTogglePending"
      :show-team-disabled-pill="showTeamDisabledPill"
      :show-connection-status="showTopbarConnectionStatus"
      :schedule-state="scheduleState"
      :schedule-not-running-reason="scheduleNotRunningReason"
      @toggle-theme="toggleTheme"
      @select-team="selectTeam"
      @toggle-active-team-enabled="requestActiveTeamEnabledToggle"
      @open-settings="openSettings"
    />

    <Teleport to="body">
      <div class="global-error-toast-layer">
        <div
          v-for="toast in globalRequestErrors"
          :key="toast.id"
          class="global-error-toast"
          role="alert"
        >
          <span>{{ toast.message }}</span>
          <button type="button" :aria-label="t('common.closeAlert')" @click="clearGlobalRequestError(toast.id)">
            ×
          </button>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div class="global-success-toast-layer">
        <div
          v-for="toast in globalSuccessToasts"
          :key="toast.id"
          class="global-success-toast"
          role="status"
          aria-live="polite"
        >
          <span>{{ toast.message }}</span>
        </div>
      </div>
    </Teleport>

    <main class="workspace">
      <RouterView />
    </main>

    <QuickInitModal
      v-if="showQuickInit"
      @skip="handleInitSkip"
      @done="handleInitDone"
    />

    <ConfirmDialog
      :open="teamToggleConfirm.open"
      :title="teamToggleConfirm.enabled ? t('settings.page.toggleEnableTitle') : t('settings.page.toggleDisableTitle')"
      :message="teamToggleConfirm.enabled ? t('settings.page.toggleEnableMsg') : t('settings.page.toggleDisableMsg')"
      :confirm-label="teamToggleConfirm.enabled ? t('settings.page.toggleEnableBtn') : t('settings.page.toggleDisableBtn')"
      @close="closeTeamToggleConfirm"
      @confirm="confirmTeamToggle"
    />
  </div>
</template>

<style scoped>
.shell {
  position: relative;
  height: 100vh;
  padding: 10px;
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
}

.ambient {
  display: none;
}

.ambient-left {
  top: -8rem;
  left: -8rem;
  background: var(--shell-glow-left);
}

.ambient-right {
  right: -8rem;
  bottom: -10rem;
  background: var(--shell-glow-right);
}

.workspace {
  min-height: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

.global-error-toast-layer {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
  pointer-events: none;
}

.global-error-toast {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  width: min(345px, calc(100vw - 16px));
  min-height: 96px;
  padding: 18px 20px;
  border: 2px dashed color-mix(in srgb, var(--state-danger) 45%, var(--border-default) 55%);
  border-radius: 18px;
  background: color-mix(in srgb, var(--state-danger) 12%, var(--surface-panel) 88%);
  color: color-mix(in srgb, var(--state-danger) 88%, var(--text-primary) 12%);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  font-size: 1rem;
  line-height: 1.5;
  pointer-events: auto;
}

.global-error-toast span {
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.global-error-toast button {
  flex-shrink: 0;
  align-self: flex-start;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  font-size: 1.2rem;
}

.global-success-toast {
  width: min(360px, calc(100vw - 40px));
  min-height: 64px;
  padding: 16px 20px;
  border: 1px solid color-mix(in srgb, var(--state-success) 42%, var(--border-default) 58%);
  border-radius: 18px;
  background: color-mix(in srgb, var(--state-success) 18%, var(--surface-panel) 82%);
  color: color-mix(in srgb, var(--state-success) 78%, var(--text-primary) 22%);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.16);
  font-size: 0.96rem;
  line-height: 1.45;
  text-align: center;
  pointer-events: none;
  animation: success-toast-drop 0.22s ease-out;
}

.global-success-toast-layer {
  position: fixed;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  pointer-events: none;
}

.global-success-toast span {
  flex: 1;
}

@keyframes success-toast-drop {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
