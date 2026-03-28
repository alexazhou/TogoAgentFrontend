<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getAgents, getDeptTree, getTeamDetail, updateTeam } from '../api';
import { connectionState, showGlobalSuccessToast, totalMessageCount } from '../appUiState';
import GeneralSettingsSection from '../components/settings/GeneralSettingsSection.vue';
import ModelsSettingsSection from '../components/settings/ModelsSettingsSection.vue';
import RolesSettingsSection from '../components/settings/RolesSettingsSection.vue';
import RuntimeSettingsSection from '../components/settings/RuntimeSettingsSection.vue';
import TeamsSettingsSection from '../components/settings/TeamsSettingsSection.vue';
import { loadTeams, teams } from '../teamStore';
import type { AgentInfo, DeptTreeNode, TeamDetail } from '../types';
import type { SettingsBreadcrumbItem } from '../components/settings/types';

const route = useRoute();
const router = useRouter();

totalMessageCount.value = 0;

const teamId = computed(() => Number(route.params.teamId));
const startedAt = Date.now();
const uptimeLabel = ref('00:00:00');
const systemVersion = 'Web Console v0.1.0';
const driverStates = [
  { key: 'claude', label: 'Claude', available: false, note: '待接入检测' },
  { key: 'tps', label: 'TPS', available: false, note: '待接入检测' },
];
const agents = ref<AgentInfo[]>([]);
const settingsMainRef = ref<HTMLElement | null>(null);
const settingsScrollbarHovered = ref(false);
const teamSummaries = ref<Record<number, {
  memberCount: number;
  roomCount: number;
  deptCount: number;
  hierarchyLevelCount: number;
  workingDirectory: string;
}>>({});
const selectedTeamDetail = ref<TeamDetail | null>(null);
const teamInfoDraft = ref({
  name: '',
  workingDirectory: '',
  slogan: '',
  rules: '',
});
const isSavingTeamInfo = ref(false);
const teamInfoStatus = ref('');
let uptimeTimer: number | null = null;

const navItems = [
  { id: 'general', label: '系统状态', note: '系统概览与基础状态' },
  { id: 'teams', label: '团队管理', note: '团队信息与组织结构' },
  { id: 'roles', label: '角色管理', note: '角色模板与职责分配' },
  { id: 'models', label: '大模型服务管理', note: '模型服务与调用策略' },
  { id: 'runtime', label: '运行与存储', note: '日志、数据与工作目录' },
];

const defaultSectionId = navItems[0].id;
const validSectionIds = new Set(navItems.map((item) => item.id));

const routeSection = computed(() =>
  typeof route.params.section === 'string' ? route.params.section : '',
);
const currentSectionId = computed(() =>
  validSectionIds.has(routeSection.value) ? routeSection.value : defaultSectionId,
);
const currentNavItem = computed(() =>
  navItems.find((item) => item.id === currentSectionId.value) ?? navItems[0],
);
const detailTeamId = computed(() => {
  const raw = route.query.detailTeamId;
  if (typeof raw !== 'string') {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
});
function buildTeamInfoDraft(detail: TeamDetail) {
  return {
    name: detail.name,
    workingDirectory: detail.working_directory || '',
    slogan: String(detail.config?.slogan || ''),
    rules: String(detail.config?.rules || ''),
  };
}

const hasTeamInfoChanges = computed(() => {
  if (!selectedTeamDetail.value) {
    return false;
  }

  return (
    teamInfoDraft.value.name !== selectedTeamDetail.value.name ||
    teamInfoDraft.value.workingDirectory !== (selectedTeamDetail.value.working_directory || '') ||
    teamInfoDraft.value.slogan !== String(selectedTeamDetail.value.config?.slogan || '') ||
    teamInfoDraft.value.rules !== String(selectedTeamDetail.value.config?.rules || '')
  );
});
const breadcrumbItems = computed<SettingsBreadcrumbItem[]>(() => {
  const items: SettingsBreadcrumbItem[] = [
    { key: 'settings', label: '系统设置', current: false },
    {
      key: `section-${currentNavItem.value.id}`,
      label: currentNavItem.value.label,
      current: detailTeamId.value === null,
    },
  ];

  if (currentSectionId.value === 'teams' && selectedTeamDetail.value) {
    items[items.length - 1].current = false;
    items.push({
      key: 'team-detail',
      label: '团队详情',
      current: true,
    });
  }

  return items;
});
function openSection(sectionId: string): void {
  router.push({
    name: 'settings',
    params: { teamId: teamId.value, section: sectionId },
    query: sectionId === 'teams' && detailTeamId.value ? { detailTeamId: String(detailTeamId.value) } : {},
  }).catch(console.error);
}

function handleBreadcrumbNavigate(key: string): void {
  if (key === 'settings') {
    openSection(defaultSectionId);
    return;
  }

  if (key === 'team-detail') {
    clearTeamDetail();
    return;
  }

  if (key.startsWith('section-')) {
    const sectionId = key.slice('section-'.length);
    if (sectionId === 'teams') {
      clearTeamDetail();
      return;
    }
    openSection(sectionId);
  }
}

function goBack(): void {
  router.push({ name: 'console', params: { teamId: teamId.value } }).catch(console.error);
}

function openCreateTeam(): void {
  router.push({ name: 'team-create' }).catch(console.error);
}

function openTeamDetail(targetTeamId: number): void {
  router.push({
    name: 'settings',
    params: { teamId: teamId.value, section: 'teams' },
    query: { detailTeamId: String(targetTeamId) },
  }).catch(console.error);
}

function clearTeamDetail(): void {
  router.push({
    name: 'settings',
    params: { teamId: teamId.value, section: 'teams' },
  }).catch(console.error);
}

function updateSettingsScrollbarHover(event: PointerEvent): void {
  const element = settingsMainRef.value;
  if (!element) {
    settingsScrollbarHovered.value = false;
    return;
  }

  const rect = element.getBoundingClientRect();
  const hoverInset = 18;
  const hoverVertical = element.scrollHeight > element.clientHeight
    && event.clientX >= rect.right - hoverInset
    && event.clientX <= rect.right;
  const hoverHorizontal = element.scrollWidth > element.clientWidth
    && event.clientY >= rect.bottom - hoverInset
    && event.clientY <= rect.bottom;

  settingsScrollbarHovered.value = hoverVertical || hoverHorizontal;
}

function clearSettingsScrollbarHover(): void {
  settingsScrollbarHovered.value = false;
}

async function loadTeamSummaries(): Promise<void> {
  const entries = await Promise.all(
    teams.value.map(async (team) => {
      try {
        const [detail, deptTree] = await Promise.all([
          getTeamDetail(team.id),
          getDeptTree(team.id),
        ]);
        return [team.id, {
          memberCount: detail.members.length,
          roomCount: detail.rooms.length,
          deptCount: countDeptNodes(deptTree),
          hierarchyLevelCount: countDeptHierarchyLevels(deptTree),
          workingDirectory: detail.working_directory || team.working_directory || '',
        }] as const;
      } catch (error) {
        console.error(error);
        return [team.id, {
          memberCount: 0,
          roomCount: 0,
          deptCount: 0,
          hierarchyLevelCount: 0,
          workingDirectory: team.working_directory || '',
        }] as const;
      }
    }),
  );
  teamSummaries.value = Object.fromEntries(entries);
}

function countDeptNodes(node: DeptTreeNode | null): number {
  if (!node) {
    return 0;
  }

  return 1 + node.children.reduce((total, child) => total + countDeptNodes(child), 0);
}

function countDeptHierarchyLevels(node: DeptTreeNode | null): number {
  if (!node) {
    return 0;
  }

  if (!node.children.length) {
    return 1;
  }

  return 1 + Math.max(...node.children.map((child) => countDeptHierarchyLevels(child)));
}

async function loadSelectedTeamDetail(targetTeamId: number | null): Promise<void> {
  if (targetTeamId === null) {
    selectedTeamDetail.value = null;
    teamInfoStatus.value = '';
    return;
  }

  try {
    selectedTeamDetail.value = await getTeamDetail(targetTeamId);
    teamInfoDraft.value = buildTeamInfoDraft(selectedTeamDetail.value);
    teamInfoStatus.value = '';
  } catch (error) {
    console.error(error);
    selectedTeamDetail.value = null;
  }
}

async function saveTeamInfo(): Promise<void> {
  if (!selectedTeamDetail.value || isSavingTeamInfo.value || !hasTeamInfoChanges.value) {
    return;
  }

  isSavingTeamInfo.value = true;
  teamInfoStatus.value = '';

  try {
    await updateTeam(selectedTeamDetail.value.id, {
      name: teamInfoDraft.value.name.trim(),
      working_directory: teamInfoDraft.value.workingDirectory,
      config: {
        ...(selectedTeamDetail.value.config || {}),
        slogan: teamInfoDraft.value.slogan,
        rules: teamInfoDraft.value.rules,
      },
    });
    await Promise.all([
      loadSelectedTeamDetail(selectedTeamDetail.value.id),
      loadTeamSummaries(),
      loadTeams(),
    ]);
    teamInfoStatus.value = '已保存';
    showGlobalSuccessToast('团队信息已保存');
  } catch (error) {
    console.error(error);
    teamInfoStatus.value = '保存失败';
  } finally {
    isSavingTeamInfo.value = false;
  }
}

function resetTeamInfoDraft(): void {
  if (!selectedTeamDetail.value) {
    return;
  }

  teamInfoDraft.value = buildTeamInfoDraft(selectedTeamDetail.value);
  teamInfoStatus.value = '';
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function formatDateTime(value: string): string {
  if (!value) {
    return '未知';
  }

  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return value.replace('T', ' ').split('.')[0];
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function updateUptime(): void {
  uptimeLabel.value = formatDuration(Date.now() - startedAt);
}

const systemPlatform = computed(() => {
  const platform = navigator.platform || 'Unknown Platform';
  const language = navigator.language || 'unknown';
  return `${platform} / ${language}`;
});

const teamCount = computed(() => teams.value.length);
const memberCount = computed(() => agents.value.length);
const agentCount = computed(() => agents.value.length);

watch(
  () => teams.value.map((team) => team.id),
  (teamIds) => {
    if (!teamIds.length) {
      teamSummaries.value = {};
      return;
    }

    loadTeamSummaries().catch(console.error);
  },
  { immediate: true },
);

watch(
  () => route.params.section,
  (section) => {
    if (typeof section !== 'string' || !validSectionIds.has(section)) {
      router.replace({ name: 'settings', params: { teamId: teamId.value, section: defaultSectionId } }).catch(console.error);
    }
  },
  { immediate: true },
);

watch(
  [currentSectionId, detailTeamId],
  ([sectionId, targetTeamId]) => {
    if (sectionId === 'teams') {
      loadSelectedTeamDetail(targetTeamId).catch(console.error);
      return;
    }
    selectedTeamDetail.value = null;
  },
  { immediate: true },
);

onMounted(() => {
  updateUptime();
  uptimeTimer = window.setInterval(updateUptime, 1000);
  getAgents()
    .then((result) => {
      agents.value = result;
    })
    .catch((error) => {
      console.error(error);
    });
});

onBeforeUnmount(() => {
  if (uptimeTimer !== null) {
    window.clearInterval(uptimeTimer);
    uptimeTimer = null;
  }
});

function handleTeamTreeSaved(): void {
  if (!selectedTeamDetail.value) {
    return;
  }

  Promise.all([
    loadSelectedTeamDetail(selectedTeamDetail.value.id),
    loadTeamSummaries(),
    loadTeams(),
  ]).catch(console.error);
}
</script>

<template>
  <section class="settings-shell panel">
    <header class="settings-head">
      <div class="settings-head-main">
        <div class="settings-title-row">
          <h2>系统设置</h2>
          <p class="settings-eyebrow">Admin Console</p>
        </div>
      </div>
      <button type="button" class="secondary-button" @click="goBack">返回主界面</button>
    </header>

    <div class="settings-layout">
      <aside class="settings-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-card-head">
            <span>导航菜单</span>
            <small>{{ navItems.length }} 项</small>
          </div>
          <nav class="settings-nav" aria-label="设置导航">
            <button
              v-for="item in navItems"
              :key="item.id"
              type="button"
              class="nav-link"
              :class="{ active: item.id === currentSectionId }"
              @click="openSection(item.id)"
            >
              <strong>{{ item.label }}</strong>
              <span>{{ item.note }}</span>
            </button>
          </nav>
        </div>
      </aside>

      <main
        ref="settingsMainRef"
        class="settings-main"
        :class="{ 'settings-main--scrollbar-hover': settingsScrollbarHovered }"
        @pointermove="updateSettingsScrollbarHover"
        @pointerleave="clearSettingsScrollbarHover"
      >
        <GeneralSettingsSection
          v-if="currentSectionId === 'general'"
          :breadcrumb-items="breadcrumbItems"
          :connection-state="connectionState"
          :system-version="systemVersion"
          :system-platform="systemPlatform"
          :uptime-label="uptimeLabel"
          :team-count="teamCount"
          :member-count="memberCount"
          :agent-count="agentCount"
          :total-message-count="totalMessageCount"
          :driver-states="driverStates"
          @navigate-breadcrumb="handleBreadcrumbNavigate"
        />

        <TeamsSettingsSection
          v-else-if="currentSectionId === 'teams'"
          :breadcrumb-items="breadcrumbItems"
          :selected-team-detail="selectedTeamDetail"
          :team-info-draft="teamInfoDraft"
          :has-team-info-changes="hasTeamInfoChanges"
          :is-saving-team-info="isSavingTeamInfo"
          :team-info-status="teamInfoStatus"
          :team-summaries="teamSummaries"
          :teams="teams"
          :format-date-time="formatDateTime"
          @navigate-breadcrumb="handleBreadcrumbNavigate"
          @create-team="openCreateTeam"
          @open-team-detail="openTeamDetail"
          @clear-team-detail="clearTeamDetail"
          @save-team-info="saveTeamInfo"
          @reset-team-info-draft="resetTeamInfoDraft"
          @tree-saved="handleTeamTreeSaved"
          @update:name="teamInfoDraft.name = $event"
          @update:working-directory="teamInfoDraft.workingDirectory = $event"
          @update:slogan="teamInfoDraft.slogan = $event"
          @update:rules="teamInfoDraft.rules = $event"
        />

        <RolesSettingsSection
          v-else-if="currentSectionId === 'roles'"
          :breadcrumb-items="breadcrumbItems"
          @navigate-breadcrumb="handleBreadcrumbNavigate"
        />

        <ModelsSettingsSection
          v-else-if="currentSectionId === 'models'"
          :breadcrumb-items="breadcrumbItems"
          @navigate-breadcrumb="handleBreadcrumbNavigate"
        />

        <RuntimeSettingsSection
          v-else
          :breadcrumb-items="breadcrumbItems"
          @navigate-breadcrumb="handleBreadcrumbNavigate"
        />
      </main>
    </div>
  </section>
</template>

<style scoped>
.settings-shell {
  height: 100%;
  min-height: 0;
  padding: 10px 12px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 0;
}

.settings-head,
.section-head,
.sidebar-card-head,
.table-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.settings-head-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.settings-head {
  position: relative;
  z-index: 2;
  background: var(--panel-bg);
  padding-bottom: 8px;
  border-bottom: 1px solid var(--divider);
}

.settings-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.breadcrumb-link {
  position: relative;
  border: none;
  background: transparent;
  color: var(--hint-text);
  padding: 0;
  cursor: pointer;
  font-size: 0.72rem;
  line-height: 1.2;
}

.breadcrumb-link:not(:last-child)::after {
  content: '/';
  margin-left: 6px;
  color: var(--panel-border);
}

.breadcrumb-link.current {
  color: var(--text-strong);
  cursor: default;
}

.breadcrumb-link:hover:not(.current) {
  color: var(--accent);
}

.settings-title-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.settings-eyebrow,
.section-eyebrow {
  margin: 0;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
  flex: 0 0 auto;
}

.settings-head h2,
.section-head h3 {
  margin: 0;
  color: var(--text-strong);
}

.settings-head h2 {
  flex: 0 1 auto;
  margin: 0;
  font-size: 1.72rem;
  line-height: 1.04;
}

.settings-layout {
  min-height: 0;
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 10px;
}

.settings-sidebar,
.settings-main {
  min-height: 0;
}

.settings-sidebar {
  padding-top: 10px;
}

.sidebar-card,
.config-section,
.placeholder-card,
.status-card,
.metric-card,
.driver-card,
.team-card,
.empty-card,
.field-card,
.table-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.sidebar-card {
  height: 100%;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-card-head span,
.section-status,
.field-card span,
.placeholder-card span {
  color: var(--muted);
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.nav-link {
  width: 100%;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: inherit;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease;
}

.nav-link strong {
  display: block;
  color: var(--text-strong);
  font-size: 0.82rem;
}

.nav-link span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.7rem;
}

.nav-link:hover {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 52%, var(--panel-bg) 48%);
}

.nav-link.active {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 60%, var(--panel-bg) 40%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 40%, transparent);
}

.settings-main {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 4px 0 0;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--focus-border) 16%, var(--panel-border) 84%) transparent;
}

.settings-main::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.settings-main::-webkit-scrollbar-track {
  background: transparent;
}

.settings-main::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--focus-border) 16%, var(--panel-border) 84%);
  border: 2px solid transparent;
  background-clip: padding-box;
  min-height: 56px;
}

.settings-main.settings-main--scrollbar-hover::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--focus-border) 46%, var(--panel-border) 54%);
}

.settings-main.settings-main--scrollbar-hover {
  scrollbar-color: color-mix(in srgb, var(--focus-border) 46%, var(--panel-border) 54%) transparent;
}

.settings-main::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--focus-border) 58%, var(--panel-border) 42%);
}

.config-section {
  padding: 12px 14px;
}

.form-grid,
.placeholder-grid,
.status-grid,
.metric-grid,
.teams-grid {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}

.form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.placeholder-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.status-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.teams-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.teams-list-head {
  grid-column: 1 / -1;
  margin-bottom: 2px;
}

.field-card,
.placeholder-card,
.status-card,
.metric-card,
.driver-card {
  padding: 10px;
}

.team-card,
.empty-card {
  padding: 9px 10px;
  border-color: color-mix(in srgb, var(--focus-border) 42%, var(--panel-border) 58%);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 18%, transparent),
    0 6px 16px rgba(0, 0, 0, 0.08);
}

.field-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-card-wide {
  grid-column: 1 / -1;
}

.field-card input,
.field-card textarea {
  width: 100%;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: var(--panel-bg);
  color: var(--text-strong);
  padding: 8px 10px;
  outline: none;
}

.field-card input:focus,
.field-card textarea:focus {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 2px var(--focus-glow);
}

.placeholder-card strong {
  display: block;
  margin-top: 4px;
  color: var(--text-strong);
}

.status-card span,
.metric-card span {
  color: var(--muted);
}

.status-card strong,
.metric-card strong {
  display: block;
  margin-top: 4px;
  color: var(--text-strong);
  line-height: 1.35;
}

.metric-card strong {
  font-size: 1.32rem;
}

.placeholder-card p {
  margin: 6px 0 0;
  color: var(--muted);
  line-height: 1.4;
  font-size: 0.78rem;
}

.driver-card {
  margin-top: 10px;
}

.driver-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.driver-head h4 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1rem;
}

.driver-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.driver-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: var(--panel-bg);
}

.driver-meta strong {
  display: block;
  color: var(--text-strong);
}

.driver-meta span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.74rem;
}

.driver-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(248, 81, 73, 0.12);
  color: var(--danger);
  font-size: 0.74rem;
  font-weight: 600;
}

.driver-badge.online {
  background: rgba(86, 212, 176, 0.14);
  color: var(--good);
}

.team-card-head,
.team-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.team-card-title-group {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.team-card-head strong,
.empty-card strong {
  color: var(--text-strong);
  font-size: 0.9rem;
  line-height: 1.15;
  margin: 0;
}

.team-card-id {
  color: var(--hint-text);
  font-size: 0.68rem;
  white-space: nowrap;
}

.team-card-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 54px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(248, 81, 73, 0.12);
  color: var(--danger);
  font-size: 0.64rem;
  font-weight: 600;
}

.team-card-badge.enabled {
  background: rgba(86, 212, 176, 0.14);
  color: var(--good);
}

.team-card-summary {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 7px;
}

.team-summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.team-summary-chip {
  min-width: 0;
  max-width: 100%;
  padding: 4px 7px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 22%, var(--panel-border) 78%);
  border-radius: 999px;
  background: var(--panel-bg);
  color: var(--muted);
  font-size: 0.68rem;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-card-footer {
  margin-top: 7px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.team-last-active {
  min-width: 0;
  color: var(--hint-text);
  font-size: 0.64rem;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.team-card-actions {
  margin-top: 0;
  justify-content: flex-end;
}

.team-detail-head {
  margin-top: 4px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.team-detail-head h4 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1rem;
}

.team-detail-head .section-eyebrow {
  margin-bottom: 2px;
}

.team-detail-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.team-detail-status {
  color: var(--muted);
  font-size: 0.72rem;
}

.team-detail-stack {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 10px;
  min-height: 0;
  align-items: start;
}

.empty-card p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.35;
}

.table-card {
  margin-top: 10px;
  overflow: hidden;
}

.table-row {
  padding: 8px 10px;
  border-top: 1px solid var(--panel-border);
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 1fr 0.7fr;
  color: var(--text-strong);
  font-size: 0.84rem;
}

.table-row:first-child {
  border-top: none;
}

.table-row-head {
  color: var(--muted);
  background: color-mix(in srgb, var(--panel-bg) 55%, transparent);
}

@media (max-width: 1100px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    min-height: auto;
  }

  .sidebar-card {
    height: auto;
  }

  .settings-nav {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  }
}

@media (max-width: 780px) {
  .form-grid,
  .placeholder-grid,
  .status-grid,
  .metric-grid,
  .teams-grid {
    grid-template-columns: 1fr;
  }

  .table-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .team-card-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .team-detail-head {
    flex-direction: column;
  }

  .team-detail-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
