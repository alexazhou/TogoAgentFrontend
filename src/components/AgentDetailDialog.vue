<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getAgentDetail, resumeAgent } from '../api';
import { showGlobalSuccessToast } from '../appUiState';
import AgentCardBase from './AgentCardBase.vue';
import type { AgentDetail, AgentStatus } from '../types';

const props = defineProps<{
  open: boolean;
  agentId: number | null;
  agentName: string | null;
  agentStatus?: AgentStatus | null;
  roleTemplateName?: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const agent = ref<AgentDetail | null>(null);
const loading = ref(false);
const resuming = ref(false);
const errorMessage = ref('');

const currentStatus = computed<AgentStatus | null>(() => {
  if (props.agentStatus) {
    return props.agentStatus;
  }
  return agent.value?.status ?? null;
});

const statusLabel = computed(() => {
  if (!currentStatus.value) {
    return '';
  }
  if (currentStatus.value === 'active') {
    return '忙碌';
  }
  if (currentStatus.value === 'failed') {
    return '失败';
  }
  return '空闲';
});

const failureMessage = computed(() => {
  if (currentStatus.value !== 'failed') {
    return '';
  }
  return agent.value?.error_message?.trim() ?? '';
});

const failurePreview = computed(() => {
  const message = failureMessage.value;
  if (!message) {
    return '';
  }
  const preview = message.slice(0, 320).trimEnd();
  if (preview.length === message.length) {
    return preview;
  }
  return `${preview}...`;
});

const agentTemplateLabel = computed(() => {
  if (props.roleTemplateName?.trim()) {
    return props.roleTemplateName.trim();
  }
  if (!agent.value) {
    return '未配置模板';
  }
  if (typeof agent.value.role_template_id === 'number' && agent.value.role_template_id > 0) {
    return `模板 #${agent.value.role_template_id}`;
  }
  return '未配置模板';
});

async function loadDetail(): Promise<void> {
  if (!props.open || props.agentId === null) {
    agent.value = null;
    errorMessage.value = '';
    loading.value = false;
    return;
  }

  loading.value = true;
  errorMessage.value = '';
  agent.value = null;

  try {
    agent.value = await getAgentDetail(props.agentId);
  } catch (error) {
    errorMessage.value = 'Agent 信息加载失败。';
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function handleResume(): Promise<void> {
  if (props.agentId === null || currentStatus.value !== 'failed' || resuming.value) {
    return;
  }

  resuming.value = true;

  try {
    await resumeAgent(props.agentId);
    showGlobalSuccessToast('已触发重试');
  } catch (error) {
    console.error(error);
  } finally {
    resuming.value = false;
  }
}

async function copyFailureMessage(): Promise<void> {
  if (!failureMessage.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(failureMessage.value);
    showGlobalSuccessToast('已复制完整报错');
  } catch (error) {
    console.error(error);
  }
}

watch(
  () => [props.open, props.agentId, props.agentName],
  () => {
    loadDetail().catch(console.error);
  },
  { immediate: true },
);

watch(
  () => currentStatus.value,
  (status, previousStatus) => {
    if (
      props.open
      && props.agentId !== null
      && status === 'failed'
      && previousStatus !== 'failed'
    ) {
      loadDetail().catch(console.error);
    }
  },
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
          <section class="agent-detail-stage">
            <div class="agent-detail-stage__left">
              <div class="agent-detail-stage__card-stack">
                <AgentCardBase
                  :title="agent.name"
                  :subtitle="agentTemplateLabel"
                  :overline="agent.team_name || ''"
                  :employee-number="String(agent.employee_number ?? '')"
                  :avatar-name="agent.name"
                  variant="leader"
                  readonly
                />
                <div class="agent-status-panel" :data-status="currentStatus ?? undefined">
                  <span class="status-dot" :class="{ 'status-dot-pulse': currentStatus === 'active' }"></span>
                  <span class="agent-status-panel__value">{{ statusLabel }}</span>
                  <button
                    v-if="currentStatus === 'failed'"
                    type="button"
                    class="agent-status-panel__action"
                    :disabled="resuming"
                    @click="handleResume"
                  >
                    {{ resuming ? '重试中…' : '重试' }}
                  </button>
                </div>
                <div v-if="failureMessage" class="agent-error-panel">
                  <p class="agent-error-message">{{ failurePreview }}</p>
                  <button type="button" class="agent-error-panel__copy" @click="copyFailureMessage">
                    复制全部
                  </button>
                </div>
              </div>
            </div>
            <div class="agent-detail-stage__right"></div>
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

.agent-detail-head {
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

.agent-detail-stage,
.loading-card {
  background: transparent;
}

.agent-detail-stage {
  min-height: 420px;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
  padding: 8px 0 0;
}

.agent-detail-stage__left {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
}

.agent-detail-stage__card-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.agent-detail-stage__card-stack :deep(.entity-card) {
  cursor: default;
  transform: translateY(-18px) scale(1.28);
  transform-origin: center;
}

.agent-detail-stage__card-stack :deep(.entity-card:hover) {
  transform: translateY(-18px) scale(1.28);
}

.agent-status-panel {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  white-space: nowrap;
  font-size: 0.96rem;
  line-height: 1;
}

.agent-status-panel__value {
  color: inherit;
  font-size: inherit;
  font-weight: 500;
  line-height: inherit;
}

.agent-status-panel__action {
  height: 22px;
  padding: 0 8px;
  border: 1px solid currentColor;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font-size: 0.7rem;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
}

.agent-status-panel__action:disabled {
  opacity: 0.7;
  cursor: wait;
}

.agent-status-panel[data-status='failed'] {
  color: var(--danger, #f85149);
}

.agent-error-panel {
  width: min(260px, 100%);
  margin: -8px 0 0;
}

.agent-error-message {
  margin: 0;
  max-height: 150px;
  overflow: hidden;
  color: color-mix(in srgb, var(--danger, #f85149) 88%, var(--text) 12%);
  font-size: 0.76rem;
  line-height: 1.45;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-line-clamp: 8;
  -webkit-box-orient: vertical;
}

.agent-error-panel__copy {
  margin-top: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 0.75rem;
  line-height: 1;
  cursor: pointer;
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
  background: var(--good);
  animation: agent-dot-pulse 2s ease-in-out infinite;
}

.agent-status-panel[data-status='failed'] .status-dot {
  background: var(--danger, #f85149);
  box-shadow: none;
}

@keyframes agent-dot-pulse {
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

.agent-detail-stage__right {
  min-height: 100%;
  border-radius: 18px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--surface-quiet) 68%, transparent), transparent 58%);
}

.loading-card,
.error-banner {
  padding: 14px;
}

.loading-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
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

  .agent-detail-stage {
    grid-template-columns: 1fr;
    min-height: 0;
    padding: 8px 0 0;
    gap: 18px;
  }

  .agent-detail-stage__right {
    min-height: 180px;
  }
}
</style>
