<script setup lang="ts">
import TeamMemberGraph from './TeamMemberGraph.vue';

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
  readonly?: boolean;
  actions?: MemberPanelAction[];
  showEditAction?: boolean;
}>(), {
  memberTemplates: () => ({}),
  readonly: false,
  actions: () => [],
  showEditAction: false,
});

const emit = defineEmits<{
  toggleAgent: [agentName: string];
  viewAgent: [agentName: string];
  editAgent: [agentName: string];
  action: [key: string];
}>();
</script>

<template>
  <section class="member-panel">
    <div class="member-panel-head">
      <div class="member-panel-head-segment member-panel-head-segment--label">
        <span class="panel-label">团队成员</span>
      </div>
      <div v-if="actions.length" class="member-panel-head-segment member-panel-head-segment--action">
        <button
          v-for="action in actions"
          :key="action.key"
          type="button"
          class="member-panel-action"
          :class="{ 'member-panel-action--primary': action.primary }"
          :disabled="action.disabled"
          @click="emit('action', action.key)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>

    <TeamMemberGraph
      :team-name="teamName"
      :selected-agents="selectedAgents"
      :member-templates="memberTemplates"
      :readonly="readonly"
      :show-edit-action="showEditAction"
      @toggle-agent="emit('toggleAgent', $event)"
      @view-agent="emit('viewAgent', $event)"
      @edit-agent="emit('editAgent', $event)"
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
}

.member-panel-head {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  min-height: 36px;
}

.member-panel-head-segment {
  display: inline-flex;
  align-items: center;
  min-height: 36px;
  background: #fff;
  padding: 0 8px;
}

.member-panel-head-segment--action {
  margin-left: auto;
  gap: 8px;
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

.member-panel-action {
  height: 30px;
  border: 1px solid var(--team-create-control-border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-strong);
  padding: 0 12px;
  font-size: 0.82rem;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease;
}

.member-panel-action:hover:not(:disabled) {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 46%, #fff 54%);
  color: color-mix(in srgb, var(--text-strong) 88%, var(--focus-border) 12%);
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
