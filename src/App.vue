<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import {
  clearGlobalRequestError,
  connectionState,
  globalRequestErrors,
  globalSuccessToasts,
  reconnectProgress,
  totalMessageCount,
} from './appUiState';
import TopBar from './components/TopBar.vue';
import { findTeamById, firstTeamId, loadTeams, preferredTeamId, setPreferredTeamId, teams, teamsLoaded } from './teamStore';
import { formatConnectionState } from './utils';

type ThemeMode = 'dark' | 'light';

const route = useRoute();
const router = useRouter();

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
const activeTeamEnabled = computed(() => {
  const enabled = currentTeam.value?.enabled as boolean | number | undefined;
  return enabled !== false && enabled !== 0;
});
const showTeamDisabledPill = computed(() => route.name === 'console' && !activeTeamEnabled.value);
const showTopbarConnectionStatus = computed(() => route.name === 'console');
const statusLabel = computed(() => formatConnectionState(connectionState.value));
const isLightMode = computed(() => themeMode.value === 'light');

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
  await loadTeams();
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
      :active-team-enabled="showTeamDisabledPill ? activeTeamEnabled : true"
      :show-connection-status="showTopbarConnectionStatus"
      @toggle-theme="toggleTheme"
      @select-team="selectTeam"
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
          <button type="button" aria-label="关闭提醒" @click="clearGlobalRequestError(toast.id)">
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
  border: 2px dashed color-mix(in srgb, var(--danger) 45%, var(--panel-border) 55%);
  border-radius: 18px;
  background: color-mix(in srgb, var(--danger) 12%, var(--panel-bg) 88%);
  color: #ff5f56;
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
  border: 1px solid color-mix(in srgb, #6dc7a3 42%, var(--panel-border) 58%);
  border-radius: 18px;
  background: color-mix(in srgb, #6dc7a3 18%, var(--panel-bg) 82%);
  color: color-mix(in srgb, #1c7f5f 78%, var(--text-strong) 22%);
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
