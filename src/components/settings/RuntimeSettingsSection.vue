<script setup lang="ts">
import SettingsBreadcrumb from './SettingsBreadcrumb.vue';
import type { SettingsBreadcrumbItem } from './types';

defineProps<{
  breadcrumbItems: SettingsBreadcrumbItem[];
}>();

const emit = defineEmits<{
  navigateBreadcrumb: [key: string];
}>();
</script>

<template>
  <section id="runtime" class="config-section">
    <SettingsBreadcrumb :items="breadcrumbItems" @navigate="emit('navigateBreadcrumb', $event)" />

    <div class="section-head">
      <div>
        <p class="section-eyebrow">Runtime</p>
        <h3>运行与存储</h3>
      </div>
      <span class="section-status">占位区</span>
    </div>

    <div class="form-grid">
      <label class="field-card">
        <span>工作目录</span>
        <input type="text" placeholder="/path/to/workspace" />
      </label>
      <label class="field-card">
        <span>日志目录</span>
        <input type="text" placeholder="/path/to/logs" />
      </label>
      <label class="field-card field-card-wide">
        <span>运行说明</span>
        <textarea rows="5" placeholder="这里预留运行参数、存储策略、备份说明等内容。"></textarea>
      </label>
    </div>
  </section>
</template>

<style scoped>
.config-section,
.field-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.config-section {
  padding: 12px 14px;
}

.section-head {
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
.field-card span {
  color: var(--muted);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.field-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
}

.field-card-wide {
  grid-column: 1 / -1;
}

.field-card input,
.field-card textarea {
  width: 100%;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: var(--panel-bg);
  color: var(--text-strong);
  padding: 8px 10px;
  outline: none;
}

.field-card input:focus,
.field-card textarea:focus {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 2px var(--focus-glow);
}

@media (max-width: 780px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
