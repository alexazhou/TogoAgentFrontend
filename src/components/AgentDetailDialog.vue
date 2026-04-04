<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getAgentDetail } from '../api';
import type { AgentDetail } from '../types';

const props = defineProps<{
  open: boolean;
  teamId: number | null;
  agentName: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const agent = ref<AgentDetail | null>(null);
const loading = ref(false);
const errorMessage = ref('');

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

async function loadDetail(): Promise<void> {
  if (!props.open || props.teamId === null || !props.agentName) {
    agent.value = null;
    errorMessage.value = '';
    loading.value = false;
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  agent.value = null;

  try {
    agent.value = await getAgentDetail(props.teamId, props.agentName);
  } catch (error) {
    errorMessage.value = 'Agent 信息加载失败。';
    console.error(error);
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.open, props.teamId, props.agentName],
  () => {
    loadDetail().catch(console.error);
  },
  { immediate: true },
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="agent-detail-overlay" @click.self="emit('close')">
      <section class="agent-detail-dialog panel">
        <div class="agent-detail-head">
          <div>
            <p class="agent-detail-eyebrow">Agent Card</p>
            <h3>{{ agent?.name ?? agentName ?? 'Agent' }}</h3>
          </div>
          <button type="button" class="secondary-button" @click="emit('close')">关闭</button>
        </div>

        <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>
        <div v-else-if="loading" class="loading-card">正在加载 Agent 信息…</div>

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
              <h4>Prompt</h4>
              <span>{{ agent.prompt.length }} 字符</span>
            </div>
            <pre>{{ agent.prompt }}</pre>
          </section>
        </template>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.agent-detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(112, 133, 160, 0.22);
  backdrop-filter: blur(6px);
}

.agent-detail-dialog {
  width: min(1080px, calc(100vw - 56px));
  max-height: min(760px, calc(100vh - 56px));
  overflow: auto;
  padding: 18px;
  border-radius: 22px;
  box-shadow:
    0 20px 48px rgba(40, 67, 102, 0.16),
    inset 0 0 0 1px color-mix(in srgb, var(--panel-border) 88%, transparent);
}

.agent-detail-head,
.prompt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.agent-detail-head {
  margin-bottom: 18px;
}

.agent-detail-eyebrow {
  margin: 0 0 4px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
}

.agent-detail-head h3,
.prompt-head h4 {
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

.loading-card,
.error-banner {
  padding: 14px;
}

.error-banner {
  border-radius: 10px;
  background: var(--banner-error-bg);
  color: var(--banner-error-text);
  border: 1px solid var(--banner-error-border);
}

@media (max-width: 720px) {
  .agent-detail-overlay {
    padding: 12px;
  }

  .agent-detail-dialog {
    width: min(100vw - 24px, 100%);
    max-height: calc(100vh - 24px);
    padding: 14px;
  }

  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
