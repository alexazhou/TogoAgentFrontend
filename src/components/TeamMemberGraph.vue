<script setup lang="ts">
import { computed } from 'vue';
import AgentCardBase from './AgentCardBase.vue';
import { useTeamGraphLayout } from './useTeamGraphLayout';

const props = defineProps<{
  teamName: string;
  selectedAgents: string[];
  memberTemplates?: Record<string, string>;
  readonly?: boolean;
  showEditAction?: boolean;
}>();

const emit = defineEmits<{
  toggleAgent: [agentName: string];
  viewAgent: [agentName: string];
  editAgent: [agentName: string];
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
const memberTemplates = computed(() => props.memberTemplates ?? {});
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

function getMemberSubtitle(agentName: string, fallback: string): string {
  return memberTemplates.value[agentName] || fallback;
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
        </div>
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
            <AgentCardBase
              class="member-node member-card-button"
              :empty="!member.name"
              :readonly="readonly"
              :title="member.name || '+'"
              :subtitle="member.name ? getMemberSubtitle(member.name, member.agent) : '成员'"
              :avatar-name="member.name"
              variant="graph"
              @click="handlePrimaryAction(member.name)"
            />
            <div v-if="member.name" class="member-action-group">
              <button
                v-if="readonly"
                class="member-action-button"
                type="button"
                @pointerdown.stop
                @click.stop="handleViewAction(member.name)"
              >
                查看
              </button>
              <template v-else-if="props.showEditAction">
                <button
                  class="member-action-button"
                  type="button"
                  @pointerdown.stop
                  @click.stop="handleEditAction(member.name)"
                >
                  编辑
                </button>
                <button
                  class="member-action-button member-action-button--danger"
                  type="button"
                  @pointerdown.stop
                  @click.stop="emit('toggleAgent', member.name)"
                >
                  移除
                </button>
              </template>
              <button
                v-else
                class="member-action-button"
                type="button"
                @pointerdown.stop
                @click.stop="emit('toggleAgent', member.name)"
              >
                移除
              </button>
            </div>
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

.member-action-group {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  gap: 6px;
  opacity: 0;
  transform: translateY(-4px);
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
  z-index: 3;
}

.member-action-button {
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
  transition:
    border-color 0.16s ease,
    background 0.16s ease;
}

.member-card-shell.has-action:hover .member-action-group,
.member-card-shell.has-action:focus-within .member-action-group {
  opacity: 1;
  transform: translateY(0);
}

.member-action-button:hover {
  border-color: var(--focus-border);
  background: var(--selected);
}

.member-action-button--danger:hover {
  border-color: color-mix(in srgb, #ef4444 62%, var(--focus-border) 38%);
  background: color-mix(in srgb, #fee2e2 82%, #fff 18%);
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
    transform: none;
  }

  .member-action-group {
    opacity: 1;
    transform: none;
  }

  .member-graph {
    min-height: auto;
  }
}

</style>
