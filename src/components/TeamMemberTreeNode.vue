<script setup lang="ts">
import AgentCardBase from './AgentCardBase.vue';
import type { TeamGraphNode } from './teamGraphTypes';

const props = defineProps<{
  node: TeamGraphNode;
  readonly: boolean;
  showEditAction: boolean;
  topLevel?: boolean;
}>();

const emit = defineEmits<{
  toggleAgent: [agentName: string];
  viewAgent: [agentName: string];
  editAgent: [agentName: string];
  addSubordinate: [agentName: string];
  editPendingSlot: [slotId: string];
  removePendingSlot: [slotId: string];
}>();

function handlePrimaryAction(): void {
  if (props.node.kind !== 'member' || props.readonly || props.showEditAction) {
    return;
  }

  emit('toggleAgent', props.node.name);
}

function handleViewAction(): void {
  if (props.node.kind !== 'member') {
    return;
  }

  if (props.readonly) {
    emit('viewAgent', props.node.name);
    return;
  }

  emit('toggleAgent', props.node.name);
}

function handleEditAction(): void {
  if (props.node.kind === 'pending') {
    emit('editPendingSlot', props.node.id);
    return;
  }

  emit('editAgent', props.node.name);
}
</script>

<template>
  <div
    class="member-card-shell member-node-shell"
    :class="{ 'has-action': node.kind === 'pending' || !!node.name, 'has-children': !!node.children.length }"
  >
    <AgentCardBase
      class="member-node member-card-button"
      :class="{ 'top-level-node': topLevel }"
      :empty="node.kind === 'pending'"
      :readonly="readonly"
      :title="node.kind === 'pending' ? '+' : node.name"
      :subtitle="node.subtitle"
      :avatar-name="node.kind === 'pending' ? '' : node.avatarName"
      variant="graph"
      @click="handlePrimaryAction"
    />

    <div class="member-action-group">
      <template v-if="node.kind === 'pending' && !readonly && showEditAction">
        <button
          class="member-action-button"
          type="button"
          @pointerdown.stop
          @click.stop="emit('editPendingSlot', node.id)"
        >
          编辑
        </button>
        <button
          class="member-action-button member-action-button--danger"
          type="button"
          @pointerdown.stop
          @click.stop="emit('removePendingSlot', node.id)"
        >
          删除
        </button>
      </template>

      <template v-else-if="node.kind === 'member'">
        <button
          v-if="readonly"
          class="member-action-button"
          type="button"
          @pointerdown.stop
          @click.stop="handleViewAction"
        >
          查看
        </button>
        <template v-else-if="showEditAction">
          <button
            class="member-action-button"
            type="button"
            @pointerdown.stop
            @click.stop="handleEditAction"
          >
            编辑
          </button>
          <button
            class="member-action-button"
            type="button"
            @pointerdown.stop
            @click.stop="emit('addSubordinate', node.name)"
          >
            添加下属
          </button>
          <button
            class="member-action-button member-action-button--danger"
            type="button"
            @pointerdown.stop
            @click.stop="emit('toggleAgent', node.name)"
          >
            移除
          </button>
        </template>
        <button
          v-else
          class="member-action-button"
          type="button"
          @pointerdown.stop
          @click.stop="emit('toggleAgent', node.name)"
        >
          移除
        </button>
      </template>
    </div>

    <div
      v-if="node.children.length"
      class="member-child-tree"
      :class="{ 'is-single-child': node.children.length === 1 }"
    >
      <div
        v-if="node.children.length > 1"
        class="member-child-rail"
        aria-hidden="true"
      ></div>

      <div
        class="member-child-list"
        :style="{ gridTemplateColumns: `repeat(${node.children.length}, var(--member-card-width))` }"
      >
        <div
          v-for="child in node.children"
          :key="child.id"
          class="member-child-shell"
        >
          <span class="member-child-link" aria-hidden="true"></span>
          <TeamMemberTreeNode
            :node="child"
            :readonly="readonly"
            :show-edit-action="showEditAction"
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
</template>

<style scoped>
.member-card-shell,
.member-node-shell,
.member-child-shell {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
}

.member-card-button {
  width: var(--member-card-width);
  justify-self: center;
}

.member-child-tree {
  --member-child-offset: 18px;
  position: relative;
  display: grid;
  justify-items: center;
  justify-self: center;
  width: max-content;
  margin-top: 18px;
  padding-top: var(--member-child-offset);
}

.member-child-tree::before {
  content: '';
  position: absolute;
  top: calc(-1 * var(--member-child-offset));
  left: 50%;
  width: 1px;
  height: var(--member-child-offset);
  transform: translateX(-50%);
  background: var(--member-connector-line);
}

.member-child-tree.is-single-child::before {
  height: calc(var(--member-child-offset) * 2);
}

.member-child-list {
  position: relative;
  display: grid;
  gap: var(--member-gap);
  justify-items: center;
  width: max-content;
}

.member-child-rail {
  position: absolute;
  top: 0;
  left: calc(var(--member-card-width) / 2);
  right: calc(var(--member-card-width) / 2);
  height: var(--member-child-offset);
  border-top: 1px solid var(--member-connector-line);
}

.member-child-link {
  position: absolute;
  top: calc(-1 * var(--member-child-offset));
  left: 50%;
  width: 1px;
  height: var(--member-child-offset);
  transform: translateX(-50%);
  background: var(--member-connector-line);
}
</style>
