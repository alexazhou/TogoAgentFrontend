<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getAgents, getTeamDetail, updateTeam } from '../api';
import { connectionState, totalMessageCount } from '../appUiState';
import TeamInfoCard from '../components/TeamInfoCard.vue';
import TeamMembersCard from '../components/TeamMembersCard.vue';
import { loadTeams, teams } from '../teamStore';
import type { AgentInfo, TeamDetail } from '../types';

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
const teamSummaries = ref<Record<number, { memberCount: number; roomCount: number }>>({});
const selectedTeamDetail = ref<TeamDetail | null>(null);
const isEditingTeamMembers = ref(false);
const teamMembersDraft = ref<string[]>([]);
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
const selectedTeamMembers = computed(() => (
  isEditingTeamMembers.value
    ? teamMembersDraft.value
    : selectedTeamDetail.value?.members.map((member) => member.name) ?? []
));
const hasTeamInfoChanges = computed(() => {
  if (!selectedTeamDetail.value) {
    return false;
  }

  return (
    teamInfoDraft.value.workingDirectory !== (selectedTeamDetail.value.working_directory || '') ||
    teamInfoDraft.value.slogan !== String(selectedTeamDetail.value.config?.slogan || '') ||
    teamInfoDraft.value.rules !== String(selectedTeamDetail.value.config?.rules || '')
  );
});
const hasTeamMemberChanges = computed(() => {
  if (!selectedTeamDetail.value) {
    return false;
  }

  const currentMembers = selectedTeamDetail.value.members.map((member) => member.name);
  return JSON.stringify(teamMembersDraft.value) !== JSON.stringify(currentMembers);
});
const hasTeamChanges = computed(() => hasTeamInfoChanges.value || hasTeamMemberChanges.value);
const breadcrumbItems = computed(() => {
  const items = [
    { key: 'settings', label: '系统设置', action: () => openSection(defaultSectionId), current: false },
    {
      key: `section-${currentNavItem.value.id}`,
      label: currentNavItem.value.label,
      action: () => openSection(currentNavItem.value.id),
      current: detailTeamId.value === null,
    },
  ];

  if (currentSectionId.value === 'teams' && selectedTeamDetail.value) {
    items[items.length - 1].current = false;
    items.push({
      key: 'team-detail',
      label: '团队详情',
      action: () => clearTeamDetail(),
      current: true,
    });
  }

  return items;
});
const memberPanelActions = computed(() => {
  if (isEditingTeamMembers.value) {
    return [
      { key: 'cancel', label: '取消', disabled: isSavingTeamInfo.value },
      {
        key: 'save',
        label: isSavingTeamInfo.value ? '保存中...' : '保存',
        disabled: !hasTeamChanges.value || isSavingTeamInfo.value,
        primary: true,
      },
    ];
  }

  return [
    { key: 'edit', label: '编辑', disabled: isSavingTeamInfo.value },
  ];
});

function openSection(sectionId: string): void {
  router.push({
    name: 'settings',
    params: { teamId: teamId.value, section: sectionId },
    query: sectionId === 'teams' && detailTeamId.value ? { detailTeamId: String(detailTeamId.value) } : {},
  }).catch(console.error);
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

function openAgentDetail(agentName: string): void {
  router.push({
    name: 'agent-detail',
    params: {
      teamId: teamId.value,
      agentName,
    },
  }).catch(console.error);
}

async function loadTeamSummaries(): Promise<void> {
  const entries = await Promise.all(
    teams.value.map(async (team) => {
      try {
        const detail = await getTeamDetail(team.id);
        return [team.id, { memberCount: detail.members.length, roomCount: detail.rooms.length }] as const;
      } catch (error) {
        console.error(error);
        return [team.id, { memberCount: 0, roomCount: 0 }] as const;
      }
    }),
  );
  teamSummaries.value = Object.fromEntries(entries);
}

async function loadSelectedTeamDetail(targetTeamId: number | null): Promise<void> {
  if (targetTeamId === null) {
    selectedTeamDetail.value = null;
    isEditingTeamMembers.value = false;
    teamMembersDraft.value = [];
    teamInfoStatus.value = '';
    return;
  }

  try {
    selectedTeamDetail.value = await getTeamDetail(targetTeamId);
    teamInfoDraft.value = {
      name: selectedTeamDetail.value.name,
      workingDirectory: selectedTeamDetail.value.working_directory || '',
      slogan: String(selectedTeamDetail.value.config?.slogan || ''),
      rules: String(selectedTeamDetail.value.config?.rules || ''),
    };
    teamMembersDraft.value = selectedTeamDetail.value.members.map((member) => member.name);
    isEditingTeamMembers.value = false;
    teamInfoStatus.value = '';
  } catch (error) {
    console.error(error);
    selectedTeamDetail.value = null;
  }
}

async function saveTeamInfo(): Promise<void> {
  if (!selectedTeamDetail.value || isSavingTeamInfo.value || !hasTeamChanges.value) {
    return;
  }

  isSavingTeamInfo.value = true;
  teamInfoStatus.value = '';

  try {
    await updateTeam(selectedTeamDetail.value.id, {
      working_directory: teamInfoDraft.value.workingDirectory,
      config: {
        ...(selectedTeamDetail.value.config || {}),
        slogan: teamInfoDraft.value.slogan,
        rules: teamInfoDraft.value.rules,
      },
      members: teamMembersDraft.value.map((agentName) => {
        const existingMember = selectedTeamDetail.value?.members.find((member) => member.name === agentName);
        return {
          name: agentName,
          role_template: existingMember?.role_template || agentName,
        };
      }),
    });
    await Promise.all([
      loadSelectedTeamDetail(selectedTeamDetail.value.id),
      loadTeamSummaries(),
      loadTeams(),
    ]);
    isEditingTeamMembers.value = false;
    teamInfoStatus.value = '已保存';
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

  teamInfoDraft.value = {
    name: selectedTeamDetail.value.name,
    workingDirectory: selectedTeamDetail.value.working_directory || '',
    slogan: String(selectedTeamDetail.value.config?.slogan || ''),
    rules: String(selectedTeamDetail.value.config?.rules || ''),
  };
  teamMembersDraft.value = selectedTeamDetail.value.members.map((member) => member.name);
  isEditingTeamMembers.value = false;
  teamInfoStatus.value = '';
}

function toggleTeamMemberEdit(): void {
  if (!selectedTeamDetail.value) {
    return;
  }

  teamMembersDraft.value = selectedTeamDetail.value.members.map((member) => member.name);
  isEditingTeamMembers.value = true;
}

function cancelTeamMemberEdit(): void {
  if (!selectedTeamDetail.value) {
    return;
  }

  teamMembersDraft.value = selectedTeamDetail.value.members.map((member) => member.name);
  isEditingTeamMembers.value = false;
}

function handleMemberPanelAction(actionKey: string): void {
  if (actionKey === 'edit') {
    toggleTeamMemberEdit();
    return;
  }

  if (actionKey === 'cancel') {
    cancelTeamMemberEdit();
    return;
  }

  if (actionKey === 'save') {
    saveTeamInfo();
  }
}

function toggleTeamMember(agentName: string): void {
  if (!isEditingTeamMembers.value) {
    return;
  }

  if (teamMembersDraft.value.includes(agentName)) {
    teamMembersDraft.value = teamMembersDraft.value.filter((item) => item !== agentName);
    return;
  }

  teamMembersDraft.value = [...teamMembersDraft.value, agentName];
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
  loadTeamSummaries().catch(console.error);
});

onBeforeUnmount(() => {
  if (uptimeTimer !== null) {
    window.clearInterval(uptimeTimer);
    uptimeTimer = null;
  }
});
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

      <main class="settings-main">
        <section v-if="currentSectionId === 'general'" id="general" class="config-section">
          <nav class="settings-breadcrumb" aria-label="当前位置">
            <button
              v-for="item in breadcrumbItems"
              :key="item.key"
              type="button"
              class="breadcrumb-link"
              :class="{ current: item.current }"
              @click="!item.current && item.action()"
            >
              {{ item.label }}
            </button>
          </nav>
          <div class="section-head">
            <div>
              <p class="section-eyebrow">General</p>
              <h3>系统状态</h3>
            </div>
            <span class="section-status">{{ connectionState === 'connected' ? '已连接' : '状态采集中' }}</span>
          </div>
          <div class="status-grid">
            <article class="status-card">
              <span>软件版本</span>
              <strong>{{ systemVersion }}</strong>
            </article>
            <article class="status-card">
              <span>系统平台</span>
              <strong>{{ systemPlatform }}</strong>
            </article>
            <article class="status-card">
              <span>运行时间</span>
              <strong>{{ uptimeLabel }}</strong>
            </article>
          </div>

          <div class="metric-grid">
            <article class="metric-card">
              <span>团队数量</span>
              <strong>{{ teamCount }}</strong>
            </article>
            <article class="metric-card">
              <span>团队成员数量</span>
              <strong>{{ memberCount }}</strong>
            </article>
            <article class="metric-card">
              <span>Agent 数量</span>
              <strong>{{ agentCount }}</strong>
            </article>
            <article class="metric-card">
              <span>消息数量</span>
              <strong>{{ totalMessageCount }}</strong>
            </article>
          </div>

          <section class="driver-card">
            <div class="driver-head">
              <div>
                <p class="section-eyebrow">Drivers</p>
                <h4>底层驱动状态</h4>
              </div>
            </div>
            <div class="driver-list">
              <div v-for="driver in driverStates" :key="driver.key" class="driver-row">
                <div class="driver-meta">
                  <strong>{{ driver.label }}</strong>
                  <span>{{ driver.note }}</span>
                </div>
                <span class="driver-badge" :class="{ online: driver.available }">
                  {{ driver.available ? '可用' : '不可用' }}
                </span>
              </div>
            </div>
          </section>
        </section>

        <section v-else-if="currentSectionId === 'teams'" id="teams" class="config-section">
          <nav class="settings-breadcrumb" aria-label="当前位置">
            <button
              v-for="item in breadcrumbItems"
              :key="item.key"
              type="button"
              class="breadcrumb-link"
              :class="{ current: item.current }"
              @click="!item.current && item.action()"
            >
              {{ item.label }}
            </button>
          </nav>

          <template v-if="selectedTeamDetail">
            <div class="team-detail-head">
              <div>
                <p class="section-eyebrow">Team Detail</p>
                <h4>{{ selectedTeamDetail.name }}</h4>
              </div>
              <div class="team-detail-actions">
                <span v-if="teamInfoStatus" class="team-detail-status">{{ teamInfoStatus }}</span>
                <button
                  v-if="hasTeamChanges"
                  type="button"
                  class="ghost-button"
                  :disabled="isSavingTeamInfo"
                  @click="resetTeamInfoDraft"
                >
                  重置
                </button>
                <button
                  type="button"
                  class="secondary-button"
                  :disabled="!hasTeamChanges || isSavingTeamInfo"
                  @click="saveTeamInfo"
                >
                  {{ isSavingTeamInfo ? '保存中...' : '保存变更' }}
                </button>
                <button type="button" class="secondary-button" @click="clearTeamDetail">返回团队列表</button>
              </div>
            </div>

            <div class="team-detail-stack">
              <TeamInfoCard
                :name="teamInfoDraft.name"
                :working-directory="teamInfoDraft.workingDirectory"
                :slogan="teamInfoDraft.slogan"
                :rules="teamInfoDraft.rules"
                :editable-name="false"
                @update:working-directory="teamInfoDraft.workingDirectory = $event"
                @update:slogan="teamInfoDraft.slogan = $event"
                @update:rules="teamInfoDraft.rules = $event"
              />

              <TeamMembersCard
                :team-name="selectedTeamDetail.name"
                :selected-agents="selectedTeamMembers"
                :readonly="!isEditingTeamMembers"
                :actions="memberPanelActions"
                @action="handleMemberPanelAction"
                @toggle-agent="toggleTeamMember"
                @view-agent="openAgentDetail"
              />
            </div>
          </template>

          <div v-else class="teams-grid">
            <div class="section-head teams-list-head">
              <div></div>
              <button type="button" class="secondary-button" @click="openCreateTeam">新建团队</button>
            </div>
            <article v-for="team in teams" :key="team.id" class="team-card">
              <div class="team-card-head">
                <div class="team-card-title-group">
                  <strong>{{ team.name }}</strong>
                  <span class="team-card-id">#{{ team.id }}</span>
                </div>
                <span class="team-card-badge" :class="{ enabled: team.enabled }">
                  {{ team.enabled ? '启用中' : '已停用' }}
                </span>
              </div>
              <div class="team-card-summary">
                <div class="team-summary-row">
                  <span class="team-summary-chip">成员 {{ teamSummaries[team.id]?.memberCount ?? 0 }}</span>
                  <span class="team-summary-chip">房间 {{ teamSummaries[team.id]?.roomCount ?? 0 }}</span>
                </div>
                <div class="team-summary-row">
                  <span class="team-summary-chip team-summary-chip-path">目录 {{ team.working_directory || '未设置' }}</span>
                </div>
              </div>
              <div class="team-card-footer">
                <span class="team-last-active">最后活跃 {{ formatDateTime(team.updated_at) }}</span>
                <div class="team-card-actions">
                <button type="button" class="ghost-button" @click="openTeamDetail(team.id)">查看详情</button>
                </div>
              </div>
            </article>
            <article v-if="teams.length === 0" class="empty-card">
              <strong>当前没有团队</strong>
              <p>先创建一个团队，再继续配置成员、角色和模型服务。</p>
            </article>
          </div>
        </section>

        <section v-else-if="currentSectionId === 'roles'" id="roles" class="config-section">
          <nav class="settings-breadcrumb" aria-label="当前位置">
            <button
              v-for="item in breadcrumbItems"
              :key="item.key"
              type="button"
              class="breadcrumb-link"
              :class="{ current: item.current }"
              @click="!item.current && item.action()"
            >
              {{ item.label }}
            </button>
          </nav>
          <div class="section-head">
            <div>
              <p class="section-eyebrow">Roles</p>
              <h3>角色管理</h3>
            </div>
            <span class="section-status">占位区</span>
          </div>
          <div class="table-card">
            <div class="table-row table-row-head">
              <span>角色</span>
              <span>模板</span>
              <span>模型</span>
              <span>状态</span>
            </div>
            <div class="table-row">
              <span>software_engineer</span>
              <span>工程类角色模板</span>
              <span>glm-4.7</span>
              <span>启用</span>
            </div>
            <div class="table-row">
              <span>researcher</span>
              <span>检索类角色模板</span>
              <span>glm-4.7</span>
              <span>启用</span>
            </div>
          </div>
        </section>

        <section v-else-if="currentSectionId === 'models'" id="models" class="config-section">
          <nav class="settings-breadcrumb" aria-label="当前位置">
            <button
              v-for="item in breadcrumbItems"
              :key="item.key"
              type="button"
              class="breadcrumb-link"
              :class="{ current: item.current }"
              @click="!item.current && item.action()"
            >
              {{ item.label }}
            </button>
          </nav>
          <div class="section-head">
            <div>
              <p class="section-eyebrow">Models</p>
              <h3>大模型服务管理</h3>
            </div>
            <span class="section-status">占位区</span>
          </div>
          <div class="placeholder-grid">
            <article class="placeholder-card">
              <span>默认服务</span>
              <strong>dashscope / openai-compatible</strong>
              <p>预留服务选择、鉴权信息、超时和重试等配置。</p>
            </article>
            <article class="placeholder-card">
              <span>调用策略</span>
              <strong>按场景分配模型</strong>
              <p>预留聊天、工具调用、摘要等模型路由与配额策略。</p>
            </article>
          </div>
        </section>

        <section v-else id="runtime" class="config-section">
          <nav class="settings-breadcrumb" aria-label="当前位置">
            <button
              v-for="item in breadcrumbItems"
              :key="item.key"
              type="button"
              class="breadcrumb-link"
              :class="{ current: item.current }"
              @click="!item.current && item.action()"
            >
              {{ item.label }}
            </button>
          </nav>
          <div class="section-head">
            <div>
              <p class="section-eyebrow">Runtime</p>
              <h3>运行与存储</h3>
            </div>
            <span class="section-status">占位区</span>
          </div>
          <div class="form-grid">
            <label class="field-card">
              <span>工作目录</span>
              <input type="text" placeholder="/path/to/workspace" />
            </label>
            <label class="field-card">
              <span>日志目录</span>
              <input type="text" placeholder="/path/to/logs" />
            </label>
            <label class="field-card field-card-wide">
              <span>运行说明</span>
              <textarea rows="5" placeholder="这里预留运行参数、存储策略、备份说明等内容。"></textarea>
            </label>
          </div>
        </section>
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
  gap: 10px;
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
  padding-right: 4px;
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

.ghost-button {
  height: 24px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  color: var(--text-strong);
  padding: 0 7px;
  cursor: pointer;
  font-size: 0.68rem;
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

.secondary-button {
  height: 32px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: var(--pill-bg);
  color: var(--text-strong);
  padding: 0 10px;
  cursor: pointer;
  font-size: 0.84rem;
}

.secondary-button:disabled,
.ghost-button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
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
