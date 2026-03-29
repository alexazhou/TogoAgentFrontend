<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getAgentsByTeamId, getDeptTree, getFrontendConfig, getRoleTemplates, saveMembersByTeamId, setDeptTree } from '../api';
import { showGlobalSuccessToast } from '../appUiState';
import {
  useMemberEditorDialog,
  type MemberDriverOption,
  type MemberModelOption,
  type MemberTemplateOption,
} from '../composables/useMemberEditorDialog';
import ConfirmDialog from './ConfirmDialog.vue';
import DepartmentEditorDialog from './DepartmentEditorDialog.vue';
import TeamMembersCard from './TeamMembersCard.vue';
import MemberEditorDialog from './MemberEditorDialog.vue';
import type { DeptTreeNode, FrontendConfig, TeamMember } from '../types';
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
const modelCatalog = ref<MemberModelOption[]>([]);
const roleTemplateCatalog = ref<MemberTemplateOption[]>([]);
const frontendConfig = ref<FrontendConfig | null>(null);
const isLoading = ref(false);
const isSavingTeamMembers = ref(false);
const isReadonly = ref(true);
const teamMemberStatus = ref('');
const committedAgents = ref<AgentInfo[]>([]);
const committedDeptTree = ref<DeptTreeNode | null>(null);
const committedMembers = ref<TeamMember[]>([]);
const teamMembersDraft = ref<string[]>([]);
const teamMemberNameDraftsById = ref<Record<number, string>>({});
const teamMemberRoleDrafts = ref<Record<string, number | null>>({});
const teamMemberModelDrafts = ref<Record<string, string>>({});
const teamMemberDriverDrafts = ref<Record<string, string>>({});
const teamMemberDeptNameDrafts = ref<Record<string, string>>({});
const teamMemberDeptResponsibilityDrafts = ref<Record<string, string>>({});
const teamMemberParentDrafts = ref<Record<string, string>>({});
const pendingSlots = ref<Array<{ id: string; parentName: string }>>([]);
const editingPendingSlotId = ref<string | null>(null);
const editingDepartmentMemberName = ref('');
const departmentEditorName = ref('');
const departmentEditorResponsibility = ref('');
const departmentEditorEditable = ref(true);
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
    role_template_id: member.role_template_id,
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

function buildTeamMemberRoleDraft(members: TeamMember[]): Record<string, number | null> {
  return Object.fromEntries(members.map((member) => [member.name, member.role_template_id]));
}

function buildTeamMemberNameDraftsById(agents: AgentInfo[]): Record<number, string> {
  return Object.fromEntries(
    agents
      .filter((agent): agent is AgentInfo & { id: number } => typeof agent.id === 'number')
      .map((agent) => [agent.id, agent.name]),
  );
}

function buildTeamMemberModelDraft(agents: AgentInfo[]): Record<string, string> {
  return Object.fromEntries(agents.map((agent) => [agent.name, agent.model || '']));
}

function buildTeamMemberDriverDraft(agents: AgentInfo[]): Record<string, string> {
  return Object.fromEntries(agents.map((agent) => [agent.name, parseDriverTypeValue(agent.driver || '')]));
}

function buildTeamMemberDeptNameDraft(tree: DeptTreeNode | null, members: TeamMember[]): Record<string, string> {
  const fallbackTree = tree ?? buildFallbackDeptTree(members);
  const drafts: Record<string, string> = {};
  if (fallbackTree) {
    const stack = [fallbackTree];
    while (stack.length) {
      const current = stack.pop()!;
      const memberName = resolveTreeNodeMemberName(current);
      if (memberName) {
        drafts[memberName] = current.dept_name?.trim() || memberName;
      }
      for (let index = current.children.length - 1; index >= 0; index -= 1) {
        stack.push(current.children[index]);
      }
    }
  }
  members.forEach((member) => {
    if (!drafts[member.name]) {
      drafts[member.name] = member.name;
    }
  });
  return drafts;
}

function buildTeamMemberDeptResponsibilityDraft(tree: DeptTreeNode | null, members: TeamMember[]): Record<string, string> {
  const fallbackTree = tree ?? buildFallbackDeptTree(members);
  const drafts: Record<string, string> = {};
  if (fallbackTree) {
    const stack = [fallbackTree];
    while (stack.length) {
      const current = stack.pop()!;
      const memberName = resolveTreeNodeMemberName(current);
      if (memberName) {
        drafts[memberName] = current.dept_responsibility || '';
      }
      for (let index = current.children.length - 1; index >= 0; index -= 1) {
        stack.push(current.children[index]);
      }
    }
  }
  members.forEach((member) => {
    if (!(member.name in drafts)) {
      drafts[member.name] = '';
    }
  });
  return drafts;
}

function isOnBoardAgent(agent: AgentInfo): boolean {
  return String(agent.employ_status ?? '').toUpperCase() !== 'OFF_BOARD';
}

function parseDriverTypeValue(driver: string): string {
  const normalized = driver.trim().toLowerCase();
  if (normalized === 'native' || normalized === 'claude_sdk' || normalized === 'tsp') {
    return normalized;
  }
  return '';
}

function resolveDefaultModelLabel(config: FrontendConfig | null): string {
  if (!config?.default_model) {
    return '自动';
  }

  return '自动';
}

function buildModelCatalog(config: FrontendConfig | null): MemberModelOption[] {
  const enabledModels = (config?.models ?? []).filter((item) => item.enabled && item.model);

  return [
    {
      value: '',
      label: resolveDefaultModelLabel(config),
    },
    ...enabledModels.map((item) => ({
      value: item.model,
      label: item.name && item.name !== item.model ? `${item.model}@${item.name}` : item.model,
    })),
  ];
}

function buildDriverCatalog(config: FrontendConfig | null): MemberDriverOption[] {
  return [
    { value: '', label: '自动' },
    ...((config?.driver_types ?? []).map((item) => ({
      value: item.name,
      label: item.description ? `${item.name} · ${item.description}` : item.name,
    }))),
  ];
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
    role_template_id: null,
    model: '',
    team_name: props.teamName,
    status: 'idle',
    employ_status: null,
    driver: '',
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

function resolveDraftAgentId(memberName: string, agents: AgentInfo[] = committedAgents.value): number | null {
  const matched = agents.find((agent) => {
    if (typeof agent.id !== 'number') {
      return false;
    }
    const draftName = teamMemberNameDraftsById.value[agent.id] || agent.name;
    return draftName === memberName;
  });

  return typeof matched?.id === 'number' ? matched.id : null;
}

function buildMembersSavePayload(agents: AgentInfo[] = committedAgents.value): Array<{
  id: number | null;
  name: string;
  role_template_id: number;
  model: string;
  driver: string;
}> {
  const payload = teamMembersDraft.value.map((memberName) => {
    const agentId = resolveDraftAgentId(memberName, agents);
    const originalAgent = typeof agentId === 'number'
      ? agents.find((agent) => agent.id === agentId)
      : null;
    const originalDriverType = parseDriverTypeValue(originalAgent?.driver || '');
    const draftDriverType = teamMemberDriverDrafts.value[memberName] || '';

    return {
      id: agentId,
      name: memberName,
      role_template_id:
        teamMemberRoleDrafts.value[memberName]
        ?? originalAgent?.role_template_id
        ?? 0,
      model: teamMemberModelDrafts.value[memberName] || originalAgent?.model || '',
      driver: draftDriverType || originalDriverType || 'native',
    };
  });

  return payload.sort((left, right) => {
    const leftKey = left.id ?? Number.MAX_SAFE_INTEGER;
    const rightKey = right.id ?? Number.MAX_SAFE_INTEGER;
    if (leftKey !== rightKey) {
      return leftKey - rightKey;
    }
    return left.name.localeCompare(right.name);
  });
}

function buildCommittedMembersSaveBaseline(): Array<{
  id: number | null;
  name: string;
  role_template_id: number;
  model: string;
  driver: string;
}> {
  return committedAgents.value
    .map((agent) => ({
      id: typeof agent.id === 'number' ? agent.id : null,
      name: agent.name,
      role_template_id: agent.role_template_id ?? 0,
      model: agent.model || '',
      driver: parseDriverTypeValue(agent.driver || '') || 'native',
    }))
    .sort((left, right) => {
      const leftKey = left.id ?? Number.MAX_SAFE_INTEGER;
      const rightKey = right.id ?? Number.MAX_SAFE_INTEGER;
      if (leftKey !== rightKey) {
        return leftKey - rightKey;
      }
      return left.name.localeCompare(right.name);
    });
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
      dept_name: teamMemberDeptNameDrafts.value[memberName] || memberName,
      dept_responsibility: teamMemberDeptResponsibilityDrafts.value[memberName] || '',
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
  teamMemberNameDraftsById.value = buildTeamMemberNameDraftsById(committedAgents.value);
  teamMemberRoleDrafts.value = buildTeamMemberRoleDraft(committedMembers.value);
  teamMemberModelDrafts.value = buildTeamMemberModelDraft(committedAgents.value);
  teamMemberDriverDrafts.value = buildTeamMemberDriverDraft(committedAgents.value);
  teamMemberDeptNameDrafts.value = buildTeamMemberDeptNameDraft(committedDeptTree.value, committedMembers.value);
  teamMemberParentDrafts.value = parentMap;
}

function syncCommittedState(tree: DeptTreeNode | null, agents: AgentInfo[]): void {
  const nextAgents = agents.length ? agents : buildFallbackAgentsFromTree(tree);
  committedDeptTree.value = cloneDeptTree(tree);
  committedAgents.value = nextAgents.map((agent) => ({ ...agent }));
  const members = nextAgents.map((agent) => ({
    name: agent.name,
    role_template_id: agent.role_template_id ?? 0,
  }));
  syncCommittedMembers(members);
  syncDraftFromCommitted();
}

const selectedTeamMembers = computed(() => (
  teamMembersDraft.value
));

function resolveRoleTemplateNameById(templateId: number | null | undefined): string {
  if (typeof templateId !== 'number' || templateId <= 0) {
    return '未选择模板';
  }
  return roleTemplateCatalog.value.find((template) => template.id === templateId)?.name || `模板 #${templateId}`;
}

const selectedTeamMemberTemplates = computed<Record<string, string>>(() => (
  Object.fromEntries(
    Object.entries(teamMemberRoleDrafts.value).map(([memberName, templateId]) => [
      memberName,
      resolveRoleTemplateNameById(templateId),
    ]),
  )
));

const teamMemberEmployeeNumberDrafts = computed<Record<string, string>>(() => {
  return Object.fromEntries(
    committedAgents.value
      .filter((agent) => agent.name)
      .map((agent) => {
        const draftName = typeof agent.id === 'number'
          ? (teamMemberNameDraftsById.value[agent.id] || agent.name)
          : agent.name;
        return [draftName, typeof agent.employee_number === 'number' ? String(agent.employee_number) : ''];
      }),
  );
});

const currentEditingMemberEmployeeNumber = computed(() => (
  teamMemberEmployeeNumberDrafts.value[editingMemberName.value] || ''
));

const currentTemplateModelLabel = computed(() => {
  const templateModel = currentMemberTemplateOption.value?.model || '';
  return (templateModel && templateModel !== '未设置') || templateModel === '自动'
    ? templateModel
    : resolveDefaultModelLabel(frontendConfig.value);
});

const currentTemplateName = computed(() => currentMemberTemplateOption.value?.name || '');

const graphRootNode = computed<TeamGraphNode | null>(() => {
  const leaderName = teamMembersDraft.value[0] ?? '';
  const buildMemberAvatarSeed = (memberName: string): string => `${props.teamName}::${memberName}`;
  if (!leaderName) {
    const rootPendingSlot = pendingSlots.value.find((slot) => !slot.parentName);
    if (!rootPendingSlot) {
      return null;
    }

    return {
      id: rootPendingSlot.id,
      kind: 'pending',
      name: '',
      departmentName: '',
      subtitle: '成员',
      avatarName: '',
      children: [],
    };
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
      departmentName: teamMemberDeptNameDrafts.value[memberName] || memberName,
      subtitle: resolveRoleTemplateNameById(teamMemberRoleDrafts.value[memberName]),
      employeeNumber: teamMemberEmployeeNumberDrafts.value[memberName] || '',
      avatarName: memberName,
      avatarSeed: buildMemberAvatarSeed(memberName),
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
      departmentName: '',
      subtitle: '成员',
      avatarName: '',
      children: [],
    });
  });

  return leaderNode;
});

const hasMemberConfigChanges = computed(() =>
  JSON.stringify(buildMembersSavePayload()) !== JSON.stringify(buildCommittedMembersSaveBaseline()),
);

const hasDeptTreeChanges = computed(() =>
  JSON.stringify(buildDeptTreePayload()) !== JSON.stringify(buildCommittedTreeBaseline()),
);

const hasTeamMemberChanges = computed(() =>
  hasMemberConfigChanges.value || hasDeptTreeChanges.value,
);

const memberTemplateOptions = computed(() => {
  const definitions = new Map<number, MemberTemplateOption>();

  roleTemplateCatalog.value.forEach((template) => {
    if (!definitions.has(template.id)) {
      definitions.set(template.id, {
        id: template.id,
        name: template.name,
        model: template.model || '自动',
      });
    }
  });

  Object.values(teamMemberRoleDrafts.value).forEach((templateId) => {
    if (typeof templateId === 'number' && templateId > 0 && !definitions.has(templateId)) {
      definitions.set(templateId, {
        id: templateId,
        name: `模板 #${templateId}`,
        model: '自动',
      });
    }
  });

  return Array.from(definitions.values()).sort((left, right) => left.name.localeCompare(right.name));
});

function resolveMemberRoleTemplateId(memberName: string): number | null {
  return teamMemberRoleDrafts.value[memberName]
    ?? committedMembers.value.find((member) => member.name === memberName)?.role_template_id
    ?? null;
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
  memberEditorName,
  memberEditorKeyword,
  memberEditorTemplateId,
  memberEditorModel,
  memberEditorDriver,
  memberEditorOpen,
  memberEditorEditable,
  currentMemberTemplateOption,
  memberModelOptions,
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
  modelCatalog,
  resolveName: (memberName: string) => memberName,
  resolveModel: (memberName: string) => teamMemberModelDrafts.value[memberName] || '',
  resolveDriver: (memberName: string) => teamMemberDriverDrafts.value[memberName] || '',
  resolveTemplateId: resolveMemberRoleTemplateId,
  canLoadMemberDetail: (memberName: string) =>
    committedMembers.value.some((member) => member.name === memberName),
});

const departmentEditorOpen = computed(() => !!editingDepartmentMemberName.value);

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
      const [deptTree, teamAgents, roleTemplates, nextFrontendConfig] = await Promise.all([
        getDeptTree(requestTeamId),
        getAgentsByTeamId(requestTeamId),
        getRoleTemplates(),
        getFrontendConfig(),
      ]);
      if (requestTeamId !== props.teamId) {
        return;
      }

      frontendConfig.value = nextFrontendConfig;
      modelCatalog.value = buildModelCatalog(nextFrontendConfig);
      driverCatalog.value = buildDriverCatalog(nextFrontendConfig);
      roleTemplateCatalog.value = roleTemplates;
      const nextMembers = teamAgents.filter(isOnBoardAgent).map((agent) => ({
        ...agent,
      }));

      syncCommittedState(deptTree, nextMembers);
      pendingSlots.value = [];
      editingPendingSlotId.value = null;
      editingDepartmentMemberName.value = '';
      departmentEditorName.value = '';
      teamMemberStatus.value = '';
      isReadonly.value = true;
      resetDialogState();
    } catch (error) {
      console.error(error);
      if (requestTeamId !== props.teamId) {
        return;
      }
      frontendConfig.value = null;
      modelCatalog.value = [];
      driverCatalog.value = [];
      roleTemplateCatalog.value = [];
      committedAgents.value = [];
      committedDeptTree.value = null;
      committedMembers.value = [];
      teamMembersDraft.value = [];
      teamMemberNameDraftsById.value = {};
      teamMemberRoleDrafts.value = {};
      teamMemberModelDrafts.value = {};
      teamMemberDriverDrafts.value = {};
      teamMemberDeptNameDrafts.value = {};
      teamMemberParentDrafts.value = {};
      pendingSlots.value = [];
      editingPendingSlotId.value = null;
      editingDepartmentMemberName.value = '';
      departmentEditorName.value = '';
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
  editingDepartmentMemberName.value = '';
  departmentEditorName.value = '';
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
    const nextMembers = buildMembersSavePayload();
    const nextDeptTree = buildDeptTreePayload();

    const savedMembers = await saveMembersByTeamId(props.teamId, nextMembers);

    if (nextDeptTree && hasDeptTreeChanges.value) {
      await setDeptTree(props.teamId, nextDeptTree);
    }

    const nextAgents = savedMembers.filter(isOnBoardAgent).map((agent) => ({ ...agent }));

    syncCommittedState(nextDeptTree, nextAgents);
    pendingSlots.value = [];
    editingPendingSlotId.value = null;
    editingDepartmentMemberName.value = '';
    departmentEditorName.value = '';
    teamMemberStatus.value = '已保存';
    isReadonly.value = true;
    showGlobalSuccessToast('团队成员已保存');
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
    if (teamMembersDraft.value.length === 0 && pendingSlots.value.length === 0) {
      pendingSlots.value = [{ id: createPendingSlotId(), parentName: '' }];
      teamMemberStatus.value = '';
    }
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
    [agentName]: teamMemberRoleDrafts.value[agentName] ?? null,
  };
}

function saveMemberEditor(): void {
  if (memberEditorTemplateId.value === null) {
    return;
  }

  if (editingPendingSlotId.value) {
    const nextMemberName = memberEditorName.value.trim();
    const pendingSlot = pendingSlots.value.find((slot) => slot.id === editingPendingSlotId.value);
    const nextParentName = pendingSlot?.parentName?.trim() || '';
    if (!nextMemberName) {
      teamMemberStatus.value = '成员名称不能为空';
      return;
    }
    if (teamMembersDraft.value.includes(nextMemberName)) {
      teamMemberStatus.value = `成员名称“${nextMemberName}”已存在`;
      return;
    }
    if (!teamMembersDraft.value.includes(nextMemberName)) {
      teamMembersDraft.value = [...teamMembersDraft.value, nextMemberName];
    }
    teamMemberRoleDrafts.value = {
      ...teamMemberRoleDrafts.value,
      [nextMemberName]: memberEditorTemplateId.value,
    };
    teamMemberDeptNameDrafts.value = {
      ...teamMemberDeptNameDrafts.value,
      [nextMemberName]: nextMemberName,
    };
    teamMemberModelDrafts.value = {
      ...teamMemberModelDrafts.value,
      [nextMemberName]: memberEditorModel.value.trim(),
    };
    teamMemberDriverDrafts.value = {
      ...teamMemberDriverDrafts.value,
      [nextMemberName]: memberEditorDriver.value || '',
    };
    if (nextParentName) {
      teamMemberParentDrafts.value = {
        ...teamMemberParentDrafts.value,
        [nextMemberName]: nextParentName,
      };
    } else {
      const nextParentDrafts = { ...teamMemberParentDrafts.value };
      delete nextParentDrafts[nextMemberName];
      teamMemberParentDrafts.value = nextParentDrafts;
    }
    pendingSlots.value = pendingSlots.value.filter((slot) => slot.id !== editingPendingSlotId.value);
    editingPendingSlotId.value = null;
    showGlobalSuccessToast('已经更新到组织树');
    closeMemberEditor();
    return;
  }

  if (!editingMemberName.value) {
    return;
  }

  const originalName = editingMemberName.value;
  const nextMemberName = memberEditorName.value.trim();
  if (!nextMemberName) {
    teamMemberStatus.value = '成员名称不能为空';
    return;
  }

  const editedAgent = committedAgents.value.find((agent) => agent.name === originalName);
  if (
    editedAgent?.id
    && Object.entries(teamMemberNameDraftsById.value).some(([agentId, draftName]) =>
      Number(agentId) !== editedAgent.id && draftName === nextMemberName)
  ) {
    teamMemberStatus.value = `成员名称“${nextMemberName}”已存在`;
    return;
  }

  if (nextMemberName !== originalName) {
    teamMembersDraft.value = teamMembersDraft.value.map((memberName) => (
      memberName === originalName ? nextMemberName : memberName
    ));

    const nextRoleDrafts = { ...teamMemberRoleDrafts.value };
    const previousRoleTemplate = nextRoleDrafts[originalName];
    delete nextRoleDrafts[originalName];
    nextRoleDrafts[nextMemberName] = memberEditorTemplateId.value ?? previousRoleTemplate ?? null;
    teamMemberRoleDrafts.value = nextRoleDrafts;

    const nextModelDrafts = { ...teamMemberModelDrafts.value };
    const previousModel = nextModelDrafts[originalName];
    delete nextModelDrafts[originalName];
    nextModelDrafts[nextMemberName] = memberEditorModel.value.trim() || previousModel || '';
    teamMemberModelDrafts.value = nextModelDrafts;

    const nextDriverDrafts = { ...teamMemberDriverDrafts.value };
    const previousDriver = nextDriverDrafts[originalName];
    delete nextDriverDrafts[originalName];
    nextDriverDrafts[nextMemberName] = memberEditorDriver.value || previousDriver || '';
    teamMemberDriverDrafts.value = nextDriverDrafts;

    const nextDeptNameDrafts = { ...teamMemberDeptNameDrafts.value };
    const previousDeptName = nextDeptNameDrafts[originalName];
    delete nextDeptNameDrafts[originalName];
    nextDeptNameDrafts[nextMemberName] = previousDeptName || nextMemberName;
    teamMemberDeptNameDrafts.value = nextDeptNameDrafts;

    teamMemberParentDrafts.value = Object.fromEntries(
      Object.entries(teamMemberParentDrafts.value).map(([memberName, parentName]) => [
        memberName === originalName ? nextMemberName : memberName,
        parentName === originalName ? nextMemberName : parentName,
      ]),
    );

    pendingSlots.value = pendingSlots.value.map((slot) => ({
      ...slot,
      parentName: slot.parentName === originalName ? nextMemberName : slot.parentName,
    }));

    if (editedAgent?.id) {
      teamMemberNameDraftsById.value = {
        ...teamMemberNameDraftsById.value,
        [editedAgent.id]: nextMemberName,
      };
    }
  } else {
    teamMemberModelDrafts.value = {
      ...teamMemberModelDrafts.value,
      [originalName]: memberEditorModel.value.trim(),
    };
  }

  teamMemberRoleDrafts.value = {
    ...teamMemberRoleDrafts.value,
    [nextMemberName]: memberEditorTemplateId.value,
  };
  teamMemberModelDrafts.value = {
    ...teamMemberModelDrafts.value,
    [nextMemberName]: memberEditorModel.value.trim(),
  };
  teamMemberDriverDrafts.value = {
    ...teamMemberDriverDrafts.value,
    [nextMemberName]: memberEditorDriver.value || teamMemberDriverDrafts.value[nextMemberName] || '',
  };
  showGlobalSuccessToast('已经更新到组织树');
  closeMemberEditor();
}

function createPendingSlotId(): string {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addSubordinate(parentName: string): void {
  pendingSlots.value = [...pendingSlots.value, { id: createPendingSlotId(), parentName }];
  teamMemberStatus.value = '';
}

function openDepartmentEditor(memberName: string): void {
  departmentEditorEditable.value = true;
  editingDepartmentMemberName.value = memberName;
  departmentEditorName.value = teamMemberDeptNameDrafts.value[memberName] || memberName;
  departmentEditorResponsibility.value = teamMemberDeptResponsibilityDrafts.value[memberName] || '';
  teamMemberStatus.value = '';
}

function openDepartmentViewer(memberName: string): void {
  departmentEditorEditable.value = false;
  editingDepartmentMemberName.value = memberName;
  departmentEditorName.value = teamMemberDeptNameDrafts.value[memberName] || memberName;
  departmentEditorResponsibility.value = teamMemberDeptResponsibilityDrafts.value[memberName] || '';
  teamMemberStatus.value = '';
}

function closeDepartmentEditor(): void {
  departmentEditorEditable.value = true;
  editingDepartmentMemberName.value = '';
  departmentEditorName.value = '';
  departmentEditorResponsibility.value = '';
}

function saveDepartmentEditor(): void {
  const memberName = editingDepartmentMemberName.value;
  const nextDepartmentName = departmentEditorName.value.trim();
  const nextDepartmentResponsibility = departmentEditorResponsibility.value.trim();
  if (!memberName) {
    return;
  }
  if (!nextDepartmentName) {
    teamMemberStatus.value = '部门名称不能为空';
    return;
  }
  teamMemberDeptNameDrafts.value = {
    ...teamMemberDeptNameDrafts.value,
    [memberName]: nextDepartmentName,
  };
  teamMemberDeptResponsibilityDrafts.value = {
    ...teamMemberDeptResponsibilityDrafts.value,
    [memberName]: nextDepartmentResponsibility,
  };
  showGlobalSuccessToast('已经更新到组织树');
  closeDepartmentEditor();
}

function editPendingSlot(slotId: string): void {
  editingPendingSlotId.value = slotId;
  openPendingMemberEditor('');
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
  const nextDeptNameDrafts = { ...teamMemberDeptNameDrafts.value };
  const nextParentDrafts = { ...teamMemberParentDrafts.value };
  removedNames.forEach((name) => {
    delete nextRoleDrafts[name];
    delete nextDeptNameDrafts[name];
    delete nextParentDrafts[name];
  });
  teamMemberRoleDrafts.value = nextRoleDrafts;
  teamMemberDeptNameDrafts.value = nextDeptNameDrafts;
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
  if (editingDepartmentMemberName.value && removedNames.has(editingDepartmentMemberName.value)) {
    closeDepartmentEditor();
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
      @edit-department="openDepartmentEditor"
      @view-department="openDepartmentViewer"
      @add-subordinate="addSubordinate"
      @edit-pending-slot="editPendingSlot"
      @remove-pending-slot="removePendingSlot"
    />

    <MemberEditorDialog
      :open="memberEditorOpen"
      :editable="memberEditorEditable"
      :team-name="teamName"
      :member-name="memberEditorName"
      :employee-number="currentEditingMemberEmployeeNumber"
      :member-model="memberEditorModel"
      :keyword="memberEditorKeyword"
      :selected-template-id="memberEditorTemplateId"
      :selected-template-name="currentTemplateName"
      :current-template-model="currentTemplateModelLabel"
      :model-options="memberModelOptions"
      :driver="memberEditorDriver"
      :driver-options="memberDriverOptions"
      :template-options="filteredMemberTemplateOptions"
      @close="closeMemberEditor"
      @save="saveMemberEditor"
      @update:member-name="memberEditorName = $event"
      @update:member-model="memberEditorModel = $event"
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

    <DepartmentEditorDialog
      :open="departmentEditorOpen"
      :editable="departmentEditorEditable"
      :member-name="editingDepartmentMemberName"
      :department-name="departmentEditorName"
      :department-responsibility="departmentEditorResponsibility"
      @close="closeDepartmentEditor"
      @save="saveDepartmentEditor"
      @update:department-name="departmentEditorName = $event"
      @update:department-responsibility="departmentEditorResponsibility = $event"
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
