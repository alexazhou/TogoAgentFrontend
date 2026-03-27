<script setup lang="ts">
import { computed } from 'vue';
import { getAgentAvatarUrl } from '../avatar';
import { useTeamGraphLayout } from './useTeamGraphLayout';

const props = defineProps<{
  teamName: string;
  selectedAgents: string[];
  readonly?: boolean;
}>();

const emit = defineEmits<{
  toggleAgent: [agentName: string];
  viewAgent: [agentName: string];
}>();

const leaderAgent = computed(() => props.selectedAgents[0] ?? '');
const memberAgents = computed(() => props.selectedAgents.slice(1));
const visibleMemberSlots = computed(() => {
  const slots = memberAgents.value.map((agentName) => ({
    name: agentName,
    agent: agentName,
  }));

  if (!props.readonly) {
    slots.push({ name: '', agent: '' });
  }

  return slots;
});
const isSingleMemberLayout = computed(() => visibleMemberSlots.value.length === 1);
const memberGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(visibleMemberSlots.value.length, 1)}, minmax(180px, 220px))`,
}));
const readonly = computed(() => !!props.readonly);
const {
  graphRef,
  canvasRef,
  memberTreeRef,
  isPanning,
  canvasStyle,
  railStyle,
  startPan,
  movePan,
  endPan,
  handleWheelZoom,
} = useTeamGraphLayout({
  readonly,
  selectedAgents: computed(() => props.selectedAgents),
});

function handlePrimaryAction(agentName: string): void {
  if (!agentName || props.readonly) {
    return;
  }

  emit('toggleAgent', agentName);
}

function handleActionButton(agentName: string): void {
  if (!agentName) {
    return;
  }

  if (readonly.value) {
    emit('viewAgent', agentName);
    return;
  }

  emit('toggleAgent', agentName);
}
</script>

<template>
  <div
    ref="graphRef"
    class="member-graph"
    :class="{ 'is-panning': isPanning, 'is-editing': !props.readonly }"
    @pointerdown="startPan"
    @pointermove="movePan"
    @pointerup="endPan"
    @pointercancel="endPan"
    @pointerleave="endPan"
    @wheel.prevent="handleWheelZoom"
  >
    <div ref="canvasRef" class="member-canvas" :style="canvasStyle">
      <div class="member-card-shell team-root-shell" :class="{ 'has-action': !!leaderAgent }">
        <button
          class="team-root member-card-button"
          :class="{ 'is-empty': !leaderAgent, 'is-readonly': readonly }"
          type="button"
          @click="handlePrimaryAction(leaderAgent)"
        >
          <img
            v-if="leaderAgent"
            class="member-avatar"
            :src="getAgentAvatarUrl(leaderAgent)"
            :alt="`${leaderAgent} avatar`"
          />
          <span>{{ leaderAgent || (teamName.trim() ? `${teamName.trim()} Leader` : '+') }}</span>
          <small>{{ leaderAgent ? 'Leader' : '负责人' }}</small>
        </button>
        <button
          v-if="leaderAgent && readonly"
          class="member-action-button"
          type="button"
          @pointerdown.stop
          @click.stop="handleActionButton(leaderAgent)"
        >
          {{ readonly ? '查看' : '移除' }}
        </button>
      </div>

      <div ref="memberTreeRef" class="member-tree" :class="{ 'is-single-member': isSingleMemberLayout }">
        <div v-if="!isSingleMemberLayout" class="member-rail" :style="railStyle" aria-hidden="true"></div>
        <div v-else class="member-single-link" aria-hidden="true"></div>

        <div class="member-slots" :class="{ 'is-single-member': isSingleMemberLayout }" :style="memberGridStyle">
          <div
            v-for="(member, index) in visibleMemberSlots"
            :key="member.name || `empty-${index}`"
            class="member-card-shell member-node-shell"
            :class="{ 'has-action': !!member.name }"
          >
            <button
              class="member-node member-card-button"
              :class="{ 'is-empty': !member.name, 'is-readonly': readonly }"
              type="button"
              @click="handlePrimaryAction(member.name)"
            >
              <img
                v-if="member.name"
                class="member-avatar"
                :src="getAgentAvatarUrl(member.name)"
                :alt="`${member.name} avatar`"
              />
              <span>{{ member.name || '+' }}</span>
              <small>{{ member.name ? member.agent : '成员' }}</small>
            </button>
            <button
              v-if="member.name"
              class="member-action-button"
              type="button"
              @pointerdown.stop
              @click.stop="handleActionButton(member.name)"
            >
              {{ readonly ? '查看' : '移除' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.member-graph {
  --member-grid-size: 28px;
  --member-grid-line: rgba(148, 163, 184, 0.16);
  --member-connector-line: rgba(37, 99, 235, 0.62);
  position: relative;
  height: 452px;
  padding: 8px 6px 0;
  display: grid;
  justify-items: center;
  align-content: start;
  background-image:
    linear-gradient(to right, var(--member-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--member-grid-line) 1px, transparent 1px);
  background-size: var(--member-grid-size) var(--member-grid-size);
  background-position: 0 0;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  cursor: grab;
}

.member-graph.is-editing {
  background-color: color-mix(in srgb, var(--selected) 20%, #fff 80%);
}

.member-graph.is-panning {
  cursor: grabbing;
}

.member-canvas {
  --member-card-width: 102px;
  --member-gap: 18px;
  position: relative;
  left: 50%;
  min-height: 260px;
  width: max-content;
  background: transparent;
  padding: 10px 6px 0;
  display: grid;
  justify-items: center;
  gap: 28px;
  will-change: transform;
  transform-origin: center center;
  z-index: 1;
}

.team-root {
  width: 132px;
  aspect-ratio: 3 / 4;
  box-sizing: border-box;
  border: 1px solid var(--team-create-node-border);
  border-radius: 24px;
  display: grid;
  place-items: center;
  align-content: center;
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

.team-root.is-readonly,
.member-node.is-readonly {
  cursor: grab;
}

.member-graph.is-panning .team-root.is-readonly,
.member-graph.is-panning .member-node.is-readonly {
  cursor: grabbing;
}

.member-card-shell {
  position: relative;
  display: grid;
  justify-items: center;
}

.team-root-shell {
  width: 132px;
}

.member-card-button {
  width: 100%;
}

.member-action-button {
  position: absolute;
  top: 10px;
  right: 10px;
  min-width: 44px;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 48%, var(--panel-border) 52%);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-bg) 76%, var(--selected) 24%);
  color: var(--text-strong);
  padding: 0 10px;
  font-size: 0.72rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease;
  z-index: 3;
}

.member-card-shell.has-action:hover .member-action-button,
.member-card-shell.has-action:focus-within .member-action-button {
  opacity: 1;
  transform: translateY(0);
}

.member-action-button:hover {
  border-color: var(--focus-border);
  background: var(--selected);
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
  --member-branch-offset: 58px;
  position: relative;
  width: max-content;
  max-width: none;
  padding-top: var(--member-branch-offset);
}

.member-rail {
  position: absolute;
  top: 0;
  left: calc(var(--member-card-width) / 2);
  right: calc(var(--member-card-width) / 2);
  height: 30px;
  border-top: 1px solid var(--member-connector-line);
}

.member-rail::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -30px;
  width: 1px;
  height: 30px;
  transform: translateX(-50%);
  background: var(--member-connector-line);
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

.member-slots.is-single-member .member-node-shell:nth-child(1) {
  grid-column: 2;
}

.member-slots.is-single-member .member-node-shell:nth-child(2) {
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
  align-content: center;
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

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: block;
  object-fit: cover;
  margin-bottom: 4px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--panel-border-strong) 30%, transparent);
}

.member-node::before {
  content: '';
  position: absolute;
  top: calc(-1 * var(--member-branch-offset));
  left: 50%;
  width: 1px;
  height: var(--member-branch-offset);
  transform: translateX(-50%);
  background: var(--member-connector-line);
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
  background: var(--member-connector-line);
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

  .member-action-button {
    opacity: 1;
    transform: none;
  }

  .member-graph {
    min-height: auto;
  }
}

</style>
