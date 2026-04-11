<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  createLlmService,
  deleteLlmService,
  getLlmServices,
  modifyLlmService,
  setDefaultLlmService,
  testLlmService,
} from '../../api';
import { showGlobalSuccessToast } from '../../appUiState';
import ConfirmDialog from '../ConfirmDialog.vue';
import SettingsBreadcrumb from './SettingsBreadcrumb.vue';
import type { SettingsBreadcrumbItem } from './types';
import type { LlmServiceInfo, LlmServiceType } from '../../types';

defineProps<{
  breadcrumbItems: SettingsBreadcrumbItem[];
}>();

const emit = defineEmits<{
  navigateBreadcrumb: [key: string];
}>();

const SERVICE_TYPES: { value: LlmServiceType; label: string }[] = [
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'deepseek', label: 'DeepSeek' },
];

// ── State ──

const services = ref<LlmServiceInfo[]>([]);
const defaultServer = ref<string | null>(null);
const selectedIndex = ref<number | null>(null);
const isLoading = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);
const isCreating = ref(false);
const isTesting = ref(false);
const statusText = ref('');
const deleteConfirmOpen = ref(false);
const advancedOpen = ref(false);
const testResult = ref<{ status: string; message: string; detail?: string } | null>(null);
const apiKeyVisible = ref(false);

const form = ref({
  name: '',
  base_url: '',
  api_key: '',
  type: 'openai-compatible' as LlmServiceType,
  model: '',
  enable: true,
  extra_headers: '',
  context_window_tokens: 131072,
  reserve_output_tokens: 8192,
  compact_trigger_ratio: 0.85,
  compact_summary_max_tokens: 2048,
});

// ── Computed ──

const selectedService = computed(() => {
  if (selectedIndex.value === null || selectedIndex.value >= services.value.length) return null;
  return services.value[selectedIndex.value];
});

const isDefault = computed(() => {
  return selectedService.value?.name === defaultServer.value;
});

const canDelete = computed(() => {
  return !isCreating.value && selectedService.value !== null && !isDefault.value && !isDeleting.value;
});

const canSetDefault = computed(() => {
  return !isCreating.value && selectedService.value !== null && !isDefault.value && selectedService.value.enable;
});

type FormSnapshot = {
  name: string;
  base_url: string;
  api_key: string;
  type: string;
  model: string;
  enable: boolean;
  extra_headers: string;
  context_window_tokens: number;
  reserve_output_tokens: number;
  compact_trigger_ratio: number;
  compact_summary_max_tokens: number;
};

function buildSnapshot(f: typeof form.value): FormSnapshot {
  return {
    name: f.name.trim(),
    base_url: f.base_url.trim(),
    api_key: f.api_key.trim(),
    type: f.type,
    model: f.model.trim(),
    enable: f.enable,
    extra_headers: f.extra_headers.trim(),
    context_window_tokens: f.context_window_tokens,
    reserve_output_tokens: f.reserve_output_tokens,
    compact_trigger_ratio: f.compact_trigger_ratio,
    compact_summary_max_tokens: f.compact_summary_max_tokens,
  };
}

function serviceToFormSnapshot(s: LlmServiceInfo): FormSnapshot {
  return {
    name: s.name.trim(),
    base_url: s.base_url.trim(),
    api_key: s.api_key.trim(),
    type: s.type,
    model: s.model.trim(),
    enable: s.enable,
    extra_headers: serializeHeaders(s.extra_headers),
    context_window_tokens: s.context_window_tokens ?? 131072,
    reserve_output_tokens: s.reserve_output_tokens ?? 8192,
    compact_trigger_ratio: s.compact_trigger_ratio ?? 0.85,
    compact_summary_max_tokens: s.compact_summary_max_tokens ?? 2048,
  };
}

const isDirty = computed(() => {
  if (isCreating.value) return true;
  if (!selectedService.value) return false;
  return JSON.stringify(buildSnapshot(form.value)) !== JSON.stringify(serviceToFormSnapshot(selectedService.value));
});

const canSave = computed(() => {
  if (isSaving.value) return false;
  if (isCreating.value) {
    return form.value.name.trim().length > 0
      && form.value.base_url.trim().length > 0
      && form.value.api_key.trim().length > 0
      && form.value.model.trim().length > 0;
  }
  return isDirty.value;
});

// ── Helpers ──

function serializeHeaders(headers: Record<string, string> | undefined | null): string {
  if (!headers) return '';
  const entries = Object.entries(headers).filter(([k, v]) => k && v);
  if (!entries.length) return '';
  return entries.map(([k, v]) => `${k}: ${v}`).join('\n');
}

function parseHeaders(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && value) result[key] = value;
    }
  }
  return result;
}

function resetForm(service?: LlmServiceInfo | null): void {
  form.value = {
    name: service?.name ?? '',
    base_url: service?.base_url ?? '',
    api_key: service?.api_key ?? '',
    type: service?.type ?? 'openai-compatible',
    model: service?.model ?? 'qwen-plus',
    enable: service?.enable ?? true,
    extra_headers: service ? serializeHeaders(service.extra_headers) : '',
    context_window_tokens: service?.context_window_tokens ?? 131072,
    reserve_output_tokens: service?.reserve_output_tokens ?? 8192,
    compact_trigger_ratio: service?.compact_trigger_ratio ?? 0.85,
    compact_summary_max_tokens: service?.compact_summary_max_tokens ?? 2048,
  };
  apiKeyVisible.value = false;
  testResult.value = null;
}

// ── Data Loading ──

async function loadServices(preferredIndex?: number | null): Promise<void> {
  const data = await getLlmServices();
  services.value = data.llm_services;
  defaultServer.value = data.default_llm_server;

  if (preferredIndex !== null && preferredIndex !== undefined && preferredIndex < data.llm_services.length) {
    selectService(preferredIndex);
  } else if (data.llm_services.length > 0) {
    selectService(0);
  } else {
    selectedIndex.value = null;
    resetForm(null);
  }
}

async function loadAll(preferredIndex?: number | null): Promise<void> {
  isLoading.value = true;
  statusText.value = '';
  try {
    await loadServices(preferredIndex);
  } catch (error) {
    console.error(error);
    statusText.value = '加载失败';
  } finally {
    isLoading.value = false;
  }
}

// ── Actions ──

function selectService(index: number): void {
  selectedIndex.value = index;
  isCreating.value = false;
  advancedOpen.value = false;
  statusText.value = '';
  testResult.value = null;
  apiKeyVisible.value = false;
  resetForm(services.value[index]);
}

function startCreate(): void {
  isCreating.value = true;
  selectedIndex.value = null;
  advancedOpen.value = false;
  statusText.value = '';
  testResult.value = null;
  resetForm(null);
}

function toggleAdvanced(): void {
  advancedOpen.value = !advancedOpen.value;
}

async function saveService(): Promise<void> {
  if (!canSave.value) return;
  isSaving.value = true;
  statusText.value = '';

  try {
    const headers = parseHeaders(form.value.extra_headers);

    if (isCreating.value) {
      const payload: Record<string, unknown> = {
        name: form.value.name.trim(),
        base_url: form.value.base_url.trim(),
        api_key: form.value.api_key.trim(),
        type: form.value.type,
        model: form.value.model.trim(),
        enable: form.value.enable,
        context_window_tokens: form.value.context_window_tokens,
        reserve_output_tokens: form.value.reserve_output_tokens,
        compact_trigger_ratio: form.value.compact_trigger_ratio,
        compact_summary_max_tokens: form.value.compact_summary_max_tokens,
      };
      if (Object.keys(headers).length) payload.extra_headers = headers;

      const result = await createLlmService(payload);
      await loadServices(result.index);
      showGlobalSuccessToast('服务已创建');
    } else if (selectedIndex.value !== null && selectedService.value) {
      const current = selectedService.value;
      const updates: Record<string, unknown> = {};

      if (form.value.base_url.trim() !== current.base_url) updates.base_url = form.value.base_url.trim();
      if (form.value.api_key.trim() !== current.api_key) updates.api_key = form.value.api_key.trim();
      if (form.value.type !== current.type) updates.type = form.value.type;
      if (form.value.model.trim() !== current.model) updates.model = form.value.model.trim();
      if (form.value.enable !== current.enable) updates.enable = form.value.enable;
      if (form.value.context_window_tokens !== current.context_window_tokens) updates.context_window_tokens = form.value.context_window_tokens;
      if (form.value.reserve_output_tokens !== current.reserve_output_tokens) updates.reserve_output_tokens = form.value.reserve_output_tokens;
      if (form.value.compact_trigger_ratio !== current.compact_trigger_ratio) updates.compact_trigger_ratio = form.value.compact_trigger_ratio;
      if (form.value.compact_summary_max_tokens !== current.compact_summary_max_tokens) updates.compact_summary_max_tokens = form.value.compact_summary_max_tokens;

      const newHeaders = parseHeaders(form.value.extra_headers);
      if (JSON.stringify(newHeaders) !== JSON.stringify(current.extra_headers)) {
        updates.extra_headers = newHeaders;
      }

      if (Object.keys(updates).length > 0) {
        await modifyLlmService(selectedIndex.value, updates);
        await loadServices(selectedIndex.value);
        showGlobalSuccessToast('服务已保存');
      }
    }
    statusText.value = '已保存';
  } catch (error) {
    console.error(error);
    statusText.value = '保存失败';
  } finally {
    isSaving.value = false;
  }
}

function requestDelete(): void {
  if (!canDelete.value) return;
  deleteConfirmOpen.value = true;
}

async function confirmDelete(): Promise<void> {
  if (selectedIndex.value === null) {
    deleteConfirmOpen.value = false;
    return;
  }
  isDeleting.value = true;
  statusText.value = '';
  try {
    await deleteLlmService(selectedIndex.value);
    deleteConfirmOpen.value = false;
    await loadServices(null);
    showGlobalSuccessToast('服务已删除');
  } catch (error) {
    console.error(error);
    statusText.value = '删除失败';
  } finally {
    isDeleting.value = false;
  }
}

async function handleSetDefault(): Promise<void> {
  if (!canSetDefault.value || selectedIndex.value === null) return;
  try {
    await setDefaultLlmService(selectedIndex.value);
    await loadServices(selectedIndex.value);
    showGlobalSuccessToast('已设为默认服务');
  } catch (error) {
    console.error(error);
  }
}

async function handleTest(): Promise<void> {
  isTesting.value = true;
  testResult.value = null;
  try {
    let result;
    if (!isCreating.value && selectedIndex.value !== null) {
      result = await testLlmService({ mode: 'saved', index: selectedIndex.value });
    } else {
      result = await testLlmService({
        mode: 'temp',
        base_url: form.value.base_url.trim(),
        api_key: form.value.api_key.trim(),
        type: form.value.type,
        model: form.value.model.trim(),
        extra_headers: parseHeaders(form.value.extra_headers),
      });
    }
    const detailParts: string[] = [];
    if (result.detail?.duration_ms !== undefined) detailParts.push(`${result.detail.duration_ms}ms`);
    if (result.detail?.response_text) detailParts.push(result.detail.response_text.slice(0, 80));
    if (result.detail?.raw_error) detailParts.push(result.detail.raw_error.slice(0, 120));
    testResult.value = {
      status: result.status,
      message: result.message,
      detail: detailParts.join(' · ') || undefined,
    };
  } catch (error) {
    testResult.value = {
      status: 'error',
      message: '测试请求异常',
      detail: String(error),
    };
  } finally {
    isTesting.value = false;
  }
}

onMounted(() => {
  loadAll().catch(console.error);
});
</script>

<template>
  <section id="models" class="config-section">
    <SettingsBreadcrumb :items="breadcrumbItems" @navigate="emit('navigateBreadcrumb', $event)" />

    <div class="section-head">
      <div>
        <p class="section-eyebrow">Models</p>
        <h3>大模型服务管理</h3>
      </div>
      <div class="section-actions">
        <span v-if="statusText" class="section-status">{{ statusText }}</span>
        <button type="button" class="secondary-button" @click="startCreate">新增服务</button>
      </div>
    </div>

    <div class="models-layout">
      <!-- 左侧 - 服务列表 -->
      <aside class="models-list-card">
        <div class="models-list-head">
          <strong>服务列表</strong>
          <span>{{ services.length }} 个</span>
        </div>

        <p v-if="isLoading" class="models-empty">正在加载...</p>

        <div v-else-if="services.length" class="models-list">
          <button
            v-for="(svc, idx) in services"
            :key="idx"
            type="button"
            class="svc-row"
            :class="{ active: !isCreating && selectedIndex === idx }"
            @click="selectService(idx)"
          >
            <div class="svc-row-main">
              <div class="svc-row-title">
                <div class="svc-row-name">
                  <strong>{{ svc.name }}</strong>
                  <span v-if="svc.name === defaultServer" class="svc-chip svc-chip--default">默认</span>
                  <span v-if="!svc.enable" class="svc-chip svc-chip--disabled">已禁用</span>
                </div>
              </div>
              <p class="svc-row-meta">{{ svc.type }} · {{ svc.model }}</p>
            </div>
          </button>
        </div>

        <p v-else class="models-empty">尚未配置任何 LLM 服务。</p>
      </aside>

      <!-- 右侧 - 编辑表单 -->
      <section class="svc-editor-card">
        <div class="svc-editor-head">
          <div>
            <p class="section-eyebrow">{{ isCreating ? 'New Service' : 'Service Detail' }}</p>
            <h4>{{ isCreating ? '新增 LLM 服务' : (form.name || '服务详情') }}</h4>
          </div>
          <div class="svc-editor-badges">
            <span
              v-if="!isCreating && isDefault"
              class="svc-chip svc-chip--default"
            >默认服务</span>
            <span
              v-if="isCreating"
              class="svc-chip svc-chip--draft"
            >未保存</span>
          </div>
        </div>

        <!-- 基本字段 -->
        <div class="svc-form-grid">
          <label class="svc-field">
            <span>服务名称</span>
            <input
              v-model="form.name"
              type="text"
              class="svc-input"
              :class="{ 'svc-input--readonly': !isCreating }"
              placeholder="例如：dashscope"
              :readonly="!isCreating"
            />
          </label>

          <label class="svc-field">
            <span>服务类型</span>
            <select v-model="form.type" class="svc-input svc-select">
              <option v-for="t in SERVICE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </label>

          <label class="svc-field svc-field--wide">
            <span>Base URL</span>
            <input
              v-model="form.base_url"
              type="text"
              class="svc-input"
              placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
            />
          </label>

          <label class="svc-field svc-field--wide">
            <span>API Key</span>
            <div class="svc-input-group">
              <input
                v-model="form.api_key"
                :type="apiKeyVisible ? 'text' : 'password'"
                class="svc-input svc-input--flex"
                placeholder="sk-..."
              />
              <button type="button" class="ghost-button" @click="apiKeyVisible = !apiKeyVisible">
                {{ apiKeyVisible ? '隐藏' : '显示' }}
              </button>
            </div>
          </label>

          <label class="svc-field">
            <span>模型名称</span>
            <input
              v-model="form.model"
              type="text"
              class="svc-input"
              placeholder="例如：qwen-plus"
            />
          </label>

          <label class="svc-field svc-field--toggle">
            <span>启用状态</span>
            <label class="toggle-switch">
              <input v-model="form.enable" type="checkbox" />
              <span class="toggle-track"></span>
              <span class="toggle-label">{{ form.enable ? '已启用' : '已禁用' }}</span>
            </label>
          </label>
        </div>

        <!-- 高级设置 -->
        <section class="advanced-card">
          <button
            type="button"
            class="advanced-toggle"
            :aria-expanded="advancedOpen"
            @click="toggleAdvanced"
          >
            <div>
              <p class="section-eyebrow">Advanced</p>
              <strong>高级设置</strong>
            </div>
            <span class="advanced-toggle__state">{{ advancedOpen ? '收起' : '展开' }}</span>
          </button>

          <div v-if="advancedOpen" class="advanced-grid">
            <label class="svc-field">
              <span>上下文窗口 (tokens)</span>
              <input v-model.number="form.context_window_tokens" type="number" class="svc-input" min="1024" />
            </label>

            <label class="svc-field">
              <span>输出预留 (tokens)</span>
              <input v-model.number="form.reserve_output_tokens" type="number" class="svc-input" min="256" />
            </label>

            <label class="svc-field">
              <span>Compact 触发比例</span>
              <input v-model.number="form.compact_trigger_ratio" type="number" class="svc-input" min="0" max="1" step="0.01" />
            </label>

            <label class="svc-field">
              <span>摘要上限 (tokens)</span>
              <input v-model.number="form.compact_summary_max_tokens" type="number" class="svc-input" min="256" />
            </label>

            <label class="svc-field svc-field--wide">
              <span>Extra Headers（每行一条，格式 Key: Value）</span>
              <textarea
                v-model="form.extra_headers"
                class="svc-textarea"
                rows="3"
                placeholder="X-Custom-Header: value"
              ></textarea>
            </label>
          </div>
        </section>

        <!-- 连通性测试 -->
        <div class="test-section">
          <button
            type="button"
            class="secondary-button"
            :disabled="isTesting || (!isCreating && selectedIndex === null)"
            @click="handleTest"
          >
            {{ isTesting ? '测试中...' : '连通性测试' }}
          </button>
          <div v-if="testResult" class="test-result" :class="testResult.status === 'ok' ? 'test-result--ok' : 'test-result--error'">
            <strong>{{ testResult.message }}</strong>
            <p v-if="testResult.detail">{{ testResult.detail }}</p>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="svc-editor-actions">
          <button
            v-if="canSetDefault"
            type="button"
            class="ghost-button"
            @click="handleSetDefault"
          >
            设为默认
          </button>
          <button
            v-if="canDelete"
            type="button"
            class="secondary-button secondary-button--danger"
            :disabled="isDeleting"
            @click="requestDelete"
          >
            {{ isDeleting ? '删除中...' : '删除服务' }}
          </button>
          <button
            type="button"
            class="secondary-button"
            :disabled="!canSave"
            @click="saveService"
          >
            {{ isSaving ? '保存中...' : (isCreating ? '创建服务' : '保存修改') }}
          </button>
        </div>
      </section>
    </div>

    <ConfirmDialog
      :open="deleteConfirmOpen"
      title="删除 LLM 服务"
      :message="`确认删除服务「${selectedService?.name || ''}」？删除后无法恢复。`"
      confirm-label="删除"
      danger
      @close="deleteConfirmOpen = false"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.config-section,
.models-list-card,
.svc-editor-card,
.svc-row {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.config-section {
  padding: 12px 14px;
}

.section-head,
.section-actions,
.models-list-head,
.svc-editor-head,
.svc-editor-badges,
.svc-editor-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-eyebrow {
  margin: 0;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
}

.section-head h3,
.svc-editor-head h4 {
  margin: 0;
  color: var(--text-strong);
}

.section-status,
.models-empty,
.models-list-head span {
  color: var(--muted);
}

/* Layout */
.models-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: 10px;
  margin-top: 10px;
  align-items: start;
}

.models-list-card,
.svc-editor-card {
  padding: 12px;
}

.models-list {
  margin-top: 10px;
  display: grid;
  gap: 6px;
}

.models-empty {
  margin-top: 10px;
  font-size: 0.86rem;
}

/* Service row */
.svc-row {
  width: 100%;
  padding: 10px;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease;
}

.svc-row.active,
.svc-row:hover {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 68%, var(--surface-soft) 32%);
}

.svc-row-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.svc-row-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.svc-row-name {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.svc-row-name strong {
  color: var(--text-strong);
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.svc-row-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.76rem;
}

/* Chips */
.svc-chip {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  color: var(--muted);
  font-size: 0.68rem;
  white-space: nowrap;
}

.svc-chip--default {
  border-color: color-mix(in srgb, var(--good) 38%, var(--panel-border) 62%);
  background: color-mix(in srgb, var(--good) 12%, var(--panel-bg) 88%);
  color: var(--good);
}

.svc-chip--disabled {
  border-color: color-mix(in srgb, var(--warn) 28%, var(--panel-border) 72%);
  background: color-mix(in srgb, var(--warn) 8%, var(--panel-bg) 92%);
  color: var(--warn);
}

.svc-chip--draft {
  border-color: color-mix(in srgb, var(--panel-border) 88%, var(--focus-border) 12%);
  background: color-mix(in srgb, var(--surface-soft) 82%, var(--panel-bg) 18%);
  color: var(--muted);
}

/* Editor */
.svc-editor-card {
  display: grid;
  gap: 12px;
  align-self: start;
}

.svc-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.svc-field {
  display: grid;
  gap: 6px;
}

.svc-field--wide {
  grid-column: 1 / -1;
}

.svc-field--toggle {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.svc-field > span {
  color: var(--muted);
  font-size: 0.76rem;
}

.svc-input,
.svc-textarea,
.svc-select {
  width: 100%;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: var(--text-strong);
  padding: 10px 12px;
  font: inherit;
  font-size: 0.88rem;
  box-sizing: border-box;
}

.svc-select {
  appearance: auto;
  cursor: pointer;
}

.svc-input--readonly {
  border: 1px dashed color-mix(in srgb, var(--focus-border) 18%, var(--panel-border) 82%);
  background: color-mix(in srgb, var(--surface-soft) 86%, var(--panel-bg) 14%);
  color: color-mix(in srgb, var(--muted) 84%, var(--text-strong) 16%);
  -webkit-text-fill-color: color-mix(in srgb, var(--muted) 84%, var(--text-strong) 16%);
}

.svc-input[readonly] {
  cursor: default;
}

.svc-input--flex {
  flex: 1;
  min-width: 0;
}

.svc-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.svc-textarea {
  resize: vertical;
  min-height: 60px;
}

/* Toggle switch */
.toggle-switch {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.toggle-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.toggle-track {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  border-radius: 10px;
  background: var(--panel-border);
  transition: background 160ms ease;
}

.toggle-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 160ms ease;
}

.toggle-switch input:checked + .toggle-track {
  background: var(--good);
}

.toggle-switch input:checked + .toggle-track::after {
  transform: translateX(16px);
}

.toggle-label {
  color: var(--muted);
  font-size: 0.82rem;
}

/* Advanced section */
.advanced-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-soft) 84%, var(--panel-bg) 16%);
  overflow: hidden;
}

.advanced-toggle {
  width: 100%;
  min-height: 56px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.advanced-toggle strong {
  color: var(--text-strong);
  font-size: 0.96rem;
}

.advanced-toggle__state {
  color: var(--muted);
  font-size: 0.8rem;
}

.advanced-grid {
  padding: 0 14px 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

/* Test section */
.test-section {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.test-result {
  flex: 1;
  min-width: 180px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 0.84rem;
  line-height: 1.5;
}

.test-result strong {
  display: block;
}

.test-result p {
  margin: 2px 0 0;
  word-break: break-word;
}

.test-result--ok {
  border: 1px solid color-mix(in srgb, var(--good) 32%, var(--panel-border) 68%);
  background: color-mix(in srgb, var(--good) 8%, var(--panel-bg) 92%);
  color: var(--good);
}

.test-result--error {
  border: 1px solid color-mix(in srgb, var(--danger) 32%, var(--panel-border) 68%);
  background: color-mix(in srgb, var(--danger) 8%, var(--panel-bg) 92%);
  color: var(--danger);
}

/* Actions */
.svc-editor-actions {
  justify-content: flex-end;
}

.secondary-button--danger {
  border-color: color-mix(in srgb, #ef4444 30%, var(--team-create-control-border) 70%);
  background: color-mix(in srgb, #fee2e2 48%, var(--panel-bg) 52%);
}

@media (max-width: 980px) {
  .models-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .svc-form-grid,
  .advanced-grid {
    grid-template-columns: 1fr;
  }
}
</style>
