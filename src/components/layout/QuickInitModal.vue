<script setup lang="ts">
import { computed, ref } from 'vue';
import { testLlmService, quickInit } from '../../api';
import type { LlmServiceTestResult, LlmServiceType } from '../../types';

const SERVICE_TYPES: { value: LlmServiceType; label: string }[] = [
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google (Gemini)' },
  { value: 'deepseek', label: 'DeepSeek' },
];

const emit = defineEmits<{
  skip: [];
  done: [];
}>();

const baseUrl = ref('');
const apiKey = ref('');
const model = ref('');
const serviceType = ref<LlmServiceType>('openai-compatible');
const apiKeyVisible = ref(false);
const isTesting = ref(false);
const isSaving = ref(false);
const testResult = ref<{ status: string; message: string; detail?: string } | null>(null);
const saveError = ref('');

const canTest = computed(() => {
  return baseUrl.value.trim() !== ''
    && apiKey.value.trim() !== ''
    && model.value.trim() !== ''
    && !isTesting.value
    && !isSaving.value;
});

const canSave = computed(() => {
  return canTest.value && !isSaving.value;
});

async function handleTest(): Promise<void> {
  isTesting.value = true;
  testResult.value = null;
  saveError.value = '';
  try {
    const result: LlmServiceTestResult = await testLlmService({
      mode: 'temp',
      base_url: baseUrl.value.trim(),
      api_key: apiKey.value.trim(),
      type: serviceType.value,
      model: model.value.trim(),
    });
    const detailParts: string[] = [];
    if (result.detail?.duration_ms !== undefined) detailParts.push(`${result.detail.duration_ms}ms`);
    if (result.detail?.response_text) detailParts.push(result.detail.response_text.slice(0, 80));
    if (result.detail?.raw_error) detailParts.push(result.detail.raw_error.slice(0, 120));
    testResult.value = {
      status: result.status,
      message: result.message,
      detail: detailParts.join(' · ') || undefined,
    };
  } catch {
    testResult.value = {
      status: 'error',
      message: '测试请求异常',
    };
  } finally {
    isTesting.value = false;
  }
}

async function handleSave(): Promise<void> {
  isSaving.value = true;
  saveError.value = '';
  try {
    const data = await quickInit({
      base_url: baseUrl.value.trim(),
      api_key: apiKey.value.trim(),
      model: model.value.trim(),
      type: serviceType.value,
    });
    if (data.status !== 'ok') {
      saveError.value = data.message || '保存失败';
      return;
    }
    emit('done');
  } catch {
    saveError.value = '保存失败，请检查输入后重试';
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="quick-init-overlay">
      <section class="quick-init-dialog panel">
        <div class="quick-init-head">
          <p class="quick-init-eyebrow">Quick Setup</p>
          <h3>快速初始化</h3>
          <p class="quick-init-desc">
            检测到当前未配置大模型服务，请先完成基础配置以启用 Agent 对话能力。
          </p>
        </div>

        <div class="quick-init-form">
          <label class="form-label">
            <span class="label-text">API 地址</span>
            <input
              v-model="baseUrl"
              type="text"
              class="form-input"
              placeholder="https://api.openai.com/v1"
              :disabled="isSaving"
            />
            <span class="form-hint">示例：OpenAI / DeepSeek / Qwen 等兼容接口</span>
          </label>

          <label class="form-label">
            <span class="label-text">服务接口类型</span>
            <select v-model="serviceType" class="form-input form-select" :disabled="isSaving">
              <option v-for="t in SERVICE_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
            </select>
          </label>

          <label class="form-label">
            <span class="label-text">API Key</span>
            <div class="input-with-toggle">
              <input
                v-model="apiKey"
                :type="apiKeyVisible ? 'text' : 'password'"
                class="form-input"
                placeholder="sk-..."
                :disabled="isSaving"
              />
              <button
                type="button"
                class="toggle-visibility"
                :title="apiKeyVisible ? '隐藏' : '显示'"
                @click="apiKeyVisible = !apiKeyVisible"
              >
                {{ apiKeyVisible ? '🙈' : '👁' }}
              </button>
            </div>
          </label>

          <label class="form-label">
            <span class="label-text">模型名称</span>
            <input
              v-model="model"
              type="text"
              class="form-input"
              placeholder="使用的模型名称，例如: gpt-4o, deepseek-chat, qwen-plus..."
              :disabled="isSaving"
            />
          </label>
        </div>

        <!-- test connection -->
        <div class="quick-init-test">
          <button
            type="button"
            class="secondary-button test-button"
            :disabled="!canTest"
            @click="handleTest"
          >
            {{ isTesting ? '测试中...' : '🔌 测试连接' }}
          </button>

          <div
            v-if="testResult"
            class="test-result"
            :class="testResult.status === 'ok' ? 'test-result--ok' : 'test-result--error'"
          >
            <strong>{{ testResult.message }}</strong>
            <p v-if="testResult.detail">{{ testResult.detail }}</p>
          </div>
        </div>

        <!-- save error -->
        <div v-if="saveError" class="save-error">{{ saveError }}</div>

        <!-- actions -->
        <div class="quick-init-actions">
          <button type="button" class="ghost-button" :disabled="isSaving" @click="emit('skip')">
            跳过
          </button>
          <button
            type="button"
            class="secondary-button save-button"
            :disabled="!canSave"
            @click="handleSave"
          >
            {{ isSaving ? '保存中...' : '完成' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.quick-init-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(6, 10, 16, 0.62);
  backdrop-filter: blur(10px);
}

.quick-init-dialog {
  width: min(480px, 100%);
  padding: 24px;
  display: grid;
  gap: 18px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--interactive-focus-border) 32%, var(--border-default) 68%);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--surface-panel) 95%, transparent) 0%,
      color-mix(in srgb, var(--surface-panel-muted) 92%, transparent) 100%
    );
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.40);
}

.quick-init-head {
  display: grid;
  gap: 6px;
}

.quick-init-eyebrow {
  margin: 0;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
}

.quick-init-head h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.18rem;
}

.quick-init-desc {
  margin: 0;
  color: var(--text-secondary);
  font-size: 0.86rem;
  line-height: 1.55;
}

.quick-init-form {
  display: grid;
  gap: 14px;
}

.form-label {
  display: grid;
  gap: 4px;
}

.label-text {
  font-size: 0.78rem;
  color: var(--text-primary);
  font-weight: 500;
}

.form-input {
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-panel-muted);
  color: var(--text-primary);
  font-size: 0.88rem;
  outline: none;
  transition: border-color 0.18s ease;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: var(--interactive-focus-border);
  box-shadow: 0 0 0 2px var(--interactive-focus-ring);
}

.form-input:disabled {
  opacity: 0.56;
}

.form-hint {
  font-size: 0.72rem;
  color: var(--text-tertiary);
}

.form-select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%237f91a4' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
}

.input-with-toggle {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-toggle .form-input {
  padding-right: 40px;
}

.toggle-visibility {
  position: absolute;
  right: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 0.88rem;
  padding: 4px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.18s ease;
}

.toggle-visibility:hover {
  opacity: 1;
}

.quick-init-test {
  display: grid;
  gap: 8px;
}

.test-button {
  width: 100%;
  height: 36px;
  font-size: 0.88rem;
}

.test-result {
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 0.82rem;
  line-height: 1.5;
}

.test-result strong {
  display: block;
}

.test-result p {
  margin: 4px 0 0;
  opacity: 0.8;
  word-break: break-word;
}

.test-result--ok {
  border: 1px solid color-mix(in srgb, var(--state-success) 38%, var(--border-default) 62%);
  background: color-mix(in srgb, var(--state-success) 10%, var(--surface-panel) 90%);
  color: var(--state-success);
}

.test-result--error {
  border: 1px solid color-mix(in srgb, var(--state-danger) 34%, var(--border-default) 66%);
  background: color-mix(in srgb, var(--state-danger) 10%, var(--surface-panel) 90%);
  color: var(--state-danger);
}

.save-error {
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--state-danger) 34%, var(--border-default) 66%);
  background: color-mix(in srgb, var(--state-danger) 10%, var(--surface-panel) 90%);
  color: var(--state-danger);
  font-size: 0.82rem;
}

.quick-init-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.quick-init-actions > .ghost-button {
  min-width: 72px;
  height: 36px;
  padding: 0 16px;
  font-size: 0.84rem;
}

.save-button {
  min-width: 88px;
  height: 36px;
  padding: 0 20px;
  font-size: 0.84rem;
  border-color: color-mix(in srgb, var(--state-success) 38%, var(--border-default) 62%);
  background: color-mix(in srgb, var(--state-success) 14%, var(--surface-panel) 86%);
}

.save-button:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--state-success) 58%, var(--interactive-focus-border) 42%);
  background: color-mix(in srgb, var(--state-success) 24%, var(--surface-panel) 76%);
}
</style>
