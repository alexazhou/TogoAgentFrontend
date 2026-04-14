<script setup lang="ts">
import { useI18n } from 'vue-i18n';

export interface SettingsNavItem {
  id: string;
  label: string;
  note: string;
}

defineProps<{
  items: SettingsNavItem[];
  activeId: string;
  countLabel?: string;
}>();

const emit = defineEmits<{
  select: [sectionId: string];
}>();

const { t } = useI18n();
</script>

<template>
  <aside class="settings-sidebar">
    <div class="sidebar-card">
      <div class="sidebar-card-head">
        <span>{{ t('settings.nav.label') }}</span>
        <small v-if="countLabel">{{ countLabel }}</small>
      </div>
      <nav class="settings-nav" :aria-label="t('settings.nav.ariaLabel')">
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="nav-link"
          :class="{ active: item.id === activeId }"
          @click="emit('select', item.id)"
        >
          <strong>{{ item.label }}</strong>
          <span>{{ item.note }}</span>
        </button>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
.settings-sidebar {
  min-height: 0;
  padding-top: 10px;
}

.sidebar-card {
  height: 100%;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.sidebar-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sidebar-card-head span,
.sidebar-card-head small {
  color: var(--muted);
}

.settings-nav {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.nav-link {
  width: 100%;
  border: 1px solid var(--room-card-border);
  border-radius: 12px;
  background: var(--panel-bg);
  color: inherit;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease;
}

.nav-link strong {
  display: block;
  color: var(--text-strong);
  font-size: 0.82rem;
}

.nav-link span {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.7rem;
}

.nav-link:hover {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 52%, var(--panel-bg) 48%);
}

.nav-link.active {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 60%, var(--panel-bg) 40%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 40%, transparent);
}
</style>
