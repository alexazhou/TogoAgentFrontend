<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getAgentsByTeamId, getDeptTree, getFrontendConfig, getRoleTemplates, saveMembersByTeamId, setDeptTree } from '../../api';
import { showGlobalSuccessToast } from '../../appUiState';
import {
  useMemberEditorDialog,
  type MemberDriverOption,
  type MemberModelOption,
  type MemberTemplateOption,
} from '../../composables/useMemberEditorDialog';
import DepartmentEditorDialog from './DepartmentEditorDialog.vue';
import TeamMembersCard from './TeamMembersCard.vue';
import MemberEditorDialog from './MemberEditorDialog.vue';
import ConfirmDialog from '../ui/ConfirmDialog.vue';
import type { DeptTreeNode, FrontendConfig } from '../../types';
import type { AgentInfo } from '../../types';
import type { TeamGraphNode } from './teamGraphTypes';

type DraftOrgNode = {
  id: string;
  kind: 'member' | 'pending';
  agentId: number | null;
  deptId: number | null;
  memberName: string;
  roleTemplateId: number | null;
  model: string;
  driver: string;
  employeeNumber: string;
  deptName: string;
  deptResponsibility: string;
  children: DraftOrgNode[];
};

const props = defineProps<{
  teamId: number;
  teamName: string;
}>();

const emit = defineEmits<{
  saved: [];
}>();

const { t } = useI18n();
const driverCatalog = ref<MemberDriverOption[]>([]);
const modelCatalog = ref<MemberModelOption[]>([]);
const roleTemplateCatalog = ref<MemberTemplateOption[]>([]);
const frontendConfig = ref<FrontendConfig | null>(null);
const isLoading = ref(false);
const isSavingTeamMembers = ref(false);
const isReadonly = ref(true);
const teamMemberStatus = ref('');
const committedAgents = ref<AgentInfo[]>([]);
const committedOrgTree = ref<DraftOrgNode | null>(null);
const draftOrgTree = ref<DraftOrgNode | null>(null);
const editingPendingSlotId = ref<string | null>(null);
const editingDepartmentMemberName = ref('');
const memberEditorStatus = ref('');
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
  confirmLabel: t('common.confirm'),
  danger: true,
  action: null,
});

function createDraftNodeId(prefix = 'node'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneDraftOrgNode(node: DraftOrgNode | null): DraftOrgNode | null {
  if (!node) {
    return null;
  }

  return {
    ...node,
    children: node.children.map((child) => cloneDraftOrgNode(child)!),
  };
}

function createPendingNode(): DraftOrgNode {
  return {
    id: createDraftNodeId('pending'),
    kind: 'pending',
    agentId: null,
    deptId: null,
    memberName: '',
    roleTemplateId: null,
    model: '',
    driver: '',
    employeeNumber: '',
    deptName: '',
    deptResponsibility: '',
    children: [],
  };
}

function createDepartmentNameAllocator(initialDepartmentNames: string[] = []): () => string {
  const usedDepartmentNames = new Set<string>();
  let maxDepartmentIndex = 0;

  initialDepartmentNames.forEach((departmentName) => {
    const trimmedDepartmentName = departmentName.trim();
    if (!trimmedDepartmentName) {
      return;
    }

    usedDepartmentNames.add(trimmedDepartmentName);
    const matched = trimmedDepartmentName.match(/^新部门(\d+)$/);
    if (!matched) {
      return;
    }

    maxDepartmentIndex = Math.max(maxDepartmentIndex, Number(matched[1]));
  });

  return () => {
    let nextDepartmentIndex = maxDepartmentIndex + 1;
    while (usedDepartmentNames.has(`新部门${nextDepartmentIndex}`)) {
      nextDepartmentIndex += 1;
    }

    const nextDepartmentName = `新部门${nextDepartmentIndex}`;
    usedDepartmentNames.add(nextDepartmentName);
    maxDepartmentIndex = nextDepartmentIndex;
    return nextDepartmentName;
  };
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

function collectMemberIdsFromDeptTree(tree: DeptTreeNode | null): number[] {
  if (!tree) {
    return [];
  }

  const ids: number[] = [];
  const stack = [tree];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.manager_id !== null && !ids.includes(current.manager_id)) {
      ids.push(current.manager_id);
    }

    current.agent_ids.forEach((agentId) => {
      if (!ids.includes(agentId)) {
        ids.push(agentId);
      }
    });

    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      stack.push(current.children[index]);
    }
  }

  return ids;
}

function buildFallbackAgentsFromTree(tree: DeptTreeNode | null): AgentInfo[] {
  return collectMemberIdsFromDeptTree(tree).map((agentId) => ({
    id: agentId,
    name: `Agent #${agentId}`,
    employee_number: null,
    role_template_id: null,
    model: '',
    team_name: props.teamName,
    status: 'idle' as const,
    employ_status: null,
    driver: '',
  }));
}

function createMemberNode(
  memberName: string,
  agent: AgentInfo | undefined,
  options?: {
    deptId?: number | null;
    deptName?: string;
    deptResponsibility?: string;
    children?: DraftOrgNode[];
  },
): DraftOrgNode {
  return {
    id: createDraftNodeId('member'),
    kind: 'member',
    agentId: typeof agent?.id === 'number' ? agent.id : null,
    deptId: typeof options?.deptId === 'number' ? options.deptId : null,
    memberName,
    roleTemplateId: agent?.role_template_id ?? null,
    model: agent?.model || '',
    driver: parseDriverTypeValue(agent?.driver || ''),
    employeeNumber: typeof agent?.employee_number === 'number' ? String(agent.employee_number) : '',
    deptName: options?.deptName?.trim() || '',
    deptResponsibility: options?.deptResponsibility || '',
    children: options?.children ?? [],
  };
}

function buildFallbackOrgTree(agents: AgentInfo[]): DraftOrgNode | null {
  const leader = agents[0];
  if (!leader) {
    return null;
  }

  return createMemberNode(leader.name, leader, {
    children: agents.slice(1).map((agent) => createMemberNode(agent.name, agent)),
  });
}

function buildDraftOrgNodeFromDeptTree(
  node: DeptTreeNode,
  agentsById: Map<number, AgentInfo>,
  visitedIds: Set<number>,
): DraftOrgNode | null {
  const managerId = node.manager_id;
  if (managerId === null) {
    return null;
  }

  visitedIds.add(managerId);
  const childManagerIds = new Set(
    node.children
      .map((child) => child.manager_id)
      .filter((id): id is number => id !== null),
  );

  const extraMemberNodes = node.agent_ids
    .filter((agentId) => agentId !== managerId && !childManagerIds.has(agentId))
    .map((agentId) => {
      visitedIds.add(agentId);
      return createMemberNode(
        agentsById.get(agentId)?.name ?? `Agent #${agentId}`,
        agentsById.get(agentId),
      );
    });

  const childNodes = node.children
    .map((child) => buildDraftOrgNodeFromDeptTree(child, agentsById, visitedIds))
    .filter((child): child is DraftOrgNode => child !== null);

  const managerAgent = agentsById.get(managerId);
  return createMemberNode(
    managerAgent?.name ?? `Agent #${managerId}`,
    managerAgent,
    {
      deptId: node.id ?? null,
      deptName: node.name,
      deptResponsibility: node.responsibility,
      children: [...extraMemberNodes, ...childNodes],
    },
  );
}

function buildDraftOrgTree(tree: DeptTreeNode | null, agents: AgentInfo[]): DraftOrgNode | null {
  const agentsById = new Map<number, AgentInfo>();
  agents.forEach((agent) => {
    if (typeof agent.id === 'number') {
      agentsById.set(agent.id, agent);
    }
  });

  if (!tree) {
    return buildFallbackOrgTree(agents);
  }

  const visitedIds = new Set<number>();
  const root = buildDraftOrgNodeFromDeptTree(tree, agentsById, visitedIds);
  if (!root) {
    return buildFallbackOrgTree(agents);
  }

  const extraAgents = agents.filter((agent) => typeof agent.id === 'number' && !visitedIds.has(agent.id));
  root.children.push(...extraAgents.map((agent) => createMemberNode(agent.name, agent)));
  return root;
}

function collectMemberNodes(root: DraftOrgNode | null): DraftOrgNode[] {
  if (!root) {
    return [];
  }

  const result: DraftOrgNode[] = [];
  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.kind === 'member' && current.memberName) {
      result.push(current);
    }
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      stack.push(current.children[index]);
    }
  }

  return result;
}

function findMemberNode(root: DraftOrgNode | null, memberName: string): DraftOrgNode | null {
  if (!root) {
    return null;
  }

  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.kind === 'member' && current.memberName === memberName) {
      return current;
    }
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      stack.push(current.children[index]);
    }
  }

  return null;
}

function countManagedChildren(node: DraftOrgNode): number {
  return node.children.filter((child) => child.kind === 'member').length;
}

function buildNextAutoDepartmentName(): string {
  const currentDepartmentNames = collectMemberNodes(draftOrgTree.value)
    .map((node) => node.deptName)
    .filter(Boolean);
  return createDepartmentNameAllocator(currentDepartmentNames)();
}

function resolveRoleTemplateNameById(templateId: number | null | undefined): string {
  if (typeof templateId !== 'number' || templateId <= 0) {
    return '未选择模板';
  }
  return roleTemplateCatalog.value.find((template) => template.id === templateId)?.name || `模板 #${templateId}`;
}

function buildMembersSavePayload(root: DraftOrgNode | null = draftOrgTree.value): Array<{
  id: number | null;
  name: string;
  role_template_id: number;
  model: string;
  driver: string;
}> {
  return collectMemberNodes(root)
    .map((node) => ({
      id: node.agentId,
      name: node.memberName,
      role_template_id: node.roleTemplateId ?? 0,
      model: node.model,
      driver: node.driver || 'native',
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

function buildDeptTreePayload(root: DraftOrgNode | null = draftOrgTree.value): DeptTreeNode | null {
  if (!root || root.kind !== 'member' || !root.memberName || root.agentId === null) {
    return null;
  }

  const buildNode = (node: DraftOrgNode, isRoot = false): DeptTreeNode => {
    const childMembers = node.children.filter((child) => child.kind === 'member');
    const agentIds: number[] = node.agentId !== null ? [node.agentId] : [];
    const children: DeptTreeNode[] = [];

    childMembers.forEach((child) => {
      if (countManagedChildren(child) > 0) {
        children.push(buildNode(child));
        return;
      }

      if (child.agentId !== null) {
        agentIds.push(child.agentId);
      }
    });

    return {
      id: isRoot || childMembers.length > 0 ? node.deptId : null,
      name: isRoot || childMembers.length > 0 ? node.deptName : '',
      responsibility: isRoot || childMembers.length > 0 ? node.deptResponsibility : '',
      manager_id: node.agentId,
      agent_ids: agentIds,
      children,
    };
  };

  return buildNode(root, true);
}

function buildCommittedTreeBaseline(): DeptTreeNode | null {
  return buildDeptTreePayload(committedOrgTree.value);
}

function syncCommittedState(tree: DeptTreeNode | null, agents: AgentInfo[]): void {
  const nextAgents = agents.length ? agents : buildFallbackAgentsFromTree(tree);
  committedAgents.value = nextAgents.map((agent) => ({ ...agent }));
  committedOrgTree.value = buildDraftOrgTree(tree, committedAgents.value);
  draftOrgTree.value = cloneDraftOrgNode(committedOrgTree.value);
}

const selectedTeamMembers = computed(() => (
  collectMemberNodes(draftOrgTree.value).map((node) => node.memberName)
));

const selectedTeamMemberTemplates = computed<Record<string, string>>(() => (
  Object.fromEntries(
    collectMemberNodes(draftOrgTree.value).map((node) => [
      node.memberName,
      resolveRoleTemplateNameById(node.roleTemplateId),
    ]),
  )
));

const memberPanelStatus = computed(() => {
  if (isLoading.value) {
    return '正在加载组织结构...';
  }

  if (teamMemberStatus.value === '加载失败') {
    return teamMemberStatus.value;
  }

  return '';
});

const inlineTeamMemberStatus = computed(() => (
  memberPanelStatus.value ? '' : teamMemberStatus.value
));

const currentEditingMemberEmployeeNumber = computed(() => (
  findMemberNode(draftOrgTree.value, editingMemberName.value)?.employeeNumber || ''
));

const memberTemplateOptions = computed(() => {
  const definitions = new Map<number, MemberTemplateOption>();

  roleTemplateCatalog.value.forEach((template) => {
    if (!definitions.has(template.id)) {
      definitions.set(template.id, {
        id: template.id,
        name: template.name,
        model: template.model || '自动',
        soul: template.soul || '',
      });
    }
  });

  collectMemberNodes(draftOrgTree.value).forEach((node) => {
    if (typeof node.roleTemplateId === 'number' && node.roleTemplateId > 0 && !definitions.has(node.roleTemplateId)) {
      definitions.set(node.roleTemplateId, {
        id: node.roleTemplateId,
        name: `模板 #${node.roleTemplateId}`,
        model: '自动',
        soul: '',
      });
    }
  });

  return Array.from(definitions.values()).sort((left, right) => left.name.localeCompare(right.name));
});

function resolveMemberRoleTemplateId(memberName: string): number | null {
  return findMemberNode(draftOrgTree.value, memberName)?.roleTemplateId ?? null;
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
  templateOptions: memberTemplateOptions,
  driverCatalog,
  modelCatalog,
  resolveId: (memberName: string) => findMemberNode(draftOrgTree.value, memberName)?.agentId ?? null,
  resolveName: (memberName: string) => findMemberNode(draftOrgTree.value, memberName)?.memberName || memberName,
  resolveModel: (memberName: string) => findMemberNode(draftOrgTree.value, memberName)?.model || '',
  resolveDriver: (memberName: string) => findMemberNode(draftOrgTree.value, memberName)?.driver || '',
  resolveTemplateId: resolveMemberRoleTemplateId,
  canLoadMemberDetail: (memberName: string) => Boolean(findMemberNode(draftOrgTree.value, memberName)?.agentId),
});

const currentTemplateModelLabel = computed(() => {
  const templateModel = currentMemberTemplateOption.value?.model || '';
  return (templateModel && templateModel !== '未设置') || templateModel === '自动'
    ? templateModel
    : resolveDefaultModelLabel(frontendConfig.value);
});

const currentTemplateName = computed(() => currentMemberTemplateOption.value?.name || '');
const currentTemplateSoul = computed(() => currentMemberTemplateOption.value?.soul || '');

watch(
  [memberEditorName, memberEditorKeyword, memberEditorTemplateId, memberEditorModel, memberEditorDriver],
  () => {
    if (memberEditorStatus.value) {
      memberEditorStatus.value = '';
    }
  },
);

function toGraphNode(node: DraftOrgNode, teamName: string): TeamGraphNode {
  if (node.kind === 'pending') {
    return {
      id: node.id,
      kind: 'pending',
      name: '',
      departmentName: '',
      subtitle: '成员',
      avatarName: '',
      children: [],
    };
  }

  return {
    id: node.memberName,
    kind: 'member',
    name: node.memberName,
    departmentName: node.deptName,
    subtitle: resolveRoleTemplateNameById(node.roleTemplateId),
    employeeNumber: node.employeeNumber,
    avatarName: node.memberName,
    avatarSeed: `${teamName}::${node.memberName}`,
    children: node.children.map((child) => toGraphNode(child, teamName)),
  };
}

const graphRootNode = computed<TeamGraphNode | null>(() => (
  draftOrgTree.value ? toGraphNode(draftOrgTree.value, props.teamName) : null
));

function treeHasPendingNode(root: DraftOrgNode | null): boolean {
  if (!root) {
    return false;
  }

  const stack = [root];
  while (stack.length) {
    const current = stack.pop()!;
    if (current.kind === 'pending') {
      return true;
    }
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      stack.push(current.children[index]);
    }
  }

  return false;
}

const hasMemberConfigChanges = computed(() =>
  JSON.stringify(buildMembersSavePayload()) !== JSON.stringify(buildCommittedMembersSaveBaseline()),
);

const hasDeptTreeChanges = computed(() =>
  JSON.stringify(buildDeptTreePayload()) !== JSON.stringify(buildCommittedTreeBaseline()),
);

const hasTeamMemberChanges = computed(() =>
  hasMemberConfigChanges.value || hasDeptTreeChanges.value,
);

const departmentEditorOpen = computed(() => !!editingDepartmentMemberName.value);

const memberPanelActions = computed(() => {
  if (isReadonly.value) {
    return [
      { key: 'edit', label: t('teamTree.editTeamOrg'), primary: true, disabled: isLoading.value },
    ];
  }

  return [
    { key: 'cancel', label: t('common.cancel'), disabled: isSavingTeamMembers.value },
    {
      key: 'save',
      label: isSavingTeamMembers.value ? t('teamTree.saving') : t('common.save'),
      disabled: !hasTeamMemberChanges.value || isSavingTeamMembers.value || treeHasPendingNode(draftOrgTree.value),
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
      roleTemplateCatalog.value = roleTemplates.map((template) => ({
        id: template.id,
        name: template.name,
        model: template.model || '自动',
        soul: template.soul || '',
      }));
      const nextMembers = teamAgents.map((agent) => ({
        ...agent,
      }));

      syncCommittedState(deptTree, nextMembers);
      editingPendingSlotId.value = null;
      memberEditorStatus.value = '';
      editingDepartmentMemberName.value = '';
      departmentEditorName.value = '';
      departmentEditorResponsibility.value = '';
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
      committedOrgTree.value = null;
      draftOrgTree.value = null;
      editingPendingSlotId.value = null;
      memberEditorStatus.value = '';
      editingDepartmentMemberName.value = '';
      departmentEditorName.value = '';
      departmentEditorResponsibility.value = '';
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
  draftOrgTree.value = cloneDraftOrgNode(committedOrgTree.value);
  editingPendingSlotId.value = null;
  memberEditorStatus.value = '';
  editingDepartmentMemberName.value = '';
  departmentEditorName.value = '';
  departmentEditorResponsibility.value = '';
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

    const nextAgents = savedMembers.map((agent) => ({ ...agent }));

    syncCommittedState(nextDeptTree, nextAgents);
    editingPendingSlotId.value = null;
    memberEditorStatus.value = '';
    editingDepartmentMemberName.value = '';
    departmentEditorName.value = '';
    departmentEditorResponsibility.value = '';
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
    if (!draftOrgTree.value) {
      draftOrgTree.value = createPendingNode();
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
  if (findMemberNode(draftOrgTree.value, agentName)) {
    requestRemoveMember(agentName);
  }
}

function replacePendingNode(root: DraftOrgNode, pendingId: string, nextNode: DraftOrgNode): boolean {
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.id === pendingId) {
      root.children.splice(index, 1, nextNode);
      return true;
    }
    if (replacePendingNode(child, pendingId, nextNode)) {
      return true;
    }
  }

  return false;
}

function removePendingNode(root: DraftOrgNode, pendingId: string): boolean {
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.id === pendingId) {
      root.children.splice(index, 1);
      return true;
    }
    if (removePendingNode(child, pendingId)) {
      return true;
    }
  }

  return false;
}

function removeMemberNode(root: DraftOrgNode, memberName: string): boolean {
  for (let index = 0; index < root.children.length; index += 1) {
    const child = root.children[index];
    if (child.kind === 'member' && child.memberName === memberName) {
      root.children.splice(index, 1);
      return true;
    }
    if (removeMemberNode(child, memberName)) {
      return true;
    }
  }

  return false;
}

function saveMemberEditor(): void {
  if (memberEditorTemplateId.value === null) {
    return;
  }

  const nextMemberName = memberEditorName.value.trim();
  if (!nextMemberName) {
    memberEditorStatus.value = '成员名称不能为空';
    return;
  }

  const allMemberNames = collectMemberNodes(draftOrgTree.value).map((node) => node.memberName);
  const originalName = editingPendingSlotId.value ? '' : editingMemberName.value;
  if (allMemberNames.some((memberName) => memberName === nextMemberName && memberName !== originalName)) {
    memberEditorStatus.value = `成员名称“${nextMemberName}”已存在`;
    return;
  }

  const nextTree = cloneDraftOrgNode(draftOrgTree.value);
  if (!nextTree) {
    return;
  }

  if (editingPendingSlotId.value) {
    const nextNode = createMemberNode(nextMemberName, undefined, {
      deptName: '',
      deptResponsibility: '',
    });
    nextNode.roleTemplateId = memberEditorTemplateId.value;
    nextNode.model = memberEditorModel.value.trim();
    nextNode.driver = memberEditorDriver.value || '';

    if (nextTree.id === editingPendingSlotId.value) {
      draftOrgTree.value = nextNode;
    } else {
      replacePendingNode(nextTree, editingPendingSlotId.value, nextNode);
      draftOrgTree.value = nextTree;
    }

    editingPendingSlotId.value = null;
    memberEditorStatus.value = '';
    showGlobalSuccessToast('已经更新到组织树');
    closeMemberEditor();
    return;
  }

  const targetNode = findMemberNode(nextTree, editingMemberName.value);
  if (!targetNode) {
    return;
  }

  targetNode.memberName = nextMemberName;
  targetNode.roleTemplateId = memberEditorTemplateId.value;
  targetNode.model = memberEditorModel.value.trim();
  targetNode.driver = memberEditorDriver.value || targetNode.driver || '';
  draftOrgTree.value = nextTree;
  memberEditorStatus.value = '';
  showGlobalSuccessToast('已经更新到组织树');
  closeMemberEditor();
}

function addSubordinate(parentName: string): void {
  const nextTree = cloneDraftOrgNode(draftOrgTree.value);
  if (!nextTree) {
    return;
  }

  const parentNode = findMemberNode(nextTree, parentName);
  if (!parentNode) {
    return;
  }

  if (countManagedChildren(parentNode) === 0 && !parentNode.deptName.trim()) {
    parentNode.deptName = buildNextAutoDepartmentName();
  }

  parentNode.children.push(createPendingNode());
  draftOrgTree.value = nextTree;
  teamMemberStatus.value = '';
}

function openDepartmentEditor(memberName: string): void {
  const memberNode = findMemberNode(draftOrgTree.value, memberName);
  if (!memberNode) {
    return;
  }

  departmentEditorEditable.value = true;
  editingDepartmentMemberName.value = memberName;
  departmentEditorName.value = memberNode.deptName;
  departmentEditorResponsibility.value = memberNode.deptResponsibility;
  teamMemberStatus.value = '';
}

function openDepartmentViewer(memberName: string): void {
  const memberNode = findMemberNode(draftOrgTree.value, memberName);
  if (!memberNode) {
    return;
  }

  departmentEditorEditable.value = false;
  editingDepartmentMemberName.value = memberName;
  departmentEditorName.value = memberNode.deptName;
  departmentEditorResponsibility.value = memberNode.deptResponsibility;
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

  const nextTree = cloneDraftOrgNode(draftOrgTree.value);
  const memberNode = findMemberNode(nextTree, memberName);
  if (!memberNode) {
    return;
  }

  memberNode.deptName = nextDepartmentName;
  memberNode.deptResponsibility = nextDepartmentResponsibility;
  draftOrgTree.value = nextTree;
  showGlobalSuccessToast('已经更新到组织树');
  closeDepartmentEditor();
}

function editPendingSlot(slotId: string): void {
  editingPendingSlotId.value = slotId;
  openPendingMemberEditor('');
}

function removePendingSlot(slotId: string): void {
  const nextTree = cloneDraftOrgNode(draftOrgTree.value);
  if (!nextTree) {
    return;
  }

  if (nextTree.id === slotId) {
    draftOrgTree.value = null;
  } else {
    removePendingNode(nextTree, slotId);
    draftOrgTree.value = nextTree;
  }

  if (editingPendingSlotId.value === slotId) {
    editingPendingSlotId.value = null;
    closeMemberEditor();
  }
}

function requestRemoveMember(agentName: string): void {
  confirmState.value = {
    title: t('teamTree.removeMemberTitle'),
    message: t('teamTree.removeMemberConfirm', { name: agentName }),
    confirmLabel: t('teamTree.removeMember'),
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
    confirmLabel: t('common.confirm'),
    danger: true,
    action: null,
  };
}

function confirmDangerAction(): void {
  const action = confirmState.value.action;
  if (!action) {
    return;
  }

  const nextTree = cloneDraftOrgNode(draftOrgTree.value);
  if (!nextTree) {
    closeConfirmDialog();
    return;
  }

  if (nextTree.kind === 'member' && nextTree.memberName === action.agentName) {
    draftOrgTree.value = null;
  } else {
    removeMemberNode(nextTree, action.agentName);
    draftOrgTree.value = nextTree;
  }

  if (editingMemberName.value === action.agentName) {
    closeMemberEditor();
  }
  if (editingDepartmentMemberName.value === action.agentName) {
    closeDepartmentEditor();
  }

  closeConfirmDialog();
}
</script>

<template>
  <div class="team-tree-editor">
    <p v-if="inlineTeamMemberStatus" class="team-member-status">{{ inlineTeamMemberStatus }}</p>

    <TeamMembersCard
      :team-name="teamName"
      :selected-agents="selectedTeamMembers"
      :member-templates="selectedTeamMemberTemplates"
      :root-node="graphRootNode"
      :status-message="memberPanelStatus"
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
      :status="memberEditorStatus"
      :employee-number="currentEditingMemberEmployeeNumber"
      :member-model="memberEditorModel"
      :keyword="memberEditorKeyword"
      :selected-template-id="memberEditorTemplateId"
      :selected-template-name="currentTemplateName"
      :current-template-model="currentTemplateModelLabel"
      :current-template-soul="currentTemplateSoul"
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
