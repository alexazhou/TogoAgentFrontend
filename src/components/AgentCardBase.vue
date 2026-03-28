<script setup lang="ts">
import { computed } from 'vue';
import { getAgentAvatarUrl } from '../avatar';

const props = withDefaults(defineProps<{
  title: string;
  subtitle: string;
  employeeNumber?: string;
  avatarName?: string;
  selected?: boolean;
  empty?: boolean;
  readonly?: boolean;
  variant?: 'template' | 'graph' | 'leader' | 'featured';
}>(), {
  employeeNumber: '',
  avatarName: '',
  selected: false,
  empty: false,
  readonly: false,
  variant: 'template',
});

defineEmits<{
  click: [];
}>();

const avatarAlt = computed(() => `${props.avatarName || props.title} avatar`);
const normalizedEmployeeNumber = computed(() => (
  /^\d+$/.test(props.employeeNumber) ? props.employeeNumber : ''
));
</script>

<template>
  <button
    class="entity-card"
    :class="[
      `entity-card--${variant}`,
      {
        selected,
        'is-empty': empty,
        'is-readonly': readonly,
      },
    ]"
    type="button"
    @click="$emit('click')"
  >
    <small v-if="normalizedEmployeeNumber && !empty" class="entity-card__badge">
      #{{ normalizedEmployeeNumber }}
    </small>
    <img
      v-if="avatarName && !empty"
      class="entity-card__avatar"
      :src="getAgentAvatarUrl(avatarName)"
      :alt="avatarAlt"
    />
    <strong class="entity-card__title">{{ title }}</strong>
    <small class="entity-card__subtitle">{{ subtitle }}</small>
  </button>
</template>

<style scoped>
.entity-card {
  width: var(--entity-card-width);
  aspect-ratio: 3 / 4;
  box-sizing: border-box;
  position: relative;
  border: 1px solid var(--team-create-node-border);
  border-radius: var(--entity-card-radius);
  background: var(--surface-soft);
  color: var(--text-strong);
  display: grid;
  grid-template-rows: var(--entity-avatar-slot-size) minmax(var(--entity-title-min-height), auto) minmax(var(--entity-subtitle-min-height), auto);
  align-content: start;
  justify-items: center;
  gap: var(--entity-card-gap);
  padding: var(--entity-card-padding-y) var(--entity-card-padding-x);
  text-align: center;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--panel-border) 70%, transparent);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.entity-card:hover {
  transform: translateY(-2px);
  border-color: var(--focus-border);
  background: var(--selected);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 55%, transparent);
}

.entity-card.selected {
  border-color: var(--focus-border);
  background: var(--selected);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 55%, transparent);
}

.entity-card.is-readonly {
  cursor: grab;
}

.entity-card.is-empty {
  color: var(--muted);
  cursor: default;
  background: color-mix(in srgb, var(--surface-soft) 92%, var(--selected) 8%);
  border: 1px dashed color-mix(in srgb, var(--panel-border-strong) 88%, var(--focus-border) 12%);
  box-shadow: none;
}

.entity-card.is-empty:hover {
  transform: none;
  border-color: color-mix(in srgb, var(--panel-border-strong) 88%, var(--focus-border) 12%);
  background: color-mix(in srgb, var(--surface-soft) 92%, var(--selected) 8%);
  box-shadow: none;
}

.entity-card__avatar {
  width: var(--entity-avatar-size);
  aspect-ratio: 1 / 1;
  height: auto;
  align-self: start;
  margin-top: var(--entity-avatar-offset-y, 0);
  border-radius: var(--entity-avatar-radius);
  display: block;
  object-fit: cover;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--panel-border-strong) 30%, transparent);
}

.entity-card__title,
.entity-card__subtitle {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.entity-card__title {
  font-size: var(--entity-title-size);
  line-height: 1.2;
  font-weight: 600;
}

.entity-card__subtitle {
  color: var(--muted);
  font-size: var(--entity-subtitle-size);
  line-height: 1.2;
}

.entity-card__badge {
  position: absolute;
  top: var(--entity-badge-top);
  left: var(--entity-badge-left);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  max-width: calc(100% - (2 * var(--entity-badge-left)));
  padding: 0;
  color: color-mix(in srgb, var(--muted) 78%, transparent);
  font-size: var(--entity-badge-size);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, SFMono-Regular, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entity-card.is-empty .entity-card__title {
  color: color-mix(in srgb, var(--text-strong) 58%, var(--muted) 42%);
}

.entity-card--template {
  --entity-card-width: 78px;
  --entity-card-radius: 12px;
  --entity-card-padding-y: 7px;
  --entity-card-padding-x: 5px;
  --entity-card-gap: 5px;
  --entity-avatar-size: 32px;
  --entity-avatar-slot-size: 44px;
  --entity-avatar-offset-y: 7px;
  --entity-avatar-radius: 9px;
  --entity-title-size: 0.68rem;
  --entity-subtitle-size: 0.6rem;
  --entity-title-min-height: 1.7em;
  --entity-subtitle-min-height: 1.6em;
  --entity-badge-size: 0.7rem;
  --entity-badge-top: 6px;
  --entity-badge-left: 6px;
}

.entity-card--graph {
  --entity-card-width: var(--member-card-width, 102px);
  --entity-card-radius: 14px;
  --entity-card-padding-y: 6px;
  --entity-card-padding-x: 7px;
  --entity-card-gap: 4px;
  --entity-avatar-size: 46%;
  --entity-avatar-slot-size: calc(var(--member-card-width, 102px) * 0.68);
  --entity-avatar-offset-y: calc(var(--member-card-width, 102px) * 0.247);
  --entity-avatar-radius: 24%;
  --entity-title-size: 0.8rem;
  --entity-subtitle-size: 0.64rem;
  --entity-title-min-height: 1.2em;
  --entity-subtitle-min-height: 1.35em;
  --entity-badge-size: 0.8rem;
  --entity-badge-top: 8px;
  --entity-badge-left: 8px;
}

.entity-card--leader {
  --entity-card-width: 132px;
  --entity-card-radius: 20px;
  --entity-card-padding-y: 8px;
  --entity-card-padding-x: 7px;
  --entity-card-gap: 4px;
  --entity-avatar-size: 46%;
  --entity-avatar-slot-size: calc(132px * 0.68);
  --entity-avatar-offset-y: calc(132px * 0.247);
  --entity-avatar-radius: 24%;
  --entity-title-size: 0.84rem;
  --entity-subtitle-size: 0.68rem;
  --entity-title-min-height: 1.2em;
  --entity-subtitle-min-height: 1.35em;
  --entity-badge-size: 0.84rem;
  --entity-badge-top: 8px;
  --entity-badge-left: 8px;
}

.entity-card--featured {
  --entity-card-width: 117px;
  --entity-card-radius: 18px;
  --entity-card-padding-y: 11px;
  --entity-card-padding-x: 9px;
  --entity-card-gap: 8px;
  --entity-avatar-size: 48px;
  --entity-avatar-slot-size: 56px;
  --entity-avatar-offset-y: 6px;
  --entity-avatar-radius: 12px;
  --entity-title-size: 0.82rem;
  --entity-subtitle-size: 0.68rem;
  --entity-title-min-height: 1.85em;
  --entity-subtitle-min-height: 1.7em;
  --entity-badge-size: 0.84rem;
  --entity-badge-top: 8px;
  --entity-badge-left: 8px;
}
</style>
