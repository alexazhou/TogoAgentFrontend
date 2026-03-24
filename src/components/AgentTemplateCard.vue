<script setup lang="ts">
import { getAgentAvatarUrl } from '../avatar';

defineProps<{
  agentName: string;
  selected: boolean;
}>();

defineEmits<{
  click: [];
}>();
</script>

<template>
  <button class="agent-card" :class="{ selected }" type="button" @click="$emit('click')">
    <img class="agent-card__avatar" :src="getAgentAvatarUrl(agentName)" :alt="`${agentName} avatar`" />
    <strong class="agent-card__name">{{ agentName }}</strong>
    <small class="agent-card__meta">Agent</small>
  </button>
</template>

<style scoped>
.agent-card {
  width: 78px;
  aspect-ratio: 3 / 4;
  box-sizing: border-box;
  border: 1px solid var(--team-create-node-border);
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--text-strong);
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 5px;
  padding: 7px 5px;
  text-align: center;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--panel-border) 70%, transparent);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.agent-card:hover {
  transform: translateY(-2px);
  border-color: var(--focus-border);
  background: var(--selected);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 55%, transparent);
}

.agent-card.selected {
  border-color: var(--focus-border);
  background: var(--selected);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 55%, transparent);
}

.agent-card__avatar {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  display: block;
  object-fit: cover;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--panel-border-strong) 30%, transparent);
}

.agent-card__name {
  max-width: 100%;
  font-size: 0.68rem;
  line-height: 1.2;
  word-break: break-word;
}

.agent-card__meta {
  color: var(--muted);
  font-size: 0.6rem;
}
</style>
