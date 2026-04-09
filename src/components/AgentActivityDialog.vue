<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { getAgentDetail, resumeAgent } from '../api';
import { connectionState, showGlobalSuccessToast } from '../appUiState';
import { loadAgentActivities } from '../realtime/runtimeStore';
import { useAgentActivities, useAgentStatus } from '../realtime/selectors';
import AgentCardBase from './AgentCardBase.vue';
import type {
  AgentActivity,
  AgentActivityStatus,
  AgentDetail,
  AgentStatus,
} from '../types';

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
const activityListRef = ref<HTMLElement | null>(null);
const loading = ref(false);
const activitiesLoading = ref(false);
const resuming = ref(false);
const errorMessage = ref('');
const activitiesErrorMessage = ref('');

const runtimeStatus = useAgentStatus(() => props.agentId);
const activities = useAgentActivities(() => props.agentId);

const currentStatus = computed<AgentStatus | null>(() => {
  if (runtimeStatus.value) {
    return runtimeStatus.value;
  }
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

const visibleActivities = computed(() => activities.value.slice(-30));

function activityStatusLabel(status: AgentActivityStatus): string {
  if (status === 'started') {
    return '进行中';
  }
  if (status === 'succeeded') {
    return '完成';
  }
  if (status === 'failed') {
    return '失败';
  }
  return '取消';
}

function activitySummary(activity: AgentActivity): string {
  const command = getActivityToolCommand(activity);
  if (command) {
    return command;
  }
  const detail = activity.detail.trim();
  if (detail) {
    return detail;
  }
  if (activity.error_message?.trim()) {
    return activity.error_message.trim();
  }
  return '';
}

function formatActivityTime(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  return value.replace('T', ' ').slice(0, 19);
}

function formatDuration(durationMs: number | null | undefined): string {
  if (typeof durationMs !== 'number' || Number.isNaN(durationMs) || durationMs < 0) {
    return '';
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  return `${(durationMs / 1000).toFixed(durationMs >= 10_000 ? 0 : 1)}s`;
}

function activityMetaTokens(activity: AgentActivity): string {
  const metadata = activity.metadata ?? {};
  const currentTotal = typeof metadata.current_total_tokens === 'number' ? metadata.current_total_tokens : null;
  const finalTotal = typeof metadata.final_total_tokens === 'number' ? metadata.final_total_tokens : null;
  const estimated = typeof metadata.estimated_prompt_tokens === 'number' ? metadata.estimated_prompt_tokens : null;
  const currentCompletion = typeof metadata.current_completion_tokens === 'number' ? metadata.current_completion_tokens : null;
  if (finalTotal !== null) {
    return `tokens ${finalTotal}`;
  }
  if (currentTotal !== null) {
    return `tokens ${currentTotal}`;
  }
  if (estimated !== null) {
    const runningTotal = estimated + (currentCompletion ?? 0);
    return `估算 ${runningTotal}`;
  }
  return '';
}

function getActivityModel(activity: AgentActivity): string {
  const model = activity.metadata?.model;
  return typeof model === 'string' ? model : '';
}

function getActivityToolName(activity: AgentActivity): string {
  const toolName = activity.metadata?.tool_name;
  return typeof toolName === 'string' ? toolName : '';
}

function getActivityToolCommand(activity: AgentActivity): string {
  const command = activity.metadata?.command;
  return typeof command === 'string' ? command : '';
}

async function scrollActivitiesToBottom(): Promise<void> {
  await nextTick();
  if (!activityListRef.value) {
    return;
  }
  activityListRef.value.scrollTop = activityListRef.value.scrollHeight;
}

async function loadActivities(): Promise<void> {
  if (!props.open || props.agentId === null) {
    activitiesErrorMessage.value = '';
    activitiesLoading.value = false;
    return;
  }

  activitiesLoading.value = true;
  activitiesErrorMessage.value = '';

  try {
    await loadAgentActivities(props.agentId);
    await scrollActivitiesToBottom();
  } catch (error) {
    activitiesErrorMessage.value = 'Agent 活动加载失败。';
    console.error(error);
  } finally {
    activitiesLoading.value = false;
  }
}

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
    loadActivities().catch(console.error);
  },
  { immediate: true },
);

watch(
  () => connectionState.value,
  (state, previousState) => {
    if (
      !props.open
      || props.agentId === null
      || state !== 'connected'
      || previousState === 'connected'
      || previousState === 'connecting'
    ) {
      return;
    }
    loadDetail().catch(console.error);
    loadActivities().catch(console.error);
  },
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

watch(
  () => [props.open, activitiesLoading.value, visibleActivities.value.length],
  ([open, loadingActivities, count]) => {
    if (!open || loadingActivities || count === 0) {
      return;
    }
    scrollActivitiesToBottom().catch(console.error);
  },
  { flush: 'post' },
);

watch(
  () => [props.open, activityListRef.value, visibleActivities.value.length],
  ([open, listEl, count]) => {
    if (!open || !listEl || count === 0) {
      return;
    }
    scrollActivitiesToBottom().catch(console.error);
  },
  { flush: 'post' },
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
          <button type="button" class="agent-detail-close" aria-label="关闭" @click="emit('close')">×</button>
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
            <div class="agent-detail-stage__right">
              <section class="agent-activity-panel">
                <div class="agent-activity-panel__head">
                  <div class="agent-activity-panel__title-line">
                    <h4>运行活动</h4>
                    <p class="agent-activity-panel__eyebrow">Activity</p>
                  </div>
                  <span class="agent-activity-panel__badge">WS 实时更新</span>
                </div>

                <div v-if="activitiesErrorMessage" class="error-banner">{{ activitiesErrorMessage }}</div>
                <div v-else-if="activitiesLoading" class="loading-card">正在加载 Agent 活动…</div>
                <div v-else-if="!visibleActivities.length" class="agent-activity-empty">
                  暂无活动记录。
                </div>
                <div v-else ref="activityListRef" class="agent-activity-list sidebar-scroll">
                  <article
                    v-for="activity in visibleActivities"
                    :key="activity.id"
                    class="agent-activity-item"
                    :data-status="activity.status"
                  >
                    <div class="agent-activity-item__row">
                      <span v-if="activity.status === 'started'" class="agent-activity-item__dot"></span>
                      <span v-else-if="activity.status === 'succeeded'" class="agent-activity-item__mark agent-activity-item__mark--ok">✓</span>
                      <span v-else-if="activity.status === 'failed' || activity.status === 'cancelled'" class="agent-activity-item__mark agent-activity-item__mark--fail">✗</span>
                      <strong class="agent-activity-item__title">{{ activity.title }}</strong>
                      <span class="agent-activity-item__summary" :class="{ 'agent-activity-item__summary--code': !!getActivityToolCommand(activity) }">{{ activitySummary(activity) }}</span>
                      <span class="agent-activity-item__status">{{ activityStatusLabel(activity.status) }}</span>
                      <span v-if="formatActivityTime(activity.started_at)">{{ formatActivityTime(activity.started_at) }}</span>
                      <span v-if="getActivityModel(activity)">{{ getActivityModel(activity) }}</span>
                      <span v-if="getActivityToolName(activity)">{{ getActivityToolName(activity) }}</span>
                      <span v-if="activityMetaTokens(activity)">{{ activityMetaTokens(activity) }}</span>
                      <span v-if="formatDuration(activity.duration_ms)">{{ formatDuration(activity.duration_ms) }}</span>
                    </div>
                    <p v-if="activity.error_message" class="agent-activity-item__error">{{ activity.error_message }}</p>
                  </article>
                </div>
              </section>
            </div>
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
  height: min(760px, calc(100vh - 56px));
  max-height: min(760px, calc(100vh - 56px));
  overflow: hidden;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 5px;
  padding: 0 18px 18px;
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

.agent-detail-head > div {
  transform: translateY(12px);
}

.agent-detail-close {
  width: 22px;
  height: 22px;
  margin-top: -12px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--muted);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  transform: translateY(8px);
}

.agent-detail-close:hover {
  color: var(--text-strong);
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
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 18px;
  align-items: stretch;
  padding: 0;
  overflow: hidden;
}

.agent-detail-stage__left {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  height: 100%;
}

.agent-detail-stage__card-stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 26px;
  justify-content: center;
  min-height: 100%;
}

.agent-detail-stage__card-stack :deep(.entity-card) {
  cursor: default;
  transform: scale(1.2);
  transform-origin: center;
}

.agent-detail-stage__card-stack :deep(.entity-card:hover) {
  transform: scale(1.2);
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
  min-height: 0;
}

.agent-activity-panel {
  min-height: 0;
  height: 100%;
  border-radius: 22px;
  padding: 12px;
  background: color-mix(in srgb, var(--panel-bg) 97%, var(--surface-soft) 3%);
  border: 1px solid color-mix(in srgb, var(--panel-border) 82%, white 18%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 8px;
  overflow: hidden;
}

.agent-activity-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.agent-activity-panel__title-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.agent-activity-panel__eyebrow {
  margin: 0;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
}

.agent-activity-panel__head h4 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1rem;
}

.agent-activity-panel__badge {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(125, 163, 224, 0.12);
  color: color-mix(in srgb, var(--accent) 78%, var(--text) 22%);
  font-size: 0.72rem;
  font-weight: 600;
}

.agent-activity-list {
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 6px;
  padding-right: 2px;
}

.agent-activity-empty {
  min-height: 180px;
  display: grid;
  place-items: center;
  color: var(--muted);
  border: 1px dashed color-mix(in srgb, var(--panel-border) 80%, transparent);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.48);
}

.agent-activity-item {
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--surface-soft);
  border: 1px solid var(--panel-border);
}

.agent-activity-item[data-status='started'] {
  background: rgba(125, 163, 224, 0.08);
  border: 1px solid rgba(125, 163, 224, 0.18);
  box-shadow: none;
}

.agent-activity-item[data-status='failed'] {
  border-color: color-mix(in srgb, var(--danger, #f85149) 30%, var(--panel-border));
  background: color-mix(in srgb, var(--danger, #f85149) 10%, var(--surface-soft));
}

.agent-activity-item__row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-wrap: nowrap;
}

.agent-activity-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--good);
  animation: agent-dot-pulse 2s ease-in-out infinite;
  flex: none;
}

.agent-activity-item__mark {
  flex: none;
  font-size: 0.82rem;
  font-weight: 700;
  line-height: 1;
}

.agent-activity-item__mark--ok {
  color: var(--good);
}

.agent-activity-item__mark--fail {
  color: var(--danger, #f85149);
}

.agent-activity-item__title {
  flex: none;
  color: var(--text-strong);
  font-size: 0.88rem;
  line-height: 1.2;
}

.agent-activity-item__type,
.agent-activity-item__status,
.agent-activity-item__row span {
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.2;
}

.agent-activity-item__status {
  flex: none;
  display: inline-flex;
  align-items: center;
  padding: 0 6px;
  height: 20px;
  border-radius: 999px;
  background: rgba(125, 163, 224, 0.1);
  color: color-mix(in srgb, var(--accent) 76%, var(--text) 24%);
  font-weight: 600;
}

.agent-activity-item[data-status='started'] .agent-activity-item__status {
  margin-left: 4px;
  padding: 0;
  height: auto;
  border-radius: 0;
  background: transparent;
  color: var(--accent);
}

.agent-activity-item[data-status='failed'] .agent-activity-item__status {
  background: color-mix(in srgb, var(--danger, #f85149) 12%, white 88%);
  color: var(--danger, #f85149);
}

.agent-activity-item__summary {
  min-width: 0;
  flex: 1 1 auto;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.agent-activity-item[data-status='started'] .agent-activity-item__summary {
  color: var(--muted);
}

.agent-activity-item__summary--code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.75rem;
}

.agent-activity-item__error {
  margin: 0;
  color: var(--danger, #f85149);
  font-size: 0.74rem;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
    height: min(100vh - 24px, 100%);
    max-height: calc(100vh - 24px);
    padding: 0 14px 14px;
    gap: 5px;
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

  .agent-activity-panel {
    min-height: 0;
    padding: 10px;
  }
}
</style>
