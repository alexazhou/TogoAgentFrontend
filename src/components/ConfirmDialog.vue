<script setup lang="ts">
defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="confirm-overlay" @click.self="emit('close')">
      <section class="confirm-dialog panel">
        <div class="confirm-head">
          <p class="confirm-eyebrow">Confirm Action</p>
          <h3>{{ title }}</h3>
        </div>

        <p class="confirm-message">{{ message }}</p>

        <div class="confirm-actions">
          <button type="button" class="ghost-button" @click="emit('close')">
            {{ cancelLabel || '取消' }}
          </button>
          <button
            type="button"
            class="secondary-button"
            :class="{ 'secondary-button--danger': danger }"
            @click="emit('confirm')"
          >
            {{ confirmLabel || '确认' }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(6, 10, 16, 0.52);
  backdrop-filter: blur(8px);
}

.confirm-dialog {
  width: min(420px, 100%);
  padding: 18px;
  display: grid;
  gap: 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 26%, var(--panel-border) 74%);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--panel-bg) 95%, transparent) 0%,
      color-mix(in srgb, var(--surface-soft) 92%, transparent) 100%
    );
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.34);
}

.confirm-head {
  display: grid;
  gap: 4px;
}

.confirm-eyebrow {
  margin: 0;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
}

.confirm-head h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.12rem;
}

.confirm-message {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.55;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.ghost-button,
.secondary-button {
  min-width: 88px;
  height: 32px;
  padding: 0 14px;
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

.ghost-button:hover,
.secondary-button:hover {
  border-color: var(--focus-border);
  background: var(--selected);
  transform: translateY(-1px);
}

.secondary-button--danger {
  border-color: color-mix(in srgb, #ef4444 30%, var(--team-create-control-border) 70%);
  background: color-mix(in srgb, #fee2e2 48%, var(--panel-bg) 52%);
}

.secondary-button--danger:hover {
  border-color: color-mix(in srgb, #ef4444 62%, var(--focus-border) 38%);
  background: color-mix(in srgb, #fee2e2 78%, #fff 22%);
}
</style>
