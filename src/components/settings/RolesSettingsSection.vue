<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import {
  createRoleTemplate,
  deleteRoleTemplate,
  getFrontendConfig,
  getRoleTemplateDetail,
  getRoleTemplates,
  updateRoleTemplate,
} from '../../api';
import { showGlobalSuccessToast } from '../../appUiState';
import ConfirmDialog from '../ConfirmDialog.vue';
import CustomSelect from '../CustomSelect.vue';
import SettingsBreadcrumb from './SettingsBreadcrumb.vue';
import type { SettingsBreadcrumbItem } from './types';
import type { FrontendDriverType, RoleTemplateDetail, RoleTemplateSummary } from '../../types';

defineProps<{
  breadcrumbItems: SettingsBreadcrumbItem[];
}>();

const emit = defineEmits<{
  navigateBreadcrumb: [key: string];
}>();

const templates = ref<RoleTemplateSummary[]>([]);
const driverOptions = ref<FrontendDriverType[]>([]);
const selectedTemplateId = ref<number | null>(null);
const currentDetail = ref<RoleTemplateDetail | null>(null);
const isLoading = ref(false);
const isSaving = ref(false);
const isDeleting = ref(false);
const isCreating = ref(false);
const advancedOpen = ref(false);
const statusText = ref('');
const deleteConfirmOpen = ref(false);
const form = ref({
  name: '',
  soul: '',
  model: '',
  driver: '',
  allowedToolsText: '',
});

type RoleTemplateFormSnapshot = {
  name: string;
  soul: string;
  model: string;
  driver: string | null;
  allowed_tools: string[] | null;
};

function equalsIgnoreCase(value: string | null | undefined, expected: string): boolean {
  return String(value ?? '').trim().toLowerCase() === expected.toLowerCase();
}

function isSystemType(type: string | null | undefined): boolean {
  return equalsIgnoreCase(type, 'system');
}

const currentTypeLabel = computed(() => {
  if (isSystemType(currentDetail.value?.type)) {
    return '系统模板';
  }
  if (equalsIgnoreCase(currentDetail.value?.type, 'user')) {
    return '用户模板';
  }
  return '未定义';
});

const isSystemTemplate = computed(() => isSystemType(currentDetail.value?.type));
const canDelete = computed(() => !isCreating.value && !!currentDetail.value && !isSystemTemplate.value && !isDeleting.value);
const isNameReadonly = computed(() => !isCreating.value && isSystemTemplate.value);
const isSystemReadonlyFields = computed(() => !isCreating.value && isSystemTemplate.value);
const formSnapshot = computed<RoleTemplateFormSnapshot>(() => ({
  name: form.value.name.trim(),
  soul: form.value.soul,
  model: form.value.model.trim(),
  driver: normalizeNullableText(form.value.driver),
  allowed_tools: normalizeAllowedToolsList(parseAllowedTools()),
}));
const currentDetailSnapshot = computed<RoleTemplateFormSnapshot | null>(() => {
  if (!currentDetail.value) {
    return null;
  }
  return {
    name: currentDetail.value.name.trim(),
    soul: currentDetail.value.soul,
    model: currentDetail.value.model.trim(),
    driver: normalizeNullableText(currentDetail.value.driver),
    allowed_tools: normalizeAllowedToolsList(currentDetail.value.allowed_tools),
  };
});
const isDirty = computed(() => {
  if (isCreating.value) {
    return true;
  }
  if (!currentDetailSnapshot.value) {
    return false;
  }
  return JSON.stringify(formSnapshot.value) !== JSON.stringify(currentDetailSnapshot.value);
});
const canSave = computed(() => {
  if (isSaving.value) {
    return false;
  }
  if (isCreating.value) {
    return form.value.name.trim().length > 0;
  }
  return !!currentDetail.value && !isSystemTemplate.value && isDirty.value;
});

const driverSelectOptions = computed(() => [
  { value: '', label: '自动' },
  ...driverOptions.value.map((driver) => ({
    value: driver.name,
    label: driver.name,
  })),
]);

function buildSoulPreview(soul: string | undefined): string {
  const normalized = String(soul ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return '暂无 Soul 预览';
  }
  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
}

function resetForm(detail?: RoleTemplateDetail | null): void {
  form.value = {
    name: detail?.name || '',
    soul: detail?.soul || '',
    model: detail?.model || '',
    driver: detail?.driver || '',
    allowedToolsText: (detail?.allowed_tools ?? []).join(', '),
  };
}

function parseAllowedTools(): string[] | null {
  const items = form.value.allowedToolsText
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

function normalizeAllowedToolsList(value: string[] | null | undefined): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const normalized = value
    .map((item) => String(item).trim())
    .filter(Boolean);
  return normalized.length ? normalized : null;
}

async function loadTemplateList(preferredId?: number | null): Promise<void> {
  const nextTemplates = await getRoleTemplates();
  templates.value = nextTemplates;

  const availableId = preferredId && nextTemplates.some((template) => template.id === preferredId)
    ? preferredId
    : nextTemplates[0]?.id ?? null;

  if (availableId === null) {
    selectedTemplateId.value = null;
    currentDetail.value = null;
    if (!isCreating.value) {
      resetForm(null);
    }
    return;
  }

  await selectTemplate(availableId);
}

async function loadRoleSettings(preferredId?: number | null): Promise<void> {
  isLoading.value = true;
  statusText.value = '';
  try {
    const frontendConfig = await getFrontendConfig();
    driverOptions.value = frontendConfig.driver_types;
    await loadTemplateList(preferredId);
  } catch (error) {
    console.error(error);
    statusText.value = '加载失败';
  } finally {
    isLoading.value = false;
  }
}

async function selectTemplate(templateId: number): Promise<void> {
  selectedTemplateId.value = templateId;
  isCreating.value = false;
  advancedOpen.value = false;
  statusText.value = '';
  const detail = await getRoleTemplateDetail(templateId);
  currentDetail.value = detail;
  resetForm(detail);
}

function startCreate(): void {
  isCreating.value = true;
  selectedTemplateId.value = null;
  currentDetail.value = null;
  advancedOpen.value = false;
  statusText.value = '';
  resetForm(null);
}

function toggleAdvanced(): void {
  advancedOpen.value = !advancedOpen.value;
}

async function saveCurrentTemplate(): Promise<void> {
  if (!canSave.value) {
    return;
  }

  isSaving.value = true;
  statusText.value = '';
  try {
    if (isCreating.value) {
      const created = await createRoleTemplate({
        name: form.value.name.trim(),
        soul: form.value.soul,
        model: form.value.model.trim(),
        driver: form.value.driver || null,
        allowed_tools: parseAllowedTools(),
      });
      await loadRoleSettings(created.id);
      showGlobalSuccessToast('角色模板已创建');
    } else if (selectedTemplateId.value !== null) {
      const updated = await updateRoleTemplate(selectedTemplateId.value, {
        name: form.value.name.trim(),
        soul: form.value.soul,
        model: form.value.model.trim(),
        driver: form.value.driver || null,
        allowed_tools: parseAllowedTools(),
      });
      currentDetail.value = updated;
      resetForm(updated);
      await loadTemplateList(updated.id);
      showGlobalSuccessToast('角色模板已保存');
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
  if (!canDelete.value) {
    return;
  }
  deleteConfirmOpen.value = true;
}

function closeDeleteConfirm(): void {
  deleteConfirmOpen.value = false;
}

async function confirmDelete(): Promise<void> {
  if (selectedTemplateId.value === null || !currentDetail.value) {
    closeDeleteConfirm();
    return;
  }

  isDeleting.value = true;
  statusText.value = '';
  try {
    await deleteRoleTemplate(selectedTemplateId.value);
    closeDeleteConfirm();
    await loadRoleSettings(null);
    showGlobalSuccessToast('角色模板已删除');
    statusText.value = '已删除';
  } catch (error) {
    console.error(error);
    statusText.value = '删除失败';
  } finally {
    isDeleting.value = false;
  }
}

onMounted(() => {
  loadRoleSettings().catch(console.error);
});
</script>

<template>
  <section id="roles" class="config-section">
    <SettingsBreadcrumb :items="breadcrumbItems" @navigate="emit('navigateBreadcrumb', $event)" />

    <div class="section-head">
      <div>
        <p class="section-eyebrow">Roles</p>
        <h3>角色管理</h3>
      </div>
      <div class="section-actions">
        <span v-if="statusText" class="section-status">{{ statusText }}</span>
        <button type="button" class="secondary-button" @click="startCreate">新建模板</button>
      </div>
    </div>

    <div class="roles-layout">
      <aside class="roles-list-card">
        <div class="roles-list-head">
          <strong>模板列表</strong>
          <span>{{ templates.length }} 个</span>
        </div>

        <p v-if="isLoading" class="roles-empty">正在加载模板...</p>

        <div v-else-if="templates.length" class="roles-list">
          <button
            v-for="template in templates"
            :key="template.id"
            type="button"
            class="role-row"
            :class="{ active: !isCreating && selectedTemplateId === template.id }"
            @click="selectTemplate(template.id)"
          >
            <div class="role-row-main">
              <div class="role-row-title">
                <div class="role-row-title-main">
                  <span class="role-row-id">#{{ template.id }}</span>
                  <strong>{{ template.name }}</strong>
                </div>
                <span
                  class="role-chip"
                  :class="isSystemType(template.type) ? 'role-chip--system' : 'role-chip--user'"
                >
                  {{ isSystemType(template.type) ? '系统模板' : '用户模板' }}
                </span>
              </div>
              <p class="role-row-preview">{{ buildSoulPreview(template.soul) }}</p>
            </div>
          </button>
        </div>

        <p v-else class="roles-empty">当前没有角色模板。</p>
      </aside>

      <section class="role-editor-card">
        <div class="role-editor-head">
          <div>
            <p class="section-eyebrow">{{ isCreating ? 'Create Template' : 'Template Detail' }}</p>
            <h4>{{ isCreating ? '新建角色模板' : (form.name || '角色模板详情') }}</h4>
          </div>
          <div class="role-editor-meta">
            <span
              class="role-chip"
              :class="isCreating ? 'role-chip--draft' : (isSystemTemplate ? 'role-chip--system' : 'role-chip--user')"
            >
              {{ isCreating ? '未保存' : currentTypeLabel }}
            </span>
          </div>
        </div>

        <div class="role-form-grid">
          <label class="role-field">
            <span>模板名称</span>
            <input
              v-model="form.name"
              type="text"
              class="role-input"
              :class="{ 'role-input--readonly': isNameReadonly }"
              placeholder="例如：custom_writer"
              :readonly="isNameReadonly"
            />
          </label>

          <label class="role-field role-field--wide">
            <span>Soul</span>
            <textarea
              v-model="form.soul"
              class="role-textarea"
              :class="{ 'role-input--readonly': isSystemReadonlyFields }"
              rows="12"
              placeholder="输入角色 Soul"
              :readonly="isSystemReadonlyFields"
            ></textarea>
          </label>
        </div>

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
            <label class="role-field">
              <span>模型</span>
              <input
                v-model="form.model"
                type="text"
                class="role-input"
                :class="{ 'role-input--readonly': isSystemReadonlyFields }"
                placeholder="为空则使用默认模型"
                :readonly="isSystemReadonlyFields"
              />
            </label>

            <label class="role-field">
              <span>驱动</span>
              <CustomSelect
                v-model="form.driver"
                :options="driverSelectOptions"
                placeholder="自动"
                :disabled="isSystemReadonlyFields"
              />
            </label>

            <label class="role-field role-field--wide">
              <span>允许工具</span>
              <input
                v-model="form.allowedToolsText"
                type="text"
                class="role-input"
                :class="{ 'role-input--readonly': isSystemReadonlyFields }"
                placeholder="使用英文逗号分隔，例如 Read, Bash, Edit"
                :readonly="isSystemReadonlyFields"
              />
            </label>
          </div>
        </section>

        <div class="role-editor-actions">
          <button
            v-if="canDelete"
            type="button"
            class="secondary-button secondary-button--danger"
            :disabled="isDeleting"
            @click="requestDelete"
          >
            {{ isDeleting ? '删除中...' : '删除模板' }}
          </button>
          <button
            type="button"
            class="secondary-button"
            :disabled="!canSave"
            @click="saveCurrentTemplate"
          >
            {{ isSaving ? '保存中...' : (isCreating ? '创建模板' : '保存修改') }}
          </button>
        </div>
      </section>
    </div>

    <ConfirmDialog
      :open="deleteConfirmOpen"
      title="删除角色模板"
      :message="`确认删除模板“${currentDetail?.name || ''}”？删除后无法恢复。`"
      confirm-label="删除"
      danger
      @close="closeDeleteConfirm"
      @confirm="confirmDelete"
    />
  </section>
</template>

<style scoped>
.config-section,
.roles-list-card,
.role-editor-card,
.role-row {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.config-section {
  padding: 12px 14px;
}

.section-head,
.section-actions,
.roles-list-head,
.role-row-main,
.role-row-meta,
.role-editor-head,
.role-editor-meta,
.role-editor-actions {
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
.role-editor-head h4 {
  margin: 0;
  color: var(--text-strong);
}

.section-status,
.roles-empty,
.roles-list-head span,
.role-row-main span {
  color: var(--muted);
}

.roles-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 10px;
  margin-top: 10px;
  align-items: start;
}

.roles-list-card,
.role-editor-card {
  padding: 12px;
}

.roles-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.role-row {
  width: 100%;
  padding: 10px;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease;
}

.role-row.active,
.role-row:hover {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 68%, var(--surface-soft) 32%);
}

.role-row-main,
.role-row-meta {
  width: 100%;
}

.role-row-main {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.role-row-title {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.role-row-title-main {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.role-row-main strong {
  display: block;
  color: var(--text-strong);
  font-size: 0.92rem;
  min-width: 0;
}

.role-row-id {
  color: var(--muted);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.role-row-title .role-chip {
  margin-left: auto;
  flex: 0 0 auto;
}

.role-row-preview {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-align: left;
}

.role-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: var(--panel-bg);
  color: var(--muted);
  font-size: 0.74rem;
}

.role-chip--system {
  border-color: color-mix(in srgb, var(--focus-border) 26%, var(--panel-border) 74%);
  background: color-mix(in srgb, var(--selected) 72%, var(--panel-bg) 28%);
  color: color-mix(in srgb, var(--text-strong) 82%, var(--accent) 18%);
}

.role-chip--user {
  border-color: color-mix(in srgb, var(--accent) 18%, var(--panel-border) 82%);
  background: color-mix(in srgb, var(--accent) 10%, var(--panel-bg) 90%);
  color: color-mix(in srgb, var(--text-strong) 90%, var(--accent) 10%);
}

.role-chip--draft {
  border-color: color-mix(in srgb, var(--panel-border) 88%, var(--focus-border) 12%);
  background: color-mix(in srgb, var(--surface-soft) 82%, var(--panel-bg) 18%);
  color: var(--muted);
}

.role-editor-card {
  display: grid;
  gap: 12px;
  align-self: start;
}

.advanced-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-soft) 84%, var(--panel-bg) 16%);
  overflow: hidden;
}

.advanced-toggle {
  width: 100%;
  min-height: 76px;
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

.role-form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.role-field {
  display: grid;
  gap: 6px;
}

.role-field--wide {
  grid-column: 1 / -1;
}

.role-field span {
  color: var(--muted);
  font-size: 0.76rem;
}

.role-input,
.role-textarea {
  width: 100%;
  border: 1px solid var(--panel-border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: var(--text-strong);
  padding: 10px 12px;
  font: inherit;
  box-sizing: border-box;
}

.role-input--readonly {
  border: 1px dashed color-mix(in srgb, var(--focus-border) 18%, var(--panel-border) 82%);
  background: color-mix(in srgb, var(--surface-soft) 86%, var(--panel-bg) 14%);
  color: color-mix(in srgb, var(--muted) 84%, var(--text-strong) 16%);
  -webkit-text-fill-color: color-mix(in srgb, var(--muted) 84%, var(--text-strong) 16%);
  box-shadow: none;
}

.role-input[readonly],
.role-textarea[readonly] {
  cursor: default;
}

.role-textarea {
  resize: vertical;
  min-height: 220px;
}

.secondary-button--danger {
  border-color: color-mix(in srgb, #ef4444 30%, var(--team-create-control-border) 70%);
  background: color-mix(in srgb, #fee2e2 48%, var(--panel-bg) 52%);
}

@media (max-width: 980px) {
  .roles-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 780px) {
  .advanced-grid,
  .role-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
