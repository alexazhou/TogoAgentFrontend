<script setup lang="ts">
import TeamMemberGraph from './TeamMemberGraph.vue';
import type { TeamGraphNode } from './teamGraphTypes';

type MemberPanelAction = {
  key: string;
  label: string;
  disabled?: boolean;
  primary?: boolean;
};

withDefaults(defineProps<{
  teamName: string;
  selectedAgents: string[];
  memberTemplates?: Record<string, string>;
  rootNode?: TeamGraphNode | null;
  readonly?: boolean;
  actions?: MemberPanelAction[];
  showEditAction?: boolean;
}>(), {
  memberTemplates: () => ({}),
  rootNode: null,
  readonly: false,
  actions: () => [],
  showEditAction: false,
});

const emit = defineEmits<{
  toggleAgent: [agentName: string];
  viewAgent: [agentName: string];
  editAgent: [agentName: string];
  addSubordinate: [agentName: string];
  editPendingSlot: [slotId: string];
  removePendingSlot: [slotId: string];
  action: [key: string];
}>();
</script>

<template>
  <section class="member-panel">
    <div class="member-panel-head">
      <div class="member-panel-head-segment member-panel-head-segment--label">
        <span class="panel-label">团队成员</span>
      </div>
    </div>

    <div v-if="actions.length" class="member-panel-actions">
        <button
          v-for="action in actions"
          :key="action.key"
          type="button"
          class="secondary-button member-panel-action"
          :class="{ 'member-panel-action--primary': action.primary }"
          :disabled="action.disabled"
          @click="emit('action', action.key)"
        >
          {{ action.label }}
        </button>
    </div>

    <TeamMemberGraph
      :team-name="teamName"
      :selected-agents="selectedAgents"
      :member-templates="memberTemplates"
      :root-node="rootNode"
      :readonly="readonly"
      :show-edit-action="showEditAction"
      @toggle-agent="emit('toggleAgent', $event)"
      @view-agent="emit('viewAgent', $event)"
      @edit-agent="emit('editAgent', $event)"
      @add-subordinate="emit('addSubordinate', $event)"
      @edit-pending-slot="emit('editPendingSlot', $event)"
      @remove-pending-slot="emit('removePendingSlot', $event)"
    />
  </section>
</template>

<style scoped>
.member-panel {
  position: relative;
  display: grid;
  gap: 8px;
  border: 1px solid var(--team-create-panel-border);
  border-radius: 20px;
  background: var(--panel-bg);
  box-shadow: var(--panel-shadow);
  padding: 10px 12px;
  min-height: 0;
  overflow: hidden;
  align-self: stretch;
  padding-bottom: 54px;
}

.member-panel-head {
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  min-height: 36px;
}

.member-panel-head-segment {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  background: #fff;
  padding: 0 8px;
}

.panel-label {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text-strong);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.member-panel-actions {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.member-panel-action {
  height: 30px;
  min-width: 108px;
  padding: 0 12px;
  font-size: 0.82rem;
}

.member-panel-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.member-panel-action--primary {
  border-color: color-mix(in srgb, var(--focus-border) 45%, var(--team-create-control-border) 55%);
  background: color-mix(in srgb, var(--selected) 22%, #fff 78%);
}
</style>
