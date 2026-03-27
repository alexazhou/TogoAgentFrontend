<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { updateTeam } from '../api';
import { useMemberEditorDialog, type MemberDriverOption } from '../composables/useMemberEditorDialog';
import TeamMembersCard from './TeamMembersCard.vue';
import MemberEditorDialog from './MemberEditorDialog.vue';
import type { AgentInfo, TeamMember } from '../types';

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
const isEditingTeamMembers = ref(false);
const isSavingTeamMembers = ref(false);
const teamMemberStatus = ref('');
const committedMembers = ref<TeamMember[]>([]);
const teamMembersDraft = ref<string[]>([]);
const teamMemberRoleDrafts = ref<Record<string, string>>({});

function buildTeamMemberDraft(members: TeamMember[]): string[] {
  return members.map((member) => member.name);
}

function buildTeamMemberRoleDraft(members: TeamMember[]): Record<string, string> {
  return Object.fromEntries(members.map((member) => [member.name, member.role_template]));
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
}

const selectedTeamMembers = computed(() => (
  isEditingTeamMembers.value
    ? teamMembersDraft.value
    : committedMembers.value.map((member) => member.name)
));

const selectedTeamMemberTemplates = computed<Record<string, string>>(() => {
  if (isEditingTeamMembers.value) {
    return { ...teamMemberRoleDrafts.value };
  }

  return Object.fromEntries(committedMembers.value.map((member) => [member.name, member.role_template]));
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

function resolveMemberRoleTemplate(memberName: string): string {
  return teamMemberRoleDrafts.value[memberName]
    || committedMembers.value.find((member) => member.name === memberName)?.role_template
    || memberName;
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
  closeMemberEditor,
  replaceSelectedTemplate,
  resetDialogState,
} = useMemberEditorDialog({
  teamId: computed(() => props.teamId),
  templateOptions: memberTemplateOptions,
  driverCatalog,
  resolveTemplate: resolveMemberRoleTemplate,
});

const memberPanelActions = computed(() => {
  if (isEditingTeamMembers.value) {
    return [
      { key: 'cancel', label: '取消', disabled: isSavingTeamMembers.value },
      {
        key: 'save',
        label: isSavingTeamMembers.value ? '保存中...' : '保存',
        disabled: !hasTeamMemberChanges.value || isSavingTeamMembers.value,
        primary: true,
      },
    ];
  }

  return [
    { key: 'edit', label: '编辑', disabled: isSavingTeamMembers.value },
  ];
});

watch(
  [() => props.teamId, () => JSON.stringify(props.members)] as const,
  ([teamId], [previousTeamId]) => {
    const teamChanged = previousTeamId === undefined || teamId !== previousTeamId;
    syncCommittedMembers(props.members);
    if (teamChanged || !isEditingTeamMembers.value) {
      syncDraftFromCommitted();
      teamMemberStatus.value = '';
      if (!isEditingTeamMembers.value) {
        resetDialogState();
      }
    }
  },
  { immediate: true },
);

function toggleTeamMemberEdit(): void {
  syncDraftFromCommitted();
  teamMemberStatus.value = '';
  isEditingTeamMembers.value = true;
}

function cancelTeamMemberEdit(): void {
  syncDraftFromCommitted();
  isEditingTeamMembers.value = false;
  teamMemberStatus.value = '';
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
    isEditingTeamMembers.value = false;
    teamMemberStatus.value = '已保存';
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
    toggleTeamMemberEdit();
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
  if (!isEditingTeamMembers.value) {
    return;
  }

  if (teamMembersDraft.value.includes(agentName)) {
    teamMembersDraft.value = teamMembersDraft.value.filter((item) => item !== agentName);
    const nextRoleDrafts = { ...teamMemberRoleDrafts.value };
    delete nextRoleDrafts[agentName];
    teamMemberRoleDrafts.value = nextRoleDrafts;
    if (editingMemberName.value === agentName) {
      closeMemberEditor();
    }
    return;
  }

  teamMembersDraft.value = [...teamMembersDraft.value, agentName];
  teamMemberRoleDrafts.value = {
    ...teamMemberRoleDrafts.value,
    [agentName]: teamMemberRoleDrafts.value[agentName] || agentName,
  };
}

function saveMemberEditor(): void {
  if (!editingMemberName.value || !memberEditorTemplate.value) {
    return;
  }

  teamMemberRoleDrafts.value = {
    ...teamMemberRoleDrafts.value,
    [editingMemberName.value]: memberEditorTemplate.value,
  };
  closeMemberEditor();
}
</script>

<template>
  <div class="team-tree-editor">
    <p v-if="teamMemberStatus" class="team-member-status">{{ teamMemberStatus }}</p>

    <TeamMembersCard
      :team-name="teamName"
      :selected-agents="selectedTeamMembers"
      :member-templates="selectedTeamMemberTemplates"
      :readonly="!isEditingTeamMembers"
      :actions="memberPanelActions"
      :show-edit-action="isEditingTeamMembers"
      @action="handleMemberPanelAction"
      @toggle-agent="toggleTeamMember"
      @view-agent="openMemberViewer"
      @edit-agent="openMemberEditor"
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
