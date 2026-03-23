<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  teamName: string;
  selectedAgents: string[];
}>();

const emit = defineEmits<{
  toggleAgent: [agentName: string];
}>();

const leaderAgent = computed(() => props.selectedAgents[0] ?? '');
const memberAgents = computed(() => props.selectedAgents.slice(1));
const visibleMemberSlots = computed(() => [
  ...memberAgents.value.map((agentName) => ({
    name: agentName,
    agent: agentName,
  })),
  { name: '', agent: '' },
]);
const isSingleMemberLayout = computed(() => visibleMemberSlots.value.length === 1);
const memberGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(visibleMemberSlots.value.length, 1)}, minmax(180px, 220px))`,
}));
</script>

<template>
  <div class="member-graph">
    <button
      class="team-root"
      :class="{ 'is-empty': !leaderAgent }"
      type="button"
      @click="leaderAgent && emit('toggleAgent', leaderAgent)"
    >
      <span>{{ leaderAgent || (teamName.trim() ? `${teamName.trim()} Leader` : '+') }}</span>
      <small>{{ leaderAgent ? 'Leader' : '负责人' }}</small>
    </button>

    <div class="member-tree" :class="{ 'is-single-member': isSingleMemberLayout }">
      <div v-if="!isSingleMemberLayout" class="member-rail" aria-hidden="true"></div>
      <div v-else class="member-single-link" aria-hidden="true"></div>

      <div class="member-slots" :class="{ 'is-single-member': isSingleMemberLayout }" :style="memberGridStyle">
        <button
          v-for="(member, index) in visibleMemberSlots"
          :key="member.name || `empty-${index}`"
          class="member-node"
          :class="{ 'is-empty': !member.name }"
          type="button"
          @click="member.name && emit('toggleAgent', member.name)"
        >
          <span>{{ member.name || '+' }}</span>
          <small>{{ member.name ? member.agent : '成员' }}</small>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-graph {
  --member-card-width: 102px;
  --member-gap: 18px;
  min-height: 260px;
  background: transparent;
  padding: 10px 6px 0;
  display: grid;
  justify-items: center;
  gap: 28px;
}

.team-root {
  width: 132px;
  aspect-ratio: 3 / 4;
  box-sizing: border-box;
  border: 1px solid var(--team-create-node-border);
  border-radius: 24px;
  display: grid;
  place-items: center;
  text-align: center;
  padding: 10px;
  color: var(--text-strong);
  background: var(--surface-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--panel-border) 70%, transparent);
  transition:
    border-color 0.18s ease,
    transform 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.team-root span,
.member-node span {
  font-weight: 600;
}

.team-root small,
.member-node small {
  color: var(--muted);
  font-size: 0.76rem;
}

.team-root:not(.is-empty):hover,
.member-node:not(.is-empty):hover {
  transform: translateY(-2px);
  border-color: var(--focus-border);
  background: var(--selected);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 55%, transparent);
}

.team-root.is-empty,
.member-node.is-empty {
  color: var(--muted);
  cursor: default;
  background: color-mix(in srgb, var(--surface-soft) 92%, var(--selected) 8%);
  border: 1px dashed color-mix(in srgb, var(--panel-border-strong) 88%, var(--focus-border) 12%);
  box-shadow: none;
}

.team-root.is-empty span,
.member-node.is-empty span {
  color: color-mix(in srgb, var(--text-strong) 58%, var(--muted) 42%);
}

.member-tree {
  position: relative;
  width: max-content;
  max-width: 100%;
  padding-top: 58px;
}

.member-rail {
  position: absolute;
  top: 0;
  left: calc(var(--member-card-width) / 2);
  right: calc(var(--member-card-width) / 2);
  height: 30px;
  border-top: 1px solid color-mix(in srgb, var(--panel-border-strong) 78%, transparent);
}

.member-rail::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -30px;
  width: 1px;
  height: 30px;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--panel-border-strong) 78%, transparent);
}

.member-slots {
  position: relative;
  display: grid;
  gap: var(--member-gap);
  justify-content: center;
  justify-items: center;
}

.member-slots.is-single-member {
  grid-template-columns: repeat(3, var(--member-card-width)) !important;
}

.member-slots.is-single-member .member-node:nth-child(1) {
  grid-column: 2;
}

.member-slots.is-single-member .member-node:nth-child(2) {
  grid-column: 3;
}

.member-node {
  position: relative;
  width: var(--member-card-width);
  aspect-ratio: 3 / 4;
  box-sizing: border-box;
  border: 1px solid var(--team-create-node-border);
  border-radius: 16px;
  background: var(--surface-soft);
  color: var(--text-strong);
  display: grid;
  place-items: center;
  gap: 2px;
  padding: 10px;
  text-align: center;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--panel-border) 70%, transparent);
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.member-node::before {
  content: '';
  position: absolute;
  top: -50px;
  left: 50%;
  width: 1px;
  height: 50px;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--panel-border-strong) 78%, transparent);
}

.member-tree.is-single-member .member-rail {
  display: none;
}

.member-single-link {
  position: absolute;
  top: -38px;
  left: 50%;
  width: 1px;
  height: 96px;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--panel-border-strong) 78%, transparent);
}

@media (max-width: 960px) {
  .member-slots {
    width: 100%;
    grid-template-columns: repeat(2, minmax(180px, 1fr)) !important;
  }
}

@media (max-width: 640px) {
  .member-tree {
    width: 100%;
    padding-top: 0;
  }

  .member-slots {
    grid-template-columns: 1fr !important;
  }

  .member-rail,
  .member-node::before {
    display: none;
  }

  .member-graph {
    min-height: auto;
  }
}

</style>
