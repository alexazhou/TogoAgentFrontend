<script setup lang="ts">
import { computed } from 'vue';
import { getAgentAvatarUrl } from '../avatar';

const props = withDefaults(defineProps<{
  title: string;
  subtitle: string;
  avatarName?: string;
  selected?: boolean;
  empty?: boolean;
  readonly?: boolean;
  variant?: 'template' | 'graph' | 'leader' | 'featured';
}>(), {
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
  border: 1px solid var(--team-create-node-border);
  border-radius: var(--entity-card-radius);
  background: var(--surface-soft);
  color: var(--text-strong);
  display: grid;
  grid-template-rows: auto auto auto;
  align-content: center;
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
  --entity-avatar-radius: 9px;
  --entity-title-size: 0.68rem;
  --entity-subtitle-size: 0.6rem;
}

.entity-card--graph {
  --entity-card-width: var(--member-card-width, 102px);
  --entity-card-radius: 14px;
  --entity-card-padding-y: 8px;
  --entity-card-padding-x: 7px;
  --entity-card-gap: 5px;
  --entity-avatar-size: 46%;
  --entity-avatar-radius: 24%;
  --entity-title-size: 0.84rem;
  --entity-subtitle-size: 0.68rem;
}

.entity-card--leader {
  --entity-card-width: 132px;
  --entity-card-radius: 20px;
  --entity-card-padding-y: 8px;
  --entity-card-padding-x: 7px;
  --entity-card-gap: 5px;
  --entity-avatar-size: 46%;
  --entity-avatar-radius: 24%;
  --entity-title-size: 0.84rem;
  --entity-subtitle-size: 0.68rem;
}

.entity-card--featured {
  --entity-card-width: 117px;
  --entity-card-radius: 18px;
  --entity-card-padding-y: 11px;
  --entity-card-padding-x: 9px;
  --entity-card-gap: 8px;
  --entity-avatar-size: 48px;
  --entity-avatar-radius: 12px;
  --entity-title-size: 0.82rem;
  --entity-subtitle-size: 0.68rem;
}
</style>
