<script setup lang="ts">
import { computed } from 'vue';
import AgentCardBase from './AgentCardBase.vue';
import AgentTemplateCard from './AgentTemplateCard.vue';
import type { MemberDriverOption, MemberTemplateOption } from '../composables/useMemberEditorDialog';

const props = defineProps<{
  open: boolean;
  editable: boolean;
  memberName: string;
  keyword: string;
  selectedTemplate: string;
  currentTemplateModel: string;
  driver: string;
  driverOptions: MemberDriverOption[];
  templateOptions: MemberTemplateOption[];
}>();

const emit = defineEmits<{
  close: [];
  save: [];
  'update:keyword': [value: string];
  'update:selectedTemplate': [value: string];
  'update:driver': [value: string];
}>();

const keywordModel = computed({
  get: () => props.keyword,
  set: (value: string) => emit('update:keyword', value),
});

const selectedTemplateModel = computed({
  get: () => props.selectedTemplate,
  set: (value: string) => emit('update:selectedTemplate', value),
});

const driverModel = computed({
  get: () => props.driver,
  set: (value: string) => emit('update:driver', value),
});
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="member-editor-overlay" @click.self="emit('close')">
      <section
        class="member-editor-dialog panel"
        :class="{ 'member-editor-dialog--readonly': !editable }"
      >
        <div class="member-editor-head">
          <div class="member-editor-title-row">
            <h2 class="member-editor-title">团队成员</h2>
            <p class="section-eyebrow">Team Member</p>
          </div>
        </div>

        <div class="member-editor-summary">
          <label class="member-editor-field">
            <span>成员名称</span>
            <input :value="memberName" type="text" readonly />
          </label>
          <label class="member-editor-field">
            <span>模型</span>
            <input :value="currentTemplateModel || '未设置'" type="text" readonly />
          </label>
          <label class="member-editor-field">
            <span>驱动</span>
            <select v-model="driverModel" :disabled="!editable">
              <option v-for="driverOption in driverOptions" :key="driverOption.value" :value="driverOption.value">
                {{ driverOption.label }}
              </option>
            </select>
          </label>
        </div>

        <section class="member-selected-panel">
          <div class="member-selected-head">
            <span class="panel-label">已选角色</span>
          </div>
          <div class="member-selected-body">
            <AgentCardBase
              v-if="selectedTemplate"
              class="member-selected-card"
              :title="memberName"
              :subtitle="selectedTemplate"
              :avatar-name="selectedTemplate || memberName"
              :selected="false"
              variant="featured"
            />
            <div v-else class="member-template-empty member-selected-empty">
              当前还没有选中模板
            </div>
          </div>
        </section>

        <section class="member-template-panel">
          <div class="member-template-head">
            <span class="panel-label">Agent 模板</span>
            <label class="member-template-search">
              <input
                v-model="keywordModel"
                type="text"
                placeholder="搜索模板"
                :disabled="!editable"
              />
            </label>
          </div>

          <div class="member-template-grid">
            <div
              v-for="item in templateOptions"
              :key="item.name"
              class="member-template-option"
            >
              <AgentTemplateCard
                :agent-name="item.name"
                :selected="false"
              />
              <button
                v-if="editable"
                type="button"
                class="member-template-use"
                @click="selectedTemplateModel = item.name"
              >
                使用
              </button>
            </div>

            <div v-if="!templateOptions.length" class="member-template-empty">
              当前没有可用模板
            </div>
          </div>
        </section>

        <div class="member-editor-actions">
          <button type="button" class="ghost-button" @click="emit('close')">
            {{ editable ? '取消' : '关闭' }}
          </button>
          <button
            v-if="editable"
            type="button"
            class="secondary-button"
            :disabled="!selectedTemplate"
            @click="emit('save')"
          >
            保存
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.member-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(6, 10, 16, 0.58);
  backdrop-filter: blur(8px);
}

.member-editor-dialog {
  width: min(920px, 100%);
  max-height: min(840px, calc(100vh - 40px));
  padding: 16px;
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr) auto;
  gap: 14px;
  border-radius: 20px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 32%, var(--panel-border) 68%);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--panel-bg) 94%, transparent) 0%,
      color-mix(in srgb, var(--surface-soft) 92%, transparent) 100%
    );
  box-shadow: 0 28px 72px rgba(0, 0, 0, 0.36);
}

.member-editor-head,
.member-template-head,
.member-editor-actions {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 12px;
}

.member-editor-head {
  display: grid;
  gap: 8px;
}

.member-template-head {
  justify-content: space-between;
}

.member-editor-actions {
  justify-content: flex-end;
}

.member-editor-actions > button {
  min-width: 88px;
  height: 32px;
  padding: 0 14px;
  justify-content: center;
  font-size: 0.84rem;
}

.ghost-button,
.secondary-button {
  border: 1px solid var(--team-create-control-border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: var(--text-strong);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.ghost-button:hover:not(:disabled),
.secondary-button:hover:not(:disabled) {
  border-color: var(--focus-border);
  background: var(--selected);
  transform: translateY(-1px);
}

.ghost-button:disabled,
.secondary-button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
  transform: none;
}

.member-editor-title-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.member-editor-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.72rem;
  line-height: 1.04;
}

.section-eyebrow {
  margin: 0;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
  flex: 0 0 auto;
}

.member-editor-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.member-editor-field {
  display: grid;
  gap: 6px;
}

.member-editor-field span {
  color: var(--muted);
  font-size: 0.74rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.member-editor-field input,
.member-editor-field select,
.member-template-search input {
  width: 100%;
  height: 36px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 18%, var(--panel-border) 82%);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-soft) 86%, var(--panel-bg) 14%);
  color: var(--text-strong);
  padding: 0 12px;
  outline: none;
}

.member-editor-field select {
  appearance: none;
  cursor: pointer;
}

.member-editor-dialog--readonly .member-editor-field select:disabled,
.member-editor-dialog--readonly .member-template-search input:disabled {
  opacity: 0.64;
  cursor: default;
}

.member-editor-field input[readonly] {
  cursor: default;
}

.member-selected-panel {
  display: grid;
  grid-template-rows: auto auto;
  gap: 12px;
}

.member-template-panel {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 16%, var(--panel-border) 84%);
  border-radius: 16px;
  background: color-mix(in srgb, var(--surface-soft) 74%, var(--panel-bg) 26%);
}

.member-selected-head {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 12px;
}

.member-selected-head .panel-label {
  grid-column: 2;
  justify-self: center;
}

.member-selected-body {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 126px;
}

.member-selected-card {
  pointer-events: none;
}

.member-selected-empty {
  width: min(320px, 100%);
}

.member-template-search {
  width: 168px;
}

.member-template-head {
  min-height: 30px;
}

.member-template-head .panel-label {
  font-size: 0.94rem;
}

.member-template-search input {
  height: 30px;
  padding: 0 10px;
  border-radius: 10px;
  font-size: 0.76rem;
}

.member-template-grid {
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, 78px);
  gap: 10px 12px;
  align-content: start;
  padding-top: 4px;
  padding-right: 4px;
}

.member-template-option {
  position: relative;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
}

.member-template-option > :deep(.agent-card) {
  width: 100%;
}

.member-template-option > :deep(.agent-card:hover) {
  transform: none;
}

.member-template-use {
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 6px;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 56%, var(--panel-border) 44%);
  border-radius: 8px;
  background: color-mix(in srgb, var(--selected) 88%, #fff 12%);
  color: var(--text-strong);
  font-size: 0.68rem;
  cursor: pointer;
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    background 0.16s ease,
    border-color 0.16s ease;
}

.member-template-option:hover .member-template-use,
.member-template-option:focus-within .member-template-use {
  opacity: 1;
  transform: translateY(0);
}

.member-template-use:hover {
  background: color-mix(in srgb, var(--selected) 92%, #fff 8%);
  border-color: var(--focus-border);
}

.member-template-empty {
  min-height: 120px;
  grid-column: 1 / -1;
  display: grid;
  place-items: center;
  color: var(--muted);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-soft) 78%, transparent);
}

@media (max-width: 900px) {
  .member-editor-summary {
    grid-template-columns: 1fr;
  }
}
</style>
