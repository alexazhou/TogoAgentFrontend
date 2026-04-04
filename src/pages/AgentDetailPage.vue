<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { totalMessageCount } from '../appUiState';
import { getAgentDetail } from '../api';
import type { AgentDetail } from '../types';

const route = useRoute();

const agent = ref<AgentDetail | null>(null);
const loading = ref(true);
const errorMessage = ref('');

const teamId = computed(() => Number(route.params.teamId));
const agentName = computed(() => String(route.params.agentName ?? ''));

async function loadDetail(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  totalMessageCount.value = 0;

  try {
    agent.value = await getAgentDetail(teamId.value, agentName.value);
  } catch (error) {
    errorMessage.value = 'Agent 详情加载失败。';
    console.error(error);
  } finally {
    loading.value = false;
  }
}

watch([() => route.params.teamId, () => route.params.agentName], () => {
  loadDetail().catch(console.error);
});

onMounted(() => {
  loadDetail().catch(console.error);
});

const statusLabel = computed(() => {
  if (!agent.value) {
    return '';
  }
  if (agent.value.status === 'active') {
    return '忙碌';
  }
  if (agent.value.status === 'failed') {
    return '失败';
  }
  return '空闲';
});
</script>

<template>
  <section class="page panel">
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Agent Card</p>
        <h2>{{ agent?.name ?? agentName }}</h2>
      </div>
      <button type="button" class="secondary-button" @click="$router.back()">返回</button>
    </div>

    <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>
    <div v-else-if="loading" class="loading-card">正在加载 Agent 详情…</div>

    <template v-else-if="agent">
      <div class="summary-grid">
        <article class="summary-card">
          <span>预设模板</span>
          <strong>{{ agent.agent_name }}</strong>
        </article>
        <article class="summary-card">
          <span>模型</span>
          <strong>{{ agent.model }}</strong>
        </article>
        <article class="summary-card">
          <span>团队</span>
          <strong>{{ agent.team_name }}</strong>
        </article>
        <article class="summary-card">
          <span>状态</span>
          <strong>{{ statusLabel }}</strong>
        </article>
        <article class="summary-card">
          <span>Driver</span>
          <strong>{{ agent.driver_type }}</strong>
        </article>
      </div>

      <section class="prompt-card">
        <div class="prompt-head">
          <h3>Prompt</h3>
          <span>{{ agent.prompt.length }} 字符</span>
        </div>
        <pre>{{ agent.prompt }}</pre>
      </section>
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
.prompt-head {
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
.prompt-head h3 {
  margin: 0;
  color: var(--text-strong);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.summary-card,
.prompt-card,
.loading-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.summary-card {
  padding: 16px;
}

.summary-card span,
.prompt-head span {
  color: var(--muted);
}

.summary-card strong {
  display: block;
  margin-top: 8px;
  color: var(--text-strong);
}

.prompt-card {
  padding: 16px;
}

.prompt-card pre {
  margin: 14px 0 0;
  border-radius: 12px;
  background: var(--surface-quiet);
  color: var(--text-strong);
  padding: 16px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: 'IBM Plex Mono', 'SFMono-Regular', monospace;
  line-height: 1.45;
}

.page-head .secondary-button {
  height: 40px;
  padding: 0 14px;
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
