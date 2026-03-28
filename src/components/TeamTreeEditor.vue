<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { updateTeam } from '../api';
import { useMemberEditorDialog, type MemberDriverOption } from '../composables/useMemberEditorDialog';
import ConfirmDialog from './ConfirmDialog.vue';
import TeamMembersCard from './TeamMembersCard.vue';
import MemberEditorDialog from './MemberEditorDialog.vue';
import type { AgentInfo, TeamMember } from '../types';
import type { TeamGraphNode } from './teamGraphTypes';

const props = defineProps<{
  teamId: number;
  teamName: string;
  members: TeamMember[];
  agents: AgentInfo[];
}>();

const emit = defineEmits<{
  saved: [];
}>();

const driverCatalog = ref<MemberDriverOption[]>([]);
const isSavingTeamMembers = ref(false);
const isReadonly = ref(true);
const teamMemberStatus = ref('');
const committedMembers = ref<TeamMember[]>([]);
const teamMembersDraft = ref<string[]>([]);
const teamMemberRoleDrafts = ref<Record<string, string>>({});
const teamMemberParentDrafts = ref<Record<string, string>>({});
const pendingSlots = ref<Array<{ id: string; parentName: string }>>([]);
const editingPendingSlotId = ref<string | null>(null);
const confirmState = ref<{
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  action: null | { type: 'remove-member'; agentName: string };
}>({
  title: '',
  message: '',
  confirmLabel: '确认',
  danger: true,
  action: null,
});

function buildTeamMemberDraft(members: TeamMember[]): string[] {
  return members.map((member) => member.name);
}

function buildTeamMemberRoleDraft(members: TeamMember[]): Record<string, string> {
  return Object.fromEntries(members.map((member) => [member.name, member.role_template]));
}

function buildTeamMemberParentDraft(members: TeamMember[]): Record<string, string> {
  const leaderName = members[0]?.name || '';
  return Object.fromEntries(
    members.slice(1).map((member) => [member.name, leaderName]),
  );
}

function buildTeamMemberPayload(): TeamMember[] {
  return teamMembersDraft.value.map((memberName) => ({
    name: memberName,
    role_template: teamMemberRoleDrafts.value[memberName] || memberName,
  }));
}

function cloneMembers(members: TeamMember[]): TeamMember[] {
  return members.map((member) => ({
    name: member.name,
    role_template: member.role_template,
  }));
}

function syncCommittedMembers(members: TeamMember[]): void {
  committedMembers.value = cloneMembers(members);
}

function syncDraftFromCommitted(): void {
  teamMembersDraft.value = buildTeamMemberDraft(committedMembers.value);
  teamMemberRoleDrafts.value = buildTeamMemberRoleDraft(committedMembers.value);
  teamMemberParentDrafts.value = buildTeamMemberParentDraft(committedMembers.value);
}

const selectedTeamMembers = computed(() => (
  teamMembersDraft.value
));

const selectedTeamMemberTemplates = computed<Record<string, string>>(() => {
  return { ...teamMemberRoleDrafts.value };
});

const graphRootNode = computed<TeamGraphNode | null>(() => {
  const leaderName = teamMembersDraft.value[0] ?? '';
  if (!leaderName) {
    return null;
  }

  const nodeMap = new Map<string, TeamGraphNode>();
  const ensureMemberNode = (memberName: string): TeamGraphNode => {
    const existing = nodeMap.get(memberName);
    if (existing) {
      return existing;
    }

    const node: TeamGraphNode = {
      id: memberName,
      kind: 'member',
      name: memberName,
      subtitle: teamMemberRoleDrafts.value[memberName] || memberName,
      avatarName: memberName,
      children: [],
    };
    nodeMap.set(memberName, node);
    return node;
  };

  const leaderNode = ensureMemberNode(leaderName);

  teamMembersDraft.value.slice(1).forEach((memberName) => {
    const memberNode = ensureMemberNode(memberName);
    const parentName = teamMemberParentDrafts.value[memberName] || leaderName;
    const parentNode = ensureMemberNode(parentName);
    parentNode.children.push(memberNode);
  });

  pendingSlots.value.forEach((slot) => {
    const parentName = slot.parentName || leaderName;
    const parentNode = ensureMemberNode(parentName);
    parentNode.children.push({
      id: slot.id,
      kind: 'pending',
      name: '',
      subtitle: '成员',
      avatarName: '',
      children: [],
    });
  });

  return leaderNode;
});

const hasTeamMemberChanges = computed(() =>
  JSON.stringify(buildTeamMemberPayload()) !== JSON.stringify(committedMembers.value),
);

const memberTemplateOptions = computed(() => {
  const definitions = new Map<string, { name: string; model: string }>();

  props.agents.forEach((agent) => {
    const templateName = agent.template_name || agent.name;
    if (!definitions.has(templateName)) {
      definitions.set(templateName, {
        name: templateName,
        model: agent.model || '未设置',
      });
    }
  });

  Object.values(teamMemberRoleDrafts.value).forEach((templateName) => {
    if (!definitions.has(templateName)) {
      definitions.set(templateName, {
        name: templateName,
        model: '未设置',
      });
    }
  });

  return Array.from(definitions.values()).sort((left, right) => left.name.localeCompare(right.name));
});

const availableMemberCandidates = computed(() => {
  const candidates: string[] = [];
  const seen = new Set<string>();

  props.agents.forEach((agent) => {
    const candidateName = agent.template_name || agent.name;
    if (!candidateName || seen.has(candidateName)) {
      return;
    }
    seen.add(candidateName);
    if (!teamMembersDraft.value.includes(candidateName)) {
      candidates.push(candidateName);
    }
  });

  return candidates;
});

function resolveMemberRoleTemplate(memberName: string): string {
  return teamMemberRoleDrafts.value[memberName]
    || committedMembers.value.find((member) => member.name === memberName)?.role_template
    || memberName;
}

function collectMemberBranch(memberName: string): string[] {
  const branch = [memberName];
  const queue = [memberName];

  while (queue.length) {
    const current = queue.shift()!;
    for (const [candidateName, parentName] of Object.entries(teamMemberParentDrafts.value)) {
      if (parentName !== current || branch.includes(candidateName)) {
        continue;
      }
      branch.push(candidateName);
      queue.push(candidateName);
    }
  }

  return branch;
}

const {
  editingMemberName,
  memberEditorKeyword,
  memberEditorTemplate,
  memberEditorDriver,
  memberEditorOpen,
  memberEditorEditable,
  currentMemberTemplateOption,
  filteredMemberTemplateOptions,
  memberDriverOptions,
  openMemberEditor,
  openMemberViewer,
  openPendingMemberEditor,
  closeMemberEditor,
  replaceSelectedTemplate,
  resetDialogState,
} = useMemberEditorDialog({
  teamId: computed(() => props.teamId),
  templateOptions: memberTemplateOptions,
  driverCatalog,
  resolveTemplate: resolveMemberRoleTemplate,
  canLoadMemberDetail: (memberName: string) =>
    committedMembers.value.some((member) => member.name === memberName),
});

const memberPanelActions = computed(() => {
  if (isReadonly.value) {
    return [
      { key: 'edit', label: '编辑团队成员', primary: true },
    ];
  }

  return [
    { key: 'cancel', label: '取消', disabled: isSavingTeamMembers.value },
    {
      key: 'save',
      label: isSavingTeamMembers.value ? '保存中...' : '保存',
      disabled: !hasTeamMemberChanges.value || isSavingTeamMembers.value || pendingSlots.value.length > 0,
      primary: true,
    },
  ];
});

watch(
  [() => props.teamId, () => JSON.stringify(props.members)] as const,
  ([teamId], [previousTeamId]) => {
    const teamChanged = previousTeamId === undefined || teamId !== previousTeamId;
    syncCommittedMembers(props.members);
    if (teamChanged || !pendingSlots.value.length) {
      syncDraftFromCommitted();
      pendingSlots.value = [];
      editingPendingSlotId.value = null;
      teamMemberStatus.value = '';
      isReadonly.value = true;
      resetDialogState();
    }
  },
  { immediate: true },
);

function cancelTeamMemberEdit(): void {
  syncDraftFromCommitted();
  pendingSlots.value = [];
  editingPendingSlotId.value = null;
  teamMemberStatus.value = '';
  isReadonly.value = true;
  closeMemberEditor();
}

async function saveTeamMembers(): Promise<void> {
  if (isSavingTeamMembers.value || !hasTeamMemberChanges.value) {
    return;
  }

  isSavingTeamMembers.value = true;
  teamMemberStatus.value = '';

  try {
    const nextMembers = buildTeamMemberPayload();
    await updateTeam(props.teamId, {
      members: nextMembers,
    });
    syncCommittedMembers(nextMembers);
    pendingSlots.value = [];
    editingPendingSlotId.value = null;
    teamMemberStatus.value = '已保存';
    isReadonly.value = true;
    closeMemberEditor();
    emit('saved');
  } catch (error) {
    console.error(error);
    teamMemberStatus.value = '保存失败';
  } finally {
    isSavingTeamMembers.value = false;
  }
}

function handleMemberPanelAction(actionKey: string): void {
  if (actionKey === 'edit') {
    isReadonly.value = false;
    return;
  }

  if (actionKey === 'cancel') {
    cancelTeamMemberEdit();
    return;
  }

  if (actionKey === 'save') {
    void saveTeamMembers();
  }
}

function toggleTeamMember(agentName: string): void {
  if (teamMembersDraft.value.includes(agentName)) {
    requestRemoveMember(agentName);
    return;
  }

  teamMembersDraft.value = [...teamMembersDraft.value, agentName];
  teamMemberRoleDrafts.value = {
    ...teamMemberRoleDrafts.value,
    [agentName]: teamMemberRoleDrafts.value[agentName] || agentName,
  };
}

function saveMemberEditor(): void {
  if (!memberEditorTemplate.value) {
    return;
  }

  if (editingPendingSlotId.value) {
    const nextMemberName = memberEditorTemplate.value;
    const pendingSlot = pendingSlots.value.find((slot) => slot.id === editingPendingSlotId.value);
    if (!teamMembersDraft.value.includes(nextMemberName)) {
      teamMembersDraft.value = [...teamMembersDraft.value, nextMemberName];
    }
    teamMemberRoleDrafts.value = {
      ...teamMemberRoleDrafts.value,
      [nextMemberName]: memberEditorTemplate.value,
    };
    teamMemberParentDrafts.value = {
      ...teamMemberParentDrafts.value,
      [nextMemberName]: pendingSlot?.parentName || teamMembersDraft.value[0] || '',
    };
    pendingSlots.value = pendingSlots.value.filter((slot) => slot.id !== editingPendingSlotId.value);
    editingPendingSlotId.value = null;
    closeMemberEditor();
    return;
  }

  if (!editingMemberName.value) {
    return;
  }

  teamMemberRoleDrafts.value = {
    ...teamMemberRoleDrafts.value,
    [editingMemberName.value]: memberEditorTemplate.value,
  };
  closeMemberEditor();
}

function createPendingSlotId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addSubordinate(parentName: string): void {
  if (!availableMemberCandidates.value.length) {
    teamMemberStatus.value = '没有可添加成员';
    return;
  }

  pendingSlots.value = [...pendingSlots.value, { id: createPendingSlotId(), parentName }];
  teamMemberStatus.value = '';
}

function editPendingSlot(slotId: string): void {
  editingPendingSlotId.value = slotId;
  openPendingMemberEditor();
}

function removePendingSlot(slotId: string): void {
  pendingSlots.value = pendingSlots.value.filter((item) => item.id !== slotId);
  if (editingPendingSlotId.value === slotId) {
    editingPendingSlotId.value = null;
    closeMemberEditor();
  }
}

function requestRemoveMember(agentName: string): void {
  confirmState.value = {
    title: '移除成员',
    message: `确认移除成员“${agentName}”吗？`,
    confirmLabel: '移除',
    danger: true,
    action: {
      type: 'remove-member',
      agentName,
    },
  };
}

function closeConfirmDialog(): void {
  confirmState.value = {
    title: '',
    message: '',
    confirmLabel: '确认',
    danger: true,
    action: null,
  };
}

function confirmDangerAction(): void {
  const action = confirmState.value.action;
  if (!action) {
    return;
  }

  const removedNames = new Set(collectMemberBranch(action.agentName));
  teamMembersDraft.value = teamMembersDraft.value.filter((item) => !removedNames.has(item));
  const nextRoleDrafts = { ...teamMemberRoleDrafts.value };
  const nextParentDrafts = { ...teamMemberParentDrafts.value };
  removedNames.forEach((name) => {
    delete nextRoleDrafts[name];
    delete nextParentDrafts[name];
  });
  teamMemberRoleDrafts.value = nextRoleDrafts;
  teamMemberParentDrafts.value = nextParentDrafts;
  pendingSlots.value = pendingSlots.value.filter((slot) => !removedNames.has(slot.parentName));
  if (editingMemberName.value && removedNames.has(editingMemberName.value)) {
    closeMemberEditor();
  }
  if (editingPendingSlotId.value) {
    const editingSlot = pendingSlots.value.find((slot) => slot.id === editingPendingSlotId.value);
    if (!editingSlot) {
      editingPendingSlotId.value = null;
      closeMemberEditor();
    }
  }

  closeConfirmDialog();
}
</script>

<template>
  <div class="team-tree-editor">
    <p v-if="teamMemberStatus" class="team-member-status">{{ teamMemberStatus }}</p>

    <TeamMembersCard
      :team-name="teamName"
      :selected-agents="selectedTeamMembers"
      :member-templates="selectedTeamMemberTemplates"
      :root-node="graphRootNode"
      :readonly="isReadonly"
      :actions="memberPanelActions"
      :show-edit-action="!isReadonly"
      @action="handleMemberPanelAction"
      @toggle-agent="toggleTeamMember"
      @view-agent="openMemberViewer"
      @edit-agent="openMemberEditor"
      @add-subordinate="addSubordinate"
      @edit-pending-slot="editPendingSlot"
      @remove-pending-slot="removePendingSlot"
    />

    <MemberEditorDialog
      :open="memberEditorOpen"
      :editable="memberEditorEditable"
      :member-name="editingMemberName"
      :keyword="memberEditorKeyword"
      :selected-template="memberEditorTemplate"
      :current-template-model="currentMemberTemplateOption?.model || '未设置'"
      :driver="memberEditorDriver"
      :driver-options="memberDriverOptions"
      :template-options="filteredMemberTemplateOptions"
      @close="closeMemberEditor"
      @save="saveMemberEditor"
      @update:keyword="memberEditorKeyword = $event"
      @update:selected-template="replaceSelectedTemplate($event)"
      @update:driver="memberEditorDriver = $event"
    />

    <ConfirmDialog
      :open="!!confirmState.action"
      :title="confirmState.title"
      :message="confirmState.message"
      :confirm-label="confirmState.confirmLabel"
      :danger="confirmState.danger"
      @close="closeConfirmDialog"
      @confirm="confirmDangerAction"
    />
  </div>
</template>

<style scoped>
.team-tree-editor {
  display: grid;
  gap: 10px;
  min-height: 0;
  align-items: start;
}

.team-member-status {
  margin: -2px 0 0;
  color: var(--muted);
  font-size: 0.72rem;
}
</style>
