<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getAgentsByTeamId, getDeptTree, getRoleTemplates, setAgentsByTeamId, setDeptTree } from '../api';
import {
  useMemberEditorDialog,
  type MemberDriverOption,
  type MemberTemplateOption,
} from '../composables/useMemberEditorDialog';
import ConfirmDialog from './ConfirmDialog.vue';
import TeamMembersCard from './TeamMembersCard.vue';
import MemberEditorDialog from './MemberEditorDialog.vue';
import type { DeptTreeNode, TeamMember } from '../types';
import type { AgentInfo } from '../types';
import type { TeamGraphNode } from './teamGraphTypes';

const props = defineProps<{
  teamId: number;
  teamName: string;
}>();

const emit = defineEmits<{
  saved: [];
}>();

const driverCatalog = ref<MemberDriverOption[]>([]);
const roleTemplateCatalog = ref<MemberTemplateOption[]>([]);
const isLoading = ref(false);
const isSavingTeamMembers = ref(false);
const isReadonly = ref(true);
const teamMemberStatus = ref('');
const committedAgents = ref<AgentInfo[]>([]);
const committedDeptTree = ref<DeptTreeNode | null>(null);
const committedMembers = ref<TeamMember[]>([]);
const teamMembersDraft = ref<string[]>([]);
const teamMemberRoleDrafts = ref<Record<string, string>>({});
const teamMemberDriverDrafts = ref<Record<string, string>>({});
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

function cloneDeptTree(node: DeptTreeNode | null): DeptTreeNode | null {
  if (!node) {
    return null;
  }

  return {
    dept_name: node.dept_name,
    dept_responsibility: node.dept_responsibility,
    manager: node.manager,
    members: [...node.members],
    children: node.children.map((child) => cloneDeptTree(child)!),
  };
}

function cloneMembers(members: TeamMember[]): TeamMember[] {
  return members.map((member) => ({
    name: member.name,
    role_template: member.role_template,
  }));
}

function normalizeTeamMembers(members: TeamMember[]): TeamMember[] {
  return cloneMembers(members).sort((left, right) => left.name.localeCompare(right.name));
}

function buildFallbackDeptTree(members: TeamMember[]): DeptTreeNode | null {
  const leaderName = members[0]?.name ?? '';
  if (!leaderName) {
    return null;
  }

  return {
    dept_name: leaderName,
    dept_responsibility: '',
    manager: leaderName,
    members: [leaderName],
    children: members.slice(1).map((member) => ({
      dept_name: member.name,
      dept_responsibility: '',
      manager: member.name,
      members: [member.name],
      children: [],
    })),
  };
}

function buildCommittedTreeBaseline(): DeptTreeNode | null {
  return cloneDeptTree(committedDeptTree.value) ?? buildFallbackDeptTree(committedMembers.value);
}

function buildTeamMemberRoleDraft(members: TeamMember[]): Record<string, string> {
  return Object.fromEntries(members.map((member) => [member.name, member.role_template]));
}

function buildTeamMemberDriverDraft(agents: AgentInfo[]): Record<string, string> {
  return Object.fromEntries(agents.map((agent) => [agent.name, agent.driver || '{}']));
}

function resolveTreeNodeMemberName(node: DeptTreeNode): string {
  const managerName = node.manager.trim();
  if (managerName) {
    return managerName;
  }

  if (node.members.length === 1) {
    return node.members[0]?.trim() || '';
  }

  if (node.members.length === 0) {
    return node.dept_name.trim();
  }

  return '';
}

function buildFallbackAgentsFromTree(tree: DeptTreeNode | null): AgentInfo[] {
  if (!tree) {
    return [];
  }

  const names: string[] = [];
  const stack = [tree];

  while (stack.length) {
    const current = stack.pop()!;
    const memberName = resolveTreeNodeMemberName(current);
    if (memberName && !names.includes(memberName)) {
      names.push(memberName);
    }

    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      stack.push(current.children[index]);
    }
  }

  return names.map((name) => ({
    id: null,
    name,
    employee_number: null,
    template_name: null,
    role_template_name: '',
    model: '',
    team_name: props.teamName,
    status: 'idle',
    employ_status: null,
    driver: '{}',
  }));
}

function buildDraftHierarchy(tree: DeptTreeNode | null, members: TeamMember[]): {
  orderedMembers: string[];
  parentMap: Record<string, string>;
} {
  const fallbackTree = tree ?? buildFallbackDeptTree(members);
  if (!fallbackTree) {
    return { orderedMembers: [], parentMap: {} };
  }

  const orderedMembers: string[] = [];
  const parentMap: Record<string, string> = {};

  const visitNode = (node: DeptTreeNode, parentName = ''): void => {
    const managerName = resolveTreeNodeMemberName(node);
    if (managerName && !orderedMembers.includes(managerName)) {
      orderedMembers.push(managerName);
      if (parentName) {
        parentMap[managerName] = parentName;
      }
    }

    const childManagerNames = new Set(
      node.children
        .map((child) => resolveTreeNodeMemberName(child))
        .filter(Boolean),
    );

    const nodeMembers = node.members.length ? node.members : (managerName ? [managerName] : []);

    nodeMembers.forEach((memberName) => {
      const normalizedName = memberName.trim();
      if (
        !normalizedName
        || normalizedName === managerName
        || childManagerNames.has(normalizedName)
        || orderedMembers.includes(normalizedName)
      ) {
        return;
      }
      orderedMembers.push(normalizedName);
      if (managerName) {
        parentMap[normalizedName] = managerName;
      }
    });

    node.children.forEach((child) => visitNode(child, managerName));
  };

  visitNode(fallbackTree);
  return { orderedMembers, parentMap };
}

function buildAgentConfigPayload(): Array<{
  id: number;
  name: string;
  role_template_name: string;
  model: string;
  driver: string;
}> {
  return committedAgents.value
    .filter((agent): agent is AgentInfo & { id: number } => typeof agent.id === 'number')
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      role_template_name: teamMemberRoleDrafts.value[agent.name] || agent.role_template_name || agent.template_name || agent.name,
      model: agent.model || '',
      driver: teamMemberDriverDrafts.value[agent.name] || agent.driver || '{}',
    }));
}

function buildDeptTreePayload(): DeptTreeNode | null {
  const leaderName = teamMembersDraft.value[0] ?? '';
  if (!leaderName) {
    return null;
  }

  const childrenByParent = new Map<string, string[]>();
  Object.entries(teamMemberParentDrafts.value).forEach(([memberName, parentName]) => {
    if (!parentName) {
      return;
    }
    const siblings = childrenByParent.get(parentName) ?? [];
    siblings.push(memberName);
    childrenByParent.set(parentName, siblings);
  });

  const buildNode = (memberName: string): DeptTreeNode => {
    const childNames = childrenByParent.get(memberName) ?? [];
    return {
      dept_name: memberName,
      dept_responsibility: '',
      manager: memberName,
      members: [memberName],
      children: childNames.map((childName) => buildNode(childName)),
    };
  };

  return buildNode(leaderName);
}

function syncCommittedMembers(members: TeamMember[]): void {
  committedMembers.value = normalizeTeamMembers(members);
}

function syncDraftFromCommitted(): void {
  const { orderedMembers, parentMap } = buildDraftHierarchy(committedDeptTree.value, committedMembers.value);
  teamMembersDraft.value = orderedMembers;
  teamMemberRoleDrafts.value = buildTeamMemberRoleDraft(committedMembers.value);
  teamMemberParentDrafts.value = parentMap;
}

function syncCommittedState(tree: DeptTreeNode | null, agents: AgentInfo[]): void {
  const nextAgents = agents.length ? agents : buildFallbackAgentsFromTree(tree);
  committedDeptTree.value = cloneDeptTree(tree);
  committedAgents.value = nextAgents.map((agent) => ({ ...agent }));
  teamMemberDriverDrafts.value = buildTeamMemberDriverDraft(nextAgents);
  const members = nextAgents.map((agent) => ({
    name: agent.name,
    role_template: agent.role_template_name || agent.template_name || agent.name,
  }));
  syncCommittedMembers(members);
  syncDraftFromCommitted();
}

const selectedTeamMembers = computed(() => (
  teamMembersDraft.value
));

const selectedTeamMemberTemplates = computed<Record<string, string>>(() => {
  return { ...teamMemberRoleDrafts.value };
});

const teamMemberEmployeeNumberDrafts = computed<Record<string, string>>(() => {
  return Object.fromEntries(
    committedAgents.value
      .filter((agent) => agent.name)
      .map((agent) => [agent.name, typeof agent.employee_number === 'number' ? String(agent.employee_number) : '']),
  );
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
      employeeNumber: teamMemberEmployeeNumberDrafts.value[memberName] || '',
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

const hasMemberConfigChanges = computed(() =>
  JSON.stringify(buildAgentConfigPayload()) !== JSON.stringify(
    committedAgents.value
      .filter((agent): agent is AgentInfo & { id: number } => typeof agent.id === 'number')
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        role_template_name: agent.role_template_name || agent.template_name || agent.name,
        model: agent.model || '',
        driver: agent.driver || '{}',
      })),
  ),
);

const hasDeptTreeChanges = computed(() =>
  JSON.stringify(buildDeptTreePayload()) !== JSON.stringify(buildCommittedTreeBaseline()),
);

const hasTeamMemberChanges = computed(() =>
  hasMemberConfigChanges.value || hasDeptTreeChanges.value,
);

const memberTemplateOptions = computed(() => {
  const definitions = new Map<string, { name: string; model: string }>();

  roleTemplateCatalog.value.forEach((template) => {
    const templateName = template.name;
    if (!definitions.has(templateName)) {
      definitions.set(templateName, {
        name: templateName,
        model: template.model || '未设置',
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
      { key: 'edit', label: '编辑团队组织', primary: true, disabled: isLoading.value },
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
  () => props.teamId,
  async () => {
    const requestTeamId = props.teamId;
    isLoading.value = true;
    teamMemberStatus.value = '';
    try {
      const [deptTree, teamAgents, roleTemplates] = await Promise.all([
        getDeptTree(requestTeamId),
        getAgentsByTeamId(requestTeamId),
        getRoleTemplates(),
      ]);
      if (requestTeamId !== props.teamId) {
        return;
      }

      roleTemplateCatalog.value = roleTemplates;
      const nextMembers = teamAgents.map((agent) => ({
        ...agent,
      }));

      syncCommittedState(deptTree, nextMembers);
      pendingSlots.value = [];
      editingPendingSlotId.value = null;
      teamMemberStatus.value = '';
      isReadonly.value = true;
      resetDialogState();
    } catch (error) {
      console.error(error);
      if (requestTeamId !== props.teamId) {
        return;
      }
      roleTemplateCatalog.value = [];
      committedAgents.value = [];
      committedDeptTree.value = null;
      committedMembers.value = [];
      teamMembersDraft.value = [];
      teamMemberRoleDrafts.value = {};
      teamMemberDriverDrafts.value = {};
      teamMemberParentDrafts.value = {};
      pendingSlots.value = [];
      editingPendingSlotId.value = null;
      teamMemberStatus.value = '加载失败';
      isReadonly.value = true;
      resetDialogState();
    } finally {
      if (requestTeamId === props.teamId) {
        isLoading.value = false;
      }
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
    const nextAgentConfigs = buildAgentConfigPayload();
    const nextDeptTree = buildDeptTreePayload();

    if (hasMemberConfigChanges.value) {
      await setAgentsByTeamId(props.teamId, nextAgentConfigs);
    }

    if (nextDeptTree && hasDeptTreeChanges.value) {
      await setDeptTree(props.teamId, nextDeptTree);
    }

    const nextAgents = committedAgents.value.map((agent) => {
      const nextConfig = nextAgentConfigs.find((item) => item.id === agent.id);
      if (!nextConfig) {
        return { ...agent };
      }
      return {
        ...agent,
        role_template_name: nextConfig.role_template_name,
        template_name: nextConfig.role_template_name,
        model: nextConfig.model,
        driver: nextConfig.driver,
      };
    });

    syncCommittedState(nextDeptTree, nextAgents);
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
      [nextMemberName]: resolveMemberRoleTemplate(nextMemberName),
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
  teamMemberDriverDrafts.value = {
    ...teamMemberDriverDrafts.value,
    [editingMemberName.value]: memberEditorDriver.value || teamMemberDriverDrafts.value[editingMemberName.value] || '{}',
  };
  closeMemberEditor();
}

function createPendingSlotId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addSubordinate(parentName: string): void {
  pendingSlots.value = [...pendingSlots.value, { id: createPendingSlotId(), parentName }];
  teamMemberStatus.value = '';
}

function editPendingSlot(slotId: string): void {
  editingPendingSlotId.value = slotId;
  openPendingMemberEditor('选择成员');
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
    <p v-if="isLoading" class="team-member-status">正在加载组织结构...</p>
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
