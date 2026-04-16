<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { getRoleTemplates } from '../../api';
import type { RoleTemplateSummary } from '../../types';
import RoleTemplateEditorDialog from './RoleTemplateEditorDialog.vue';
import SettingsBreadcrumb from './SettingsBreadcrumb.vue';
import type { SettingsBreadcrumbItem } from './types';

defineProps<{
  breadcrumbItems: SettingsBreadcrumbItem[];
}>();

const emit = defineEmits<{
  navigateBreadcrumb: [key: string];
}>();

const { t } = useI18n();

const templates = ref<RoleTemplateSummary[]>([]);
const selectedTemplateId = ref<number | null>(null);
const isLoading = ref(false);
const statusText = ref('');
const editorDialogRef = ref<InstanceType<typeof RoleTemplateEditorDialog> | null>(null);

function equalsIgnoreCase(value: string | null | undefined, expected: string): boolean {
  return String(value ?? '').trim().toLowerCase() === expected.toLowerCase();
}

function isSystemType(type: string | null | undefined): boolean {
  return equalsIgnoreCase(type, 'system');
}

function buildSoulPreview(soul: string | undefined): string {
  const normalized = String(soul ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return t('settings.roles.noSoul');
  }
  return normalized.length > 72 ? `${normalized.slice(0, 72)}...` : normalized;
}

async function loadRoleSettings(preferredId?: number | null): Promise<void> {
  isLoading.value = true;
  statusText.value = '';

  try {
    const nextTemplates = await getRoleTemplates();
    templates.value = nextTemplates;

    if (preferredId !== null && preferredId !== undefined && nextTemplates.some((template) => template.id === preferredId)) {
      selectedTemplateId.value = preferredId;
    } else if (selectedTemplateId.value !== null && nextTemplates.some((template) => template.id === selectedTemplateId.value)) {
      return;
    } else {
      selectedTemplateId.value = nextTemplates[0]?.id ?? null;
    }
  } catch (error) {
    console.error(error);
    statusText.value = t('settings.roles.loadFailed');
  } finally {
    isLoading.value = false;
  }
}

function openCreate(): void {
  selectedTemplateId.value = null;
  editorDialogRef.value?.openCreate();
}

function openEdit(templateId: number): void {
  selectedTemplateId.value = templateId;
  void editorDialogRef.value?.openEdit(templateId);
}

function handleDialogChanged(payload: { preferredId: number | null }): void {
  void loadRoleSettings(payload.preferredId);
}

onMounted(() => {
  void loadRoleSettings();
});
</script>

<template>
  <section id="roles" class="config-section">
    <SettingsBreadcrumb :items="breadcrumbItems" @navigate="emit('navigateBreadcrumb', $event)" />

    <div class="section-head">
      <div>
        <p class="section-eyebrow">Roles</p>
        <h3>{{ t('settings.roles.title') }}</h3>
      </div>
      <div class="section-actions">
        <span v-if="statusText" class="section-status">{{ statusText }}</span>
        <button type="button" class="secondary-button" @click="openCreate">
          {{ t('settings.roles.newTemplate') }}
        </button>
      </div>
    </div>

    <section class="roles-list-card">
      <div class="roles-list-head">
        <strong>{{ t('settings.roles.templateList') }}</strong>
        <span>{{ t('settings.roles.count', { count: templates.length }) }}</span>
      </div>

      <p v-if="isLoading" class="roles-empty">{{ t('settings.roles.loading') }}</p>

      <div v-else-if="templates.length" class="roles-list">
        <article
          v-for="template in templates"
          :key="template.id"
          class="role-row"
          :class="{ active: selectedTemplateId === template.id }"
        >
          <div class="role-row-main">
            <div class="role-row-title">
              <div class="role-row-title-main">
                <span class="role-row-id">#{{ template.id }}</span>
                <strong>{{ template.name }}</strong>
              </div>
              <div class="role-row-actions">
                <span
                  class="role-chip"
                  :class="isSystemType(template.type) ? 'role-chip--system' : 'role-chip--user'"
                >
                  {{ isSystemType(template.type) ? t('settings.roles.systemTemplate') : t('settings.roles.userTemplate') }}
                </span>
                <button type="button" class="ghost-button" @click="openEdit(template.id)">
                  {{ t('common.edit') }}
                </button>
              </div>
            </div>
            <p class="role-row-preview">{{ buildSoulPreview(template.soul) }}</p>
          </div>
        </article>
      </div>

      <p v-else class="roles-empty">{{ t('settings.roles.empty') }}</p>
    </section>

    <RoleTemplateEditorDialog ref="editorDialogRef" @changed="handleDialogChanged" />
  </section>
</template>

<style scoped>
.roles-list-card,
.role-row {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.config-section {
  padding: 12px 0 0;
}

.section-head,
.section-actions,
.roles-list-head,
.role-row-title,
.role-row-actions {
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

.section-head h3 {
  margin: 0;
  color: var(--text-strong);
}

.section-status,
.roles-empty,
.roles-list-head span,
.role-row-id,
.role-row-preview {
  color: var(--muted);
}

.roles-list-card {
  margin-top: 10px;
  padding: 12px;
}

.roles-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.roles-empty {
  margin-top: 10px;
  font-size: 0.86rem;
}

.role-row {
  padding: 12px;
  transition:
    border-color 140ms ease,
    background 140ms ease;
}

.role-row.active,
.role-row:hover {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 68%, var(--surface-soft) 32%);
}

.role-row-main {
  display: grid;
  gap: 8px;
}

.role-row-title-main {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.role-row-main strong {
  color: var(--text-strong);
  font-size: 0.92rem;
}

.role-row-id {
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.role-row-preview {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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

@media (max-width: 780px) {
  .section-head,
  .section-actions,
  .roles-list-head,
  .role-row-title,
  .role-row-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .section-actions,
  .role-row-actions {
    width: 100%;
  }
}
</style>
