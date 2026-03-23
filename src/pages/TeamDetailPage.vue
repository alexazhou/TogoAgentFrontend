<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { totalMessageCount } from '../appUiState';
import { getTeamDetail } from '../api';
import type { TeamDetail } from '../types';

const route = useRoute();
const router = useRouter();

const team = ref<TeamDetail | null>(null);
const loading = ref(true);
const errorMessage = ref('');

const teamId = computed(() => Number(route.params.teamId));

async function loadDetail(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  totalMessageCount.value = 0;

  try {
    team.value = await getTeamDetail(teamId.value);
  } catch (error) {
    errorMessage.value = '团队详情加载失败。';
    console.error(error);
  } finally {
    loading.value = false;
  }
}

function openAgent(agentName: string): void {
  router.push({ name: 'agent-detail', params: { teamId: teamId.value, agentName } }).catch(console.error);
}

watch(() => route.params.teamId, () => {
  loadDetail().catch(console.error);
});

onMounted(() => {
  loadDetail().catch(console.error);
});
</script>

<template>
  <section class="page panel">
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Team Snapshot</p>
        <h2>{{ team?.name ?? '团队详情' }}</h2>
      </div>
      <button type="button" class="secondary-button" @click="$router.back()">返回</button>
    </div>

    <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>
    <div v-else-if="loading" class="loading-card">正在加载团队详情…</div>

    <template v-else-if="team">
      <div class="summary-grid">
        <article class="summary-card">
          <span>团队 ID</span>
          <strong>{{ team.id }}</strong>
        </article>
        <article class="summary-card">
          <span>最大函数调用</span>
          <strong>{{ team.max_function_calls ?? '未设置' }}</strong>
        </article>
        <article class="summary-card">
          <span>创建时间</span>
          <strong>{{ team.created_at }}</strong>
        </article>
        <article class="summary-card">
          <span>更新时间</span>
          <strong>{{ team.updated_at }}</strong>
        </article>
      </div>

      <div class="detail-grid">
        <section class="detail-card">
          <div class="detail-head">
            <h3>成员列表</h3>
            <span>{{ team.members.length }}</span>
          </div>
          <div class="member-list">
            <button
              v-for="member in team.members"
              :key="member"
              type="button"
              class="member-chip"
              @click="openAgent(member)"
            >
              {{ member }}
            </button>
          </div>
        </section>

        <section class="detail-card">
          <div class="detail-head">
            <h3>聊天室</h3>
            <span>{{ team.rooms.length }}</span>
          </div>
          <div class="room-list">
            <article v-for="room in team.rooms" :key="room.id" class="room-card">
              <div class="room-title">
                <strong>{{ room.name }}</strong>
                <span>{{ room.members.length }} 人</span>
              </div>
              <p>{{ room.initial_topic || '无初始话题' }}</p>
              <small>max_turns = {{ room.max_turns }}</small>
            </article>
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.page {
  height: 100%;
  overflow: auto;
  padding: 22px;
}

.page-head,
.detail-head,
.room-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-head {
  margin-bottom: 20px;
}

.page-eyebrow {
  margin: 0 0 4px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
}

.page-head h2,
.detail-head h3 {
  margin: 0;
  color: var(--text-strong);
}

.summary-grid,
.detail-grid {
  display: grid;
  gap: 16px;
}

.summary-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-bottom: 16px;
}

.summary-card,
.detail-card,
.loading-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.summary-card {
  padding: 16px;
}

.summary-card span,
.room-card p,
.room-card small {
  color: var(--muted);
}

.summary-card strong {
  display: block;
  margin-top: 8px;
  color: var(--text-strong);
}

.detail-card {
  padding: 16px;
}

.member-list,
.room-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.member-list {
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
}

.member-chip,
.secondary-button {
  height: 40px;
  border-radius: 10px;
}

.member-chip {
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  color: var(--text-strong);
  cursor: pointer;
}

.room-card {
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: var(--panel-bg);
  padding: 14px;
}

.room-card p {
  margin: 8px 0;
}

.secondary-button {
  border: 1px solid var(--panel-border);
  background: var(--pill-bg);
  color: var(--text-strong);
  padding: 0 14px;
  cursor: pointer;
}

.loading-card,
.error-banner {
  padding: 14px;
}

.error-banner {
  border-radius: 10px;
  background: var(--banner-error-bg);
  color: var(--banner-error-text);
}
</style>
