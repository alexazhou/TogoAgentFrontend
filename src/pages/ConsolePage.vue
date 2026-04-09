<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { connectionState } from '../appUiState';
import { postRoomMessage } from '../api';
import AgentActivityDialog from '../components/AgentActivityDialog.vue';
import ConsoleAgentListPanel from '../components/ConsoleAgentListPanel.vue';
import ConsoleChatPanel from '../components/ConsoleChatPanel.vue';
import ConsoleRoomListPanel from '../components/ConsoleRoomListPanel.vue';
import CreateRoomDialog from '../components/CreateRoomDialog.vue';
import { useAgentActivityDialogState } from '../composables/useAgentActivityDialogState';
import { useConsoleMessageScroll } from '../composables/useConsoleMessageScroll';
import { useConsoleRuntimeState } from '../composables/useConsoleRuntimeState';
import { useConsoleSidebarLayout } from '../composables/useConsoleSidebarLayout';
import { loadDeptTree, loadRoleTemplates } from '../realtime/runtimeStore';
import { useDeptTree, useRoleTemplates } from '../realtime/selectors';
import { findTeamById } from '../teamStore';
import type {
  AgentInfo,
  DeptTreeNode,
  MessageInfo,
  RoomMemberProfile,
  RoomState,
} from '../types';

const route = useRoute();
const router = useRouter();

const draft = ref('');
const loading = ref(true);
const reloadingMessages = ref(false);
const errorMessage = ref('');
const messageViewport = useTemplateRef('messageViewport');
const createRoomDialogOpen = ref(false);
const leftStack = useTemplateRef('leftStack');

const teamId = computed(() => Number(route.params.teamId));
const routeRoomId = computed<number | null>(() => {
  const raw = route.params.roomId;
  if (typeof raw !== 'string') {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
});
const currentTeam = computed(() => findTeamById(teamId.value));
async function navigateToRoom(roomId: number, replace = false): Promise<void> {
  const method = replace ? router.replace : router.push;
  await method({
    name: 'console',
    params: { teamId: teamId.value, roomId },
  });
}

const {
  agents,
  currentRoom,
  messages,
  rooms,
  selectedRoomId,
  clearSelectedRoom,
  refreshRuntimeState,
  loadRoomMessages: loadRuntimeRoomMessages,
  clearRuntimeContext,
} = useConsoleRuntimeState({
  teamId,
  routeRoomId,
  navigateToRoom,
});
const deptTree = useDeptTree(teamId);
const roleTemplates = useRoleTemplates();
const composerNotice = computed(() => {
  if (!currentRoom.value || currentRoom.value.room_type === 'private') {
    return '';
  }
  return '当前为观察模式，请在私聊房间向对应 Agent 发送消息。';
});
const {
  shouldFollowMessages,
  bindMessageScrollListener,
  scrollMessagesToBottom,
  cleanupMessageScroll,
} = useConsoleMessageScroll(messageViewport);
const {
  leftStackStyle,
  sidebarDividerDragging,
  startSidebarResize,
} = useConsoleSidebarLayout(leftStack);
const {
  open: agentDetailOpen,
  selectedAgentId,
  selectedAgentName,
  selectedAgentStatus,
  selectedAgentTemplateName,
  openAgent,
  closeAgentDetail,
} = useAgentActivityDialogState(agents, roleTemplates);
const visibleAgents = computed(() =>
  agents.value.filter((agent) =>
    !agent.special && String(agent.employ_status ?? '').toUpperCase() !== 'OFF_BOARD',
  ),
);

function isDeptRoom(room: RoomState | null): boolean {
  return Boolean(room && Array.isArray(room.tags) && room.tags.includes('DEPT'));
}

function parseDeptIdFromBizId(bizId: string | null | undefined): number | null {
  const matched = String(bizId ?? '').match(/^DEPT:(\d+)$/);
  if (!matched) {
    return null;
  }

  const deptId = Number(matched[1]);
  return Number.isFinite(deptId) ? deptId : null;
}

function findDeptNodeById(tree: DeptTreeNode | null, deptId: number): DeptTreeNode | null {
  if (!tree) {
    return null;
  }
  if (tree.id === deptId) {
    return tree;
  }
  for (const child of tree.children) {
    const matched = findDeptNodeById(child, deptId);
    if (matched) {
      return matched;
    }
  }
  return null;
}

function findDeptNodeByName(tree: DeptTreeNode | null, deptName: string): DeptTreeNode | null {
  if (!tree) {
    return null;
  }
  if (tree.name === deptName) {
    return tree;
  }
  for (const child of tree.children) {
    const matched = findDeptNodeByName(child, deptName);
    if (matched) {
      return matched;
    }
  }
  return null;
}

const currentDeptLeaderName = computed<string | null>(() => {
  const room = currentRoom.value;
  if (!room || !isDeptRoom(room)) {
    return null;
  }

  const deptId = parseDeptIdFromBizId(room.biz_id);
  const deptNode = deptId !== null
    ? findDeptNodeById(deptTree.value, deptId)
    : findDeptNodeByName(deptTree.value, room.room_name);
  if (!deptNode || typeof deptNode.manager_id !== 'number') {
    return null;
  }

  const leader = agents.value.find((agent) => agent.id === deptNode.manager_id);
  return leader?.name ?? null;
});

const roomMemberProfiles = computed<RoomMemberProfile[]>(() => {
  if (!currentRoom.value) {
    return [];
  }

  const agentMap = new Map(agents.value.map((agent) => [agent.id, agent]));
  const templateMap = new Map(roleTemplates.value.map((template) => [template.id, template.name]));
  const memberAgents: AgentInfo[] = [];

  for (const agentId of currentRoom.value.agents) {
    const agent = agentMap.get(agentId);
    if (agent) {
      memberAgents.push(agent);
    }
  }

  return memberAgents.map((agent) => {
    const templateName = agent.role_template_id ? (templateMap.get(agent.role_template_id) ?? null) : null;
    return {
      name: agent.name,
      employee_number: typeof agent.employee_number === 'number' ? agent.employee_number : null,
      role_template_name: templateName,
      is_leader: agent.name === currentDeptLeaderName.value,
    };
  });
});

async function loadRoomMessages(
  roomId: number,
  options?: { force?: boolean; replaceRoute?: boolean; syncRoute?: boolean },
): Promise<void> {
  if (!options?.force && selectedRoomId.value === roomId) {
    return;
  }

  reloadingMessages.value = true;
  errorMessage.value = '';

  try {
    await loadRuntimeRoomMessages(roomId, options);
    await nextTick();
    bindMessageScrollListener();
    await scrollMessagesToBottom();
  } catch (error) {
    errorMessage.value = '加载消息失败，请检查网络或后端状态。';
    console.error(error);
  } finally {
    reloadingMessages.value = false;
  }
}

async function refreshAll(): Promise<void> {
  if (!currentTeam.value) {
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    const [{ rooms: nextRooms }] = await Promise.all([
      refreshRuntimeState(),
      loadRoleTemplates(),
      loadDeptTree(teamId.value),
    ]);

    const fallbackRoomId = nextRooms[0]?.room_id ?? null;
    const targetRoomId =
      routeRoomId.value && nextRooms.some((room) => room.room_id === routeRoomId.value)
        ? routeRoomId.value
        : fallbackRoomId;

    if (targetRoomId !== null) {
      await loadRoomMessages(targetRoomId, {
        force: true,
        replaceRoute: routeRoomId.value !== targetRoomId,
        syncRoute: true,
      });
    } else {
      clearSelectedRoom();
    }
  } catch (error) {
    errorMessage.value = '无法连接到后端服务，请确认服务已启动。';
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function handleSubmit(): Promise<void> {
  const content = draft.value.trim();
  if (!content || !currentRoom.value || currentRoom.value.room_type !== 'private') {
    return;
  }

  try {
    await postRoomMessage(currentRoom.value.room_id, content);
    draft.value = '';
  } catch (error) {
    errorMessage.value = '消息发送失败。';
    console.error(error);
  }
}

function updateDraft(value: string): void {
  draft.value = value;
}

function openCreateRoomDialog(): void {
  if (loading.value || !currentTeam.value) {
    return;
  }
  createRoomDialogOpen.value = true;
}

function closeCreateRoomDialog(): void {
  createRoomDialogOpen.value = false;
}

watch(
  () => currentTeam.value?.name,
  (teamName, previousTeamName) => {
    if (!teamName || teamName === previousTeamName) {
      return;
    }
    refreshAll().catch(console.error);
  },
);

watch(
  () => routeRoomId.value,
  (roomId) => {
    if (roomId === null || roomId === selectedRoomId.value) {
      return;
    }
    if (!rooms.value.some((room) => room.room_id === roomId)) {
      return;
    }
    loadRoomMessages(roomId, { force: true, syncRoute: false }).catch(console.error);
  },
);

watch(
  () => connectionState.value,
  (state, previousState) => {
    if (
      !currentTeam.value
      || state !== 'connected'
      || previousState === 'connected'
      || previousState === 'connecting'
    ) {
      return;
    }
    refreshAll().catch(console.error);
  },
);

onMounted(async () => {
  if (currentTeam.value) {
    await refreshAll();
  }
  bindMessageScrollListener();
});

onBeforeUnmount(() => {
  cleanupMessageScroll();
  clearRuntimeContext();
});
</script>

<template>
  <div class="workspace-grid">
    <div ref="leftStack" class="left-stack" :style="leftStackStyle">
      <ConsoleRoomListPanel
        :loading="loading"
        :rooms="rooms"
        :current-room-id="selectedRoomId"
        :create-disabled="loading || !agents.length"
        @select-room="loadRoomMessages($event, { force: true })"
        @create-room="openCreateRoomDialog"
      />

      <button
        type="button"
        class="left-stack-splitter"
        :class="{ dragging: sidebarDividerDragging }"
        aria-label="调整聊天室和成员卡片高度"
        @pointerdown="startSidebarResize"
      >
        <span class="splitter-grip"></span>
      </button>

      <ConsoleAgentListPanel :agents="visibleAgents" @select-agent="openAgent" />
    </div>

    <div ref="messageViewport" class="chat-shell">
      <ConsoleChatPanel
        :current-room="currentRoom"
        :member-profiles="roomMemberProfiles"
        :messages="messages"
        :error-message="errorMessage"
        :reloading-messages="reloadingMessages"
        :draft="draft"
        :composer-notice="composerNotice"
        @update-draft="updateDraft"
        @submit="handleSubmit"
      />
    </div>

    <CreateRoomDialog :open="createRoomDialogOpen" @close="closeCreateRoomDialog" />

    <AgentActivityDialog
      :open="agentDetailOpen"
      :agent-id="selectedAgentId"
      :agent-name="selectedAgentName"
      :agent-status="selectedAgentStatus"
      :role-template-name="selectedAgentTemplateName"
      @close="closeAgentDetail"
    />
  </div>
</template>

<style scoped>
.workspace-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 8px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.left-stack {
  display: grid;
  min-height: 0;
  min-width: 0;
}

.left-stack-splitter {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: row-resize;
  touch-action: none;
}

.splitter-grip {
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-border) 55%, transparent);
  opacity: 0;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.left-stack-splitter:hover .splitter-grip {
  opacity: 0;
}

.left-stack-splitter.dragging .splitter-grip {
  opacity: 0.22;
  transform: scaleY(1.2);
}

.chat-shell {
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

@media (max-width: 980px) {
  .workspace-grid {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(280px, 38vh) minmax(0, 1fr);
  }

  .left-stack {
    min-height: 0;
  }
}
</style>
