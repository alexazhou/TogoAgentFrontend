<script setup lang="ts">
import { computed } from 'vue';
import AgentCardBase from './AgentCardBase.vue';
import TeamMemberTreeNode from './TeamMemberTreeNode.vue';
import type { TeamGraphNode } from './teamGraphTypes';
import { useTeamGraphLayout } from './useTeamGraphLayout';

const props = defineProps<{
  teamName: string;
  selectedAgents: string[];
  memberTemplates?: Record<string, string>;
  rootNode?: TeamGraphNode | null;
  readonly?: boolean;
  showEditAction?: boolean;
}>();

const emit = defineEmits<{
  toggleAgent: [agentName: string];
  viewAgent: [agentName: string];
  editAgent: [agentName: string];
  addSubordinate: [agentName: string];
  editPendingSlot: [slotId: string];
  removePendingSlot: [slotId: string];
}>();

const readonly = computed(() => !!props.readonly);
const memberTemplates = computed(() => props.memberTemplates ?? {});

function buildFallbackRootNode(): TeamGraphNode | null {
  const leaderName = props.selectedAgents[0] ?? '';
  if (!leaderName) {
    return null;
  }

  return {
    id: leaderName,
    kind: 'member',
    name: leaderName,
    subtitle: 'Leader',
    avatarName: leaderName,
    children: props.selectedAgents.slice(1).map((agentName) => ({
      id: agentName,
      kind: 'member',
      name: agentName,
      subtitle: memberTemplates.value[agentName] || agentName,
      avatarName: agentName,
      children: [],
    })),
  };
}

const graphRootNode = computed(() => props.rootNode ?? buildFallbackRootNode());
const leaderNode = computed(() => graphRootNode.value);
const leaderAgent = computed(() => leaderNode.value?.name ?? '');
const topLevelNodes = computed(() => leaderNode.value?.children ?? []);
const isSingleMemberLayout = computed(() => topLevelNodes.value.length === 1);
const memberGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${Math.max(topLevelNodes.value.length, 1)}, minmax(180px, 220px))`,
}));

function collectGraphNodeNames(node: TeamGraphNode | null): string[] {
  if (!node) {
    return [];
  }

  const names: string[] = [];
  const stack = [node];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.kind === 'member' && current.name) {
      names.push(current.name);
    }
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      stack.push(current.children[index]);
    }
  }
  return names;
}

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
  selectedAgents: computed(() => collectGraphNodeNames(graphRootNode.value)),
  contentVersion: computed(() => JSON.stringify(graphRootNode.value ?? null)),
});

function handlePrimaryAction(agentName: string): void {
  if (!agentName || props.readonly) {
    return;
  }

  if (props.showEditAction) {
    return;
  }

  emit('toggleAgent', agentName);
}

function handleViewAction(agentName: string): void {
  if (!agentName) {
    return;
  }

  if (readonly.value) {
    emit('viewAgent', agentName);
    return;
  }

  emit('toggleAgent', agentName);
}

function handleEditAction(agentName: string): void {
  if (!agentName) {
    return;
  }

  emit('editAgent', agentName);
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
        <AgentCardBase
          class="team-root member-card-button"
          :empty="!leaderAgent"
          :readonly="readonly"
          :title="leaderAgent || (teamName.trim() ? `${teamName.trim()} Leader` : '+')"
          :subtitle="leaderAgent ? 'Leader' : '负责人'"
          :avatar-name="leaderAgent"
          variant="leader"
          @click="handlePrimaryAction(leaderAgent)"
        />
        <div v-if="leaderAgent && (readonly || props.showEditAction)" class="member-action-group">
          <button
            v-if="readonly"
            class="member-action-button"
            type="button"
            @pointerdown.stop
            @click.stop="handleViewAction(leaderAgent)"
          >
            查看
          </button>
          <button
            v-else
            class="member-action-button"
            type="button"
            @pointerdown.stop
            @click.stop="handleEditAction(leaderAgent)"
          >
            编辑
          </button>
          <button
            v-if="!readonly"
            class="member-action-button"
            type="button"
            @pointerdown.stop
            @click.stop="emit('addSubordinate', leaderAgent)"
          >
            添加下属
          </button>
        </div>
      </div>

      <div
        v-if="topLevelNodes.length"
        ref="memberTreeRef"
        class="member-tree"
        :class="{ 'is-single-member': isSingleMemberLayout }"
      >
        <div v-if="!isSingleMemberLayout" class="member-rail" :style="railStyle" aria-hidden="true"></div>
        <div v-else class="member-single-link" aria-hidden="true"></div>

        <div class="member-slots" :class="{ 'is-single-member': isSingleMemberLayout }" :style="memberGridStyle">
          <div
            v-for="(memberNode, index) in topLevelNodes"
            :key="memberNode.id || `member-${index}`"
            class="member-node-shell"
          >
            <span v-if="!isSingleMemberLayout" class="member-top-link" aria-hidden="true"></span>
            <TeamMemberTreeNode
              :node="memberNode"
              :readonly="readonly"
              :show-edit-action="!!props.showEditAction"
              :top-level="true"
              @toggle-agent="emit('toggleAgent', $event)"
              @view-agent="emit('viewAgent', $event)"
              @edit-agent="emit('editAgent', $event)"
              @add-subordinate="emit('addSubordinate', $event)"
              @edit-pending-slot="emit('editPendingSlot', $event)"
              @remove-pending-slot="emit('removePendingSlot', $event)"
            />
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
  background-image: none;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  cursor: grab;
}

.member-graph.is-editing {
  background-color: rgba(148, 163, 184, 0.12);
  background-image:
    linear-gradient(to right, var(--member-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--member-grid-line) 1px, transparent 1px);
  background-size: var(--member-grid-size) var(--member-grid-size);
  background-position: 0 0;
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

.member-graph.is-panning .team-root.is-readonly,
.member-graph.is-panning :deep(.member-node.is-readonly) {
  cursor: grabbing;
}

.member-card-shell {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
}

.team-root-shell {
  width: 132px;
}

.member-card-button {
  width: 100%;
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

.member-node-shell {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
}

.member-top-link {
  position: absolute;
  top: calc(-1 * var(--member-branch-offset));
  left: 50%;
  width: 1px;
  height: var(--member-branch-offset);
  transform: translateX(-50%);
  background: var(--member-connector-line);
}

:deep(.member-node) {
  position: relative;
  width: var(--member-card-width);
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

:deep(.member-child-tree) {
  --member-child-offset: 18px;
  position: relative;
  display: grid;
  justify-items: center;
  width: max-content;
  margin-top: 18px;
  padding-top: var(--member-child-offset);
}

:deep(.member-child-tree::before) {
  content: '';
  position: absolute;
  top: calc(-1 * var(--member-child-offset));
  left: 50%;
  width: 1px;
  height: var(--member-child-offset);
  transform: translateX(-50%);
  background: var(--member-connector-line);
}

:deep(.member-child-tree.is-single-child::before) {
  height: calc(var(--member-child-offset) * 2);
}

:deep(.member-child-list) {
  position: relative;
  display: grid;
  gap: var(--member-gap);
  justify-items: center;
  width: max-content;
}

:deep(.member-child-rail) {
  position: absolute;
  top: 0;
  left: calc(var(--member-card-width) / 2);
  right: calc(var(--member-card-width) / 2);
  height: var(--member-child-offset);
  border-top: 1px solid var(--member-connector-line);
}

:deep(.member-child-shell) {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
}

:deep(.member-child-link) {
  position: absolute;
  top: calc(-1 * var(--member-child-offset));
  left: 50%;
  width: 1px;
  height: var(--member-child-offset);
  transform: translateX(-50%);
  background: var(--member-connector-line);
}

:deep(.member-action-group) {
  position: absolute;
  top: 10px;
  left: 0;
  right: 0;
  display: grid;
  justify-items: center;
  gap: 6px;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
  z-index: 3;
}

:deep(.member-action-button) {
  width: 78px;
  min-width: 0;
  height: 24px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 48%, var(--panel-border) 52%);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-bg) 76%, var(--selected) 24%);
  color: var(--text-strong);
  padding: 0 8px;
  font-size: 0.72rem;
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background 0.16s ease;
}

.member-card-shell.has-action > :deep(.member-card-button:hover + .member-action-group),
.member-card-shell.has-action > :deep(.member-card-button:focus-visible + .member-action-group),
.member-card-shell.has-action > :deep(.member-action-group:hover),
.member-card-shell.has-action > :deep(.member-action-group:focus-within),
:deep(.member-card-shell.has-action > .member-card-button:hover + .member-action-group),
:deep(.member-card-shell.has-action > .member-card-button:focus-visible + .member-action-group),
:deep(.member-card-shell.has-action > .member-action-group:hover),
:deep(.member-card-shell.has-action > .member-action-group:focus-within) {
  opacity: 1;
  transform: translateY(0);
}

:deep(.member-action-button:hover) {
  border-color: var(--focus-border);
  background: var(--selected);
}

:deep(.member-action-button--danger:hover) {
  border-color: color-mix(in srgb, #ef4444 62%, var(--focus-border) 38%);
  background: color-mix(in srgb, #fee2e2 82%, #fff 18%);
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
  .member-top-link,
  .member-single-link,
  :deep(.member-child-rail),
  :deep(.member-child-link),
  :deep(.member-child-tree::before) {
    display: none;
  }

  :deep(.member-action-group) {
    opacity: 1;
    transform: none;
  }

  .member-graph {
    min-height: auto;
  }
}
</style>
