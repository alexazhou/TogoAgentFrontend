<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute, useRouter } from 'vue-router';
import { connectionState, reconnectProgress, totalMessageCount } from './appUiState';
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
const activeTeamName = computed(() => {
  if (currentTeam.value) {
    return currentTeam.value.name;
  }
  return findTeamById(activeTeamId.value)?.name ?? '选择团队';
});
const statusLabel = computed(() => formatConnectionState(connectionState.value));
const isLightMode = computed(() => themeMode.value === 'light');

function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
}

function toggleTheme(): void {
  themeMode.value = themeMode.value === 'dark' ? 'light' : 'dark';
}

function openCreateTeam(): void {
  router.push({ name: 'team-create' }).catch(console.error);
}

function openTeamDetail(): void {
  if (activeTeamId.value === null) {
    return;
  }
  router.push({ name: 'team-detail', params: { teamId: activeTeamId.value } }).catch(console.error);
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
      :active-team-name="activeTeamName"
      @toggle-theme="toggleTheme"
      @select-team="selectTeam"
      @open-create-team="openCreateTeam"
      @open-team-detail="openTeamDetail"
    />

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

.workspace,
.topbar {
  position: relative;
  z-index: 1;
}

.workspace {
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
</style>
