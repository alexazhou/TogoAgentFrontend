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
  <section id="roles" class="config-section">
    <SettingsBreadcrumb :items="breadcrumbItems" @navigate="emit('navigateBreadcrumb', $event)" />

    <div class="section-head">
      <div>
        <p class="section-eyebrow">Roles</p>
        <h3>角色管理</h3>
      </div>
      <span class="section-status">占位区</span>
    </div>

    <div class="table-card">
      <div class="table-row table-row-head">
        <span>角色</span>
        <span>模板</span>
        <span>模型</span>
        <span>状态</span>
      </div>
      <div class="table-row">
        <span>software_engineer</span>
        <span>工程类角色模板</span>
        <span>glm-4.7</span>
        <span>启用</span>
      </div>
      <div class="table-row">
        <span>researcher</span>
        <span>检索类角色模板</span>
        <span>glm-4.7</span>
        <span>启用</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.config-section,
.table-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.config-section {
  padding: 12px 14px;
}

.section-head,
.table-row {
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

.section-status {
  color: var(--muted);
}

.table-card {
  margin-top: 10px;
  overflow: hidden;
}

.table-row {
  padding: 8px 10px;
  border-top: 1px solid var(--panel-border);
  display: grid;
  grid-template-columns: 1.2fr 1.2fr 1fr 0.7fr;
  color: var(--text-strong);
  font-size: 0.84rem;
}

.table-row:first-child {
  border-top: none;
}

.table-row-head {
  background: color-mix(in srgb, var(--selected) 60%, var(--panel-bg) 40%);
  font-weight: 600;
}

@media (max-width: 780px) {
  .table-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }
}
</style>
