<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getLlmServices } from '../../api';
import { showQuickInit } from '../../appUiState';
import type { LlmServiceInfo } from '../../types';
import ModelServiceEditorDialog from './ModelServiceEditorDialog.vue';
import SettingsBreadcrumb from './SettingsBreadcrumb.vue';
import type { SettingsBreadcrumbItem } from './types';

defineProps<{
  breadcrumbItems: SettingsBreadcrumbItem[];
}>();

const emit = defineEmits<{
  navigateBreadcrumb: [key: string];
}>();

const { t } = useI18n();

const services = ref<LlmServiceInfo[]>([]);
const defaultServer = ref<string | null>(null);
const activeIndex = ref<number | null>(null);
const isLoading = ref(false);
const statusText = ref('');
const editorDialogRef = ref<InstanceType<typeof ModelServiceEditorDialog> | null>(null);

async function loadServices(preferredIndex?: number | null): Promise<void> {
  const data = await getLlmServices();
  services.value = data.llm_services;
  defaultServer.value = data.default_llm_server;

  if (
    preferredIndex !== null
    && preferredIndex !== undefined
    && preferredIndex >= 0
    && preferredIndex < data.llm_services.length
  ) {
    activeIndex.value = preferredIndex;
    return;
  }

  if (activeIndex.value !== null && activeIndex.value < data.llm_services.length) {
    return;
  }

  activeIndex.value = data.llm_services.length ? 0 : null;
}

async function loadAll(preferredIndex?: number | null): Promise<void> {
  isLoading.value = true;
  statusText.value = '';
  try {
    await loadServices(preferredIndex);
  } catch (error) {
    console.error(error);
    statusText.value = t('settings.models.loadFailed');
  } finally {
    isLoading.value = false;
  }
}

function openCreate(): void {
  activeIndex.value = null;
  editorDialogRef.value?.openCreate();
}

function openEdit(index: number): void {
  const service = services.value[index];
  if (!service) {
    return;
  }
  activeIndex.value = index;
  editorDialogRef.value?.openEdit({
    index,
    service,
    defaultServer: defaultServer.value,
  });
}

function handleDialogChanged(payload: { preferredIndex: number | null }): void {
  void loadAll(payload.preferredIndex);
}

onMounted(() => {
  void loadAll();
});

watch(showQuickInit, (value) => {
  if (!value) {
    void loadAll(activeIndex.value);
  }
});
</script>

<template>
  <section id="models" class="config-section">
    <SettingsBreadcrumb :items="breadcrumbItems" @navigate="emit('navigateBreadcrumb', $event)" />

    <div class="section-head">
      <div>
        <p class="section-eyebrow">Models</p>
        <h3>{{ t('settings.models.title') }}</h3>
      </div>
      <div class="section-actions">
        <span v-if="statusText" class="section-status">{{ statusText }}</span>
        <button type="button" class="secondary-button" @click="showQuickInit = true">
          {{ t('settings.models.quickInit') }}
        </button>
        <button type="button" class="secondary-button" @click="openCreate">
          {{ t('settings.models.addService') }}
        </button>
      </div>
    </div>

    <section class="models-list-card">
      <div class="models-list-head">
        <strong>{{ t('settings.models.serviceList') }}</strong>
        <span>{{ t('settings.models.count', { count: services.length }) }}</span>
      </div>

      <p v-if="isLoading" class="models-empty">{{ t('settings.models.loading') }}</p>

      <div v-else-if="services.length" class="models-list">
        <article
          v-for="(service, index) in services"
          :key="`${service.name}-${index}`"
          class="svc-row"
          :class="{ active: activeIndex === index }"
        >
          <div class="svc-row-main">
            <div class="svc-row-title">
              <div class="svc-row-name">
                <strong>{{ service.name }}</strong>
                <span v-if="service.name === defaultServer" class="svc-chip svc-chip--default">
                  {{ t('settings.models.defaultBadge') }}
                </span>
                <span v-if="!service.enable" class="svc-chip svc-chip--disabled">
                  {{ t('settings.models.disabledBadge') }}
                </span>
              </div>
              <button type="button" class="ghost-button" @click="openEdit(index)">
                {{ t('common.edit') }}
              </button>
            </div>
            <p class="svc-row-meta">{{ service.type }} · {{ service.model }}</p>
            <p class="svc-row-detail">{{ service.base_url }}</p>
          </div>
        </article>
      </div>

      <p v-else class="models-empty">{{ t('settings.models.empty') }}</p>
    </section>

    <ModelServiceEditorDialog ref="editorDialogRef" @changed="handleDialogChanged" />
  </section>
</template>

<style scoped>
.svc-row {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.config-section {
  padding: 12px 0 0;
}

.section-head,
.section-actions,
.models-list-head,
.svc-row-title {
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
.models-empty,
.models-list-head span,
.svc-row-meta,
.svc-row-detail {
  color: var(--muted);
}

.models-list-card {
  margin-top: 10px;
  padding: 0;
}

.models-list {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.models-empty {
  margin-top: 10px;
  font-size: 0.86rem;
}

.svc-row {
  padding: 12px;
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
  display: grid;
  gap: 6px;
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
  font-size: 0.92rem;
}

.svc-row-meta,
.svc-row-detail {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.45;
}

.svc-row-detail {
  word-break: break-all;
}

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

@media (max-width: 780px) {
  .section-head,
  .section-actions,
  .models-list-head,
  .svc-row-title {
    align-items: flex-start;
    flex-direction: column;
  }

  .section-actions {
    width: 100%;
  }
}
</style>
