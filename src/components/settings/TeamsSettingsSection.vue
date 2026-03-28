<script setup lang="ts">
import TeamInfoCard from '../TeamInfoCard.vue';
import TeamTreeEditor from '../TeamTreeEditor.vue';
import SettingsBreadcrumb from './SettingsBreadcrumb.vue';
import type { SettingsBreadcrumbItem } from './types';
import type { TeamDetail, TeamSummary } from '../../types';

defineProps<{
  breadcrumbItems: SettingsBreadcrumbItem[];
  selectedTeamDetail: TeamDetail | null;
  teamInfoDraft: {
    name: string;
    workingDirectory: string;
    slogan: string;
    rules: string;
  };
  hasTeamInfoChanges: boolean;
  isSavingTeamInfo: boolean;
  teamInfoStatus: string;
  teamSummaries: Record<number, {
    memberCount: number;
    roomCount: number;
    deptCount: number;
    hierarchyLevelCount: number;
    workingDirectory: string;
  }>;
  teams: TeamSummary[];
  formatDateTime: (value: string) => string;
}>();

const emit = defineEmits<{
  navigateBreadcrumb: [key: string];
  createTeam: [];
  openTeamDetail: [teamId: number];
  clearTeamDetail: [];
  saveTeamInfo: [];
  resetTeamInfoDraft: [];
  treeSaved: [];
  'update:name': [value: string];
  'update:workingDirectory': [value: string];
  'update:slogan': [value: string];
  'update:rules': [value: string];
}>();
</script>

<template>
  <section id="teams" class="config-section">
    <SettingsBreadcrumb :items="breadcrumbItems" @navigate="emit('navigateBreadcrumb', $event)" />

    <template v-if="selectedTeamDetail">
      <div class="team-detail-head">
        <div>
          <div class="team-detail-title-row">
            <h4>{{ selectedTeamDetail.name }}</h4>
            <p class="section-eyebrow">Team Detail</p>
          </div>
        </div>
        <div class="team-detail-actions">
          <button type="button" class="secondary-button" @click="emit('clearTeamDetail')">返回团队列表</button>
        </div>
      </div>

      <div class="team-detail-stack">
        <TeamInfoCard
          :name="teamInfoDraft.name"
          :working-directory="teamInfoDraft.workingDirectory"
          :slogan="teamInfoDraft.slogan"
          :rules="teamInfoDraft.rules"
          :editable-name="true"
          @update:name="emit('update:name', $event)"
          @update:working-directory="emit('update:workingDirectory', $event)"
          @update:slogan="emit('update:slogan', $event)"
          @update:rules="emit('update:rules', $event)"
        >
          <template #actions>
            <span v-if="teamInfoStatus" class="team-detail-status">{{ teamInfoStatus }}</span>
            <button
              v-if="hasTeamInfoChanges"
              type="button"
              class="secondary-button team-info-action-button team-info-action-button--compact"
              :disabled="isSavingTeamInfo"
              @click="emit('resetTeamInfoDraft')"
            >
              重置
            </button>
            <button
              type="button"
              class="secondary-button team-info-action-button"
              :disabled="!hasTeamInfoChanges || isSavingTeamInfo"
              @click="emit('saveTeamInfo')"
            >
              {{ isSavingTeamInfo ? '保存中...' : '保存变更' }}
            </button>
          </template>
        </TeamInfoCard>

        <TeamTreeEditor
          :team-id="selectedTeamDetail.id"
          :team-name="selectedTeamDetail.name"
          @saved="emit('treeSaved')"
        />
      </div>
    </template>

    <div v-else class="teams-grid">
      <div class="section-head teams-list-head">
        <div class="teams-list-title-group">
          <p class="section-eyebrow">Teams</p>
          <h3>所有团队</h3>
        </div>
        <button type="button" class="secondary-button" @click="emit('createTeam')">新建团队</button>
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
            <span class="team-summary-chip">部门 {{ teamSummaries[team.id]?.deptCount ?? 0 }}</span>
            <span class="team-summary-chip">组织层级 {{ teamSummaries[team.id]?.hierarchyLevelCount ?? 0 }}</span>
          </div>
          <div class="team-summary-row">
            <span class="team-summary-chip team-summary-chip-path">目录 {{ teamSummaries[team.id]?.workingDirectory || team.working_directory || '未设置' }}</span>
          </div>
        </div>
        <div class="team-card-footer">
          <span class="team-last-active">最后活跃 {{ formatDateTime(team.updated_at) }}</span>
          <div class="team-card-actions">
            <button type="button" class="ghost-button" @click="emit('openTeamDetail', team.id)">查看详情</button>
          </div>
        </div>
      </article>
      <article v-if="teams.length === 0" class="empty-card">
        <strong>当前没有团队</strong>
        <p>先创建一个团队，再继续配置成员、角色和模型服务。</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.config-section,
.team-card,
.empty-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.config-section {
  padding: 12px 14px;
}

.section-eyebrow {
  margin: 0;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.teams-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 8px;
}

.teams-list-head {
  grid-column: 1 / -1;
  margin-bottom: 2px;
}

.teams-list-title-group h3 {
  margin: 0;
  color: var(--text-strong);
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

.team-detail-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.team-detail-head .section-eyebrow {
  margin: 0;
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

.team-info-action-button {
  min-width: 132px;
}

.team-info-action-button--compact {
  min-width: 88px;
}

.team-card,
.empty-card {
  padding: 9px 10px;
  border-color: color-mix(in srgb, var(--focus-border) 42%, var(--panel-border) 58%);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 18%, transparent),
    0 6px 16px rgba(0, 0, 0, 0.08);
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

.empty-card p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.35;
}

@media (max-width: 780px) {
  .teams-grid {
    grid-template-columns: 1fr;
  }

  .team-card-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
