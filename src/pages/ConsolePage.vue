<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { connectionState, reconnectProgress, totalMessageCount } from '../appUiState';
import {
  createEventsSocket,
  createTeamRoom,
  getAgentsByTeamId,
  getDeptTree,
  getRoleTemplates,
  getRoomMessages,
  getRooms,
  postRoomMessage,
} from '../api';
import AgentListSection from '../components/AgentListSection.vue';
import AgentDetailDialog from '../components/AgentDetailDialog.vue';
import ChatPanel from '../components/ChatPanel.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import CreateRoomDialog from '../components/CreateRoomDialog.vue';
import RoomListSection from '../components/RoomListSection.vue';
import { findTeamById } from '../teamStore';
import type {
  AgentInfo,
  AgentStatus,
  DeptTreeNode,
  MessageInfo,
  RoleTemplateSummary,
  RoomMemberProfile,
  RoomState,
  WsAgentStatusEvent,
  WsEvent,
  WsMessageEvent,
} from '../types';
import { formatPreview } from '../utils';

const route = useRoute();
const router = useRouter();

const rooms = ref<RoomState[]>([]);
const agents = ref<AgentInfo[]>([]);
const deptTree = ref<DeptTreeNode | null>(null);
const roleTemplates = ref<RoleTemplateSummary[]>([]);
const messages = ref<MessageInfo[]>([]);
const selectedRoomId = ref<number | null>(null);
const draft = ref('');
const loading = ref(true);
const reloadingMessages = ref(false);
const errorMessage = ref('');
const composerNotice = ref('');
const messageViewport = useTemplateRef('messageViewport');
const shouldFollowMessages = ref(true);
const reconnectAttempt = ref(0);
const createRoomDialogOpen = ref(false);
const createRoomConfirmOpen = ref(false);
const creatingRoom = ref(false);
const createRoomName = ref('');
const createRoomMemberIds = ref<number[]>([]);
const agentDetailOpen = ref(false);
const selectedAgentId = ref<number | null>(null);
const selectedAgentName = ref<string | null>(null);
const leftStack = useTemplateRef('leftStack');
const leftStackHeight = ref(0);
const sidebarDividerDragging = ref(false);
const sidebarTopRatio = ref(0.62);

const reconnectDelayMs = 3000;
const connectTimeoutMs = 2000;
const splitterHeightPx = 8;
const sidebarTopRatioStorageKey = 'console-left-stack-top-ratio';

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let reconnectCountdownTimer: number | null = null;
let connectTimeoutTimer: number | null = null;
let shouldReconnect = true;
let activeSocketToken = 0;
let boundMessageStream: HTMLElement | null = null;
let leftStackResizeObserver: ResizeObserver | null = null;

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
const currentRoom = computed(
  () => rooms.value.find((room) => room.room_id === selectedRoomId.value) ?? null,
);
const leftStackStyle = computed(() => {
  if (leftStackHeight.value <= splitterHeightPx) {
    return {};
  }

  const availableHeight = leftStackHeight.value - splitterHeightPx;
  const minTopHeight = Math.min(220, Math.max(120, Math.round(availableHeight * 0.28)));
  const minBottomHeight = Math.min(180, Math.max(108, Math.round(availableHeight * 0.22)));
  const maxTopHeight = Math.max(minTopHeight, availableHeight - minBottomHeight);
  const topHeight = Math.round(Math.min(maxTopHeight, Math.max(minTopHeight, availableHeight * sidebarTopRatio.value)));

  return {
    gridTemplateRows: `${topHeight}px ${splitterHeightPx}px minmax(${minBottomHeight}px, 1fr)`,
  };
});
const visibleAgents = computed(() =>
  agents.value.filter((agent) =>
    !agent.special && String(agent.employ_status ?? '').toUpperCase() !== 'OFF_BOARD',
  ),
);

function persistSidebarTopRatio(): void {
  try {
    localStorage.setItem(sidebarTopRatioStorageKey, String(sidebarTopRatio.value));
  } catch {
    // ignore localStorage failures
  }
}

function restoreSidebarTopRatio(): void {
  try {
    const raw = localStorage.getItem(sidebarTopRatioStorageKey);
    if (!raw) {
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0.2 && parsed <= 0.8) {
      sidebarTopRatio.value = parsed;
    }
  } catch {
    // ignore localStorage failures
  }
}

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

  const agentMap = new Map(agents.value.map((agent) => [agent.name, agent]));
  const templateMap = new Map(roleTemplates.value.map((template) => [template.id, template.name]));
  const memberAgents: AgentInfo[] = [];

  for (const agentName of currentRoom.value.agents) {
    const agent = agentMap.get(agentName);
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
const roleTemplateNameMap = computed(() => new Map(roleTemplates.value.map((template) => [template.id, template.name])));
const roomCreateMemberOptions = computed(() =>
  agents.value
    .filter((agent): agent is AgentInfo & { id: number } =>
      typeof agent.id === 'number'
      && agent.id !== 0
      && agent.special !== 'system'
      && (agent.special !== null && agent.special !== undefined
        || String(agent.employ_status ?? '').toUpperCase() !== 'OFF_BOARD'),
    )
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      subtitle: agent.special === 'operator'
        ? '人类操作者'
        : agent.special === 'system'
          ? '系统消息发送者'
          : (agent.role_template_id ? (roleTemplateNameMap.value.get(agent.role_template_id) ?? null) : null),
      status: agent.status,
    })),
);
const canSubmitCreateRoom = computed(() =>
  Boolean(createRoomName.value.trim()) && createRoomMemberIds.value.length >= 2 && !creatingRoom.value,
);
const createRoomConfirmMessage = computed(() => {
  const memberNameMap = new Map(roomCreateMemberOptions.value.map((member) => [member.id, member.name]));
  const selectedNames = createRoomMemberIds.value
    .map((memberId) => memberNameMap.get(memberId))
    .filter((name): name is string => Boolean(name));

  return `确认创建聊天室“${createRoomName.value.trim()}”吗？\n成员：${selectedNames.join('、') || '无'}`;
});

function getMessageStream(): HTMLElement | null {
  const viewport = messageViewport.value?.querySelector('.message-stream');
  return viewport instanceof HTMLElement ? viewport : null;
}

function resolveMessageSenderName(senderId: number): string {
  if (senderId === -1) {
    return 'OPERATOR';
  }
  if (senderId === -2) {
    return 'SYSTEM';
  }

  const matchedAgent = agents.value.find((agent) => agent.id === senderId);
  if (matchedAgent?.name) {
    return matchedAgent.name;
  }

  return String(senderId);
}

function isAtBottom(viewport: HTMLElement): boolean {
  const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
  return distanceToBottom <= 4;
}

function syncFollowMessages(viewport?: HTMLElement | null): void {
  const target = viewport ?? getMessageStream();
  if (!target) {
    shouldFollowMessages.value = true;
    return;
  }
  shouldFollowMessages.value = isAtBottom(target);
}

function handleMessageScroll(): void {
  syncFollowMessages();
}

function bindMessageScrollListener(): void {
  const viewport = getMessageStream();
  if (!viewport || viewport === boundMessageStream) {
    return;
  }

  boundMessageStream?.removeEventListener('scroll', handleMessageScroll);
  viewport.addEventListener('scroll', handleMessageScroll, { passive: true });
  boundMessageStream = viewport;
  syncFollowMessages(viewport);
}

function scrollMessagesToBottom(): void {
  const viewport = getMessageStream();
  if (!viewport) {
    return;
  }

  viewport.scrollTop = viewport.scrollHeight;
  shouldFollowMessages.value = true;
}

function clearReconnectCountdown(): void {
  reconnectProgress.value = 0;
  if (reconnectCountdownTimer !== null) {
    window.clearInterval(reconnectCountdownTimer);
    reconnectCountdownTimer = null;
  }
}

function clearConnectTimeout(): void {
  if (connectTimeoutTimer !== null) {
    window.clearTimeout(connectTimeoutTimer);
    connectTimeoutTimer = null;
  }
}

function refreshLeftStackHeight(): void {
  leftStackHeight.value = leftStack.value?.clientHeight ?? 0;
}

function startSidebarResize(event: PointerEvent): void {
  const container = leftStack.value;
  if (!container) {
    return;
  }

  event.preventDefault();

  const availableHeight = container.getBoundingClientRect().height - splitterHeightPx;
  if (availableHeight <= 0) {
    return;
  }

  const minTopHeight = Math.min(220, Math.max(120, Math.round(availableHeight * 0.28)));
  const minBottomHeight = Math.min(180, Math.max(108, Math.round(availableHeight * 0.22)));
  const maxTopHeight = Math.max(minTopHeight, availableHeight - minBottomHeight);
  const startTopHeight = Math.min(maxTopHeight, Math.max(minTopHeight, availableHeight * sidebarTopRatio.value));
  const startY = event.clientY;

  sidebarDividerDragging.value = true;
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';

  const stopResize = (): void => {
    sidebarDividerDragging.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', stopResize);
  };

  const handlePointerMove = (moveEvent: PointerEvent): void => {
    const nextTopHeight = Math.min(
      maxTopHeight,
      Math.max(minTopHeight, startTopHeight + moveEvent.clientY - startY),
    );
    sidebarTopRatio.value = nextTopHeight / availableHeight;
    persistSidebarTopRatio();
  };

  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', stopResize, { once: true });
}

function startReconnectCountdown(delayMs: number): void {
  const reconnectAt = Date.now() + delayMs;

  const syncCountdown = (): void => {
    const remainingMs = reconnectAt - Date.now();
    const clampedRemaining = Math.min(Math.max(remainingMs, 0), delayMs);
    reconnectProgress.value = 1 - clampedRemaining / delayMs;
  };

  clearReconnectCountdown();
  syncCountdown();
  reconnectCountdownTimer = window.setInterval(syncCountdown, 50);
}

async function navigateToRoom(roomId: number, replace = false): Promise<void> {
  const method = replace ? router.replace : router.push;
  await method({
    name: 'console',
    params: { teamId: teamId.value, roomId },
  });
}

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
    const roomMessages = await getRoomMessages(roomId);
    messages.value = roomMessages;
    selectedRoomId.value = roomId;
    const room = rooms.value.find((entry) => entry.room_id === roomId);
    if (room) {
      room.unread = 0;
    }
    composerNotice.value = '';
    if (options?.syncRoute !== false && routeRoomId.value !== roomId) {
      await navigateToRoom(roomId, options?.replaceRoute ?? false);
    }
    await nextTick();
    bindMessageScrollListener();
    scrollMessagesToBottom();
  } catch (error) {
    errorMessage.value = '加载消息失败，请检查网络或后端状态。';
    console.error(error);
  } finally {
    reloadingMessages.value = false;
  }
}

async function hydrateRooms(targetTeamId: number): Promise<RoomState[]> {
  const baseRooms = await getRooms(targetTeamId);
  const previews = await Promise.all(
    baseRooms.map(async (room) => {
      try {
        const roomMessages = await getRoomMessages(room.room_id);
        const lastMessage = roomMessages[roomMessages.length - 1];
        return {
          room_id: room.room_id,
          preview: lastMessage ? formatPreview(lastMessage) : '暂无消息',
        };
      } catch (error) {
        console.error(error);
        return {
          room_id: room.room_id,
          preview: '暂无消息',
        };
      }
    }),
  );

  const previewMap = new Map(previews.map((entry) => [entry.room_id, entry.preview]));

  return baseRooms.map((room) => ({
    ...room,
    preview: previewMap.get(room.room_id) ?? '暂无消息',
    unread: 0,
  }));
}

async function refreshAll(): Promise<void> {
  if (!currentTeam.value) {
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    const [nextAgents, nextRooms, nextRoleTemplates, nextDeptTree] = await Promise.all([
      getAgentsByTeamId(teamId.value, { includeSpecial: true }),
      hydrateRooms(teamId.value),
      getRoleTemplates(),
      getDeptTree(teamId.value),
    ]);
    agents.value = nextAgents;
    rooms.value = nextRooms;
    roleTemplates.value = nextRoleTemplates;
    deptTree.value = nextDeptTree;

    const fallbackRoomId = rooms.value[0]?.room_id ?? null;
    const targetRoomId =
      routeRoomId.value && rooms.value.some((room) => room.room_id === routeRoomId.value)
        ? routeRoomId.value
        : fallbackRoomId;

    if (targetRoomId !== null) {
      await loadRoomMessages(targetRoomId, {
        force: true,
        replaceRoute: routeRoomId.value !== targetRoomId,
        syncRoute: true,
      });
    } else {
      messages.value = [];
      selectedRoomId.value = null;
      totalMessageCount.value = 0;
    }
  } catch (error) {
    errorMessage.value = '无法连接到后端服务，请确认服务已启动。';
    console.error(error);
    deptTree.value = null;
  } finally {
    loading.value = false;
  }
}

function applyMessageEvent(event: WsMessageEvent): void {
  if (!currentTeam.value || event.gt_room.team_id !== currentTeam.value.id) {
    return;
  }

  const room = rooms.value.find((entry) => entry.room_id === event.gt_room.id);
  if (!room) {
    return;
  }

  const senderName = resolveMessageSenderName(event.sender_id);

  room.preview = formatPreview({ sender: senderName, content: event.content });

  if (event.gt_room.id === selectedRoomId.value) {
    const wasAtBottom = (() => {
      const viewport = getMessageStream();
      return viewport ? isAtBottom(viewport) : shouldFollowMessages.value;
    })();
    messages.value = [
      ...messages.value,
      { sender: senderName, content: event.content, time: event.time },
    ];
    totalMessageCount.value = messages.value.length;
    nextTick(() => {
      if (wasAtBottom) {
        scrollMessagesToBottom();
      } else {
        syncFollowMessages();
      }
    });
  } else {
    room.unread += 1;
  }
}

function applyAgentStatusEvent(event: WsAgentStatusEvent): void {
  if (!currentTeam.value || event.gt_agent.team_id !== currentTeam.value.id) {
    return;
  }

  const normalizedStatus: AgentStatus = event.status.toLowerCase() as AgentStatus;
  agents.value = agents.value.map((agent) =>
    agent.name === event.gt_agent.name
      ? { ...agent, status: normalizedStatus }
      : agent,
  );
}

function scheduleReconnect(): void {
  const delayMs = reconnectDelayMs;

  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
  }

  reconnectAttempt.value += 1;
  connectionState.value = 'waiting_reconnect';
  startReconnectCountdown(delayMs);
  reconnectTimer = window.setTimeout(() => {
    clearReconnectCountdown();
    connectWebSocket();
  }, delayMs);
}

function connectWebSocket(): void {
  activeSocketToken += 1;
  const socketToken = activeSocketToken;
  const isReconnectAttempt = reconnectAttempt.value > 0;

  clearConnectTimeout();

  if (ws) {
    shouldReconnect = false;
    ws.close();
    shouldReconnect = true;
  }

  connectionState.value = isReconnectAttempt ? 'reconnecting' : 'connecting';
  clearReconnectCountdown();
  ws = createEventsSocket();
  connectTimeoutTimer = window.setTimeout(() => {
    if (socketToken !== activeSocketToken || connectionState.value !== 'reconnecting') {
      return;
    }

    clearConnectTimeout();
    shouldReconnect = false;
    ws?.close();
    shouldReconnect = true;
    connectionState.value = 'disconnected';
    scheduleReconnect();
  }, connectTimeoutMs);

  ws.addEventListener('open', () => {
    if (socketToken !== activeSocketToken) {
      return;
    }
    clearConnectTimeout();
    connectionState.value = 'connected';
    reconnectAttempt.value = 0;
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    clearReconnectCountdown();
    refreshAll().catch(console.error);
  });

  ws.addEventListener('message', (messageEvent) => {
    if (socketToken !== activeSocketToken) {
      return;
    }
    const payload = JSON.parse(messageEvent.data) as WsEvent;
    if (payload.event === 'message') {
      applyMessageEvent(payload);
      return;
    }
    if (payload.event === 'agent_status') {
      applyAgentStatusEvent(payload);
    }
  });

  ws.addEventListener('close', () => {
    if (socketToken !== activeSocketToken) {
      return;
    }
    if (isReconnectAttempt && connectTimeoutTimer !== null && connectionState.value === 'reconnecting') {
      return;
    }
    clearConnectTimeout();
    connectionState.value = 'disconnected';
    if (shouldReconnect) {
      scheduleReconnect();
    }
  });

  ws.addEventListener('error', () => {
    if (socketToken !== activeSocketToken) {
      return;
    }
    if (isReconnectAttempt && connectTimeoutTimer !== null && connectionState.value === 'reconnecting') {
      return;
    }
    clearConnectTimeout();
    connectionState.value = 'disconnected';
  });
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

function resetCreateRoomState(): void {
  createRoomDialogOpen.value = false;
  createRoomConfirmOpen.value = false;
  createRoomName.value = '';
  createRoomMemberIds.value = [];
  creatingRoom.value = false;
}

function openCreateRoomDialog(): void {
  if (loading.value || !currentTeam.value) {
    return;
  }
  createRoomDialogOpen.value = true;
}

function closeCreateRoomDialog(): void {
  if (creatingRoom.value) {
    return;
  }
  resetCreateRoomState();
}

function toggleCreateRoomMember(memberId: number): void {
  createRoomMemberIds.value = createRoomMemberIds.value.includes(memberId)
    ? createRoomMemberIds.value.filter((id) => id !== memberId)
    : [...createRoomMemberIds.value, memberId];
}

function requestCreateRoomConfirm(): void {
  if (!canSubmitCreateRoom.value) {
    return;
  }
  createRoomConfirmOpen.value = true;
}

function closeCreateRoomConfirm(): void {
  if (creatingRoom.value) {
    return;
  }
  createRoomConfirmOpen.value = false;
}

async function confirmCreateRoom(): Promise<void> {
  if (!currentTeam.value || !canSubmitCreateRoom.value) {
    return;
  }

  creatingRoom.value = true;

  try {
    const payload = {
      name: createRoomName.value.trim(),
      agent_ids: [...createRoomMemberIds.value],
    };
    const result = await createTeamRoom(teamId.value, payload);
    const nextRooms = await hydrateRooms(teamId.value);
    rooms.value = nextRooms;

    const createdRoom = nextRooms.find((room) => room.room_name === result.room_name);
    if (createdRoom) {
      await loadRoomMessages(createdRoom.room_id, { force: true });
    }

    resetCreateRoomState();
  } catch (error) {
    console.error(error);
    creatingRoom.value = false;
  }
}

function openAgent(agentName: string): void {
  selectedAgentId.value = agents.value.find((agent) => agent.name === agentName)?.id ?? null;
  selectedAgentName.value = agentName;
  agentDetailOpen.value = true;
}

function closeAgentDetail(): void {
  agentDetailOpen.value = false;
  selectedAgentId.value = null;
  selectedAgentName.value = null;
}

watch(currentRoom, (room) => {
  composerNotice.value = '';
});

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
  messages,
  (items) => {
    totalMessageCount.value = items.length;
  },
  { immediate: true },
);

onMounted(async () => {
  restoreSidebarTopRatio();
  refreshLeftStackHeight();
  if (leftStack.value) {
    leftStackResizeObserver = new ResizeObserver(() => {
      refreshLeftStackHeight();
    });
    leftStackResizeObserver.observe(leftStack.value);
  }
  if (currentTeam.value) {
    await refreshAll();
  }
  bindMessageScrollListener();
  connectWebSocket();
});

onBeforeUnmount(() => {
  leftStackResizeObserver?.disconnect();
  leftStackResizeObserver = null;
  boundMessageStream?.removeEventListener('scroll', handleMessageScroll);
  boundMessageStream = null;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  shouldReconnect = false;
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
  }
  clearConnectTimeout();
  clearReconnectCountdown();
  if (ws) {
    ws.close();
    ws = null;
  }
  totalMessageCount.value = 0;
});
</script>

<template>
  <div class="workspace-grid">
    <div ref="leftStack" class="left-stack" :style="leftStackStyle">
      <div class="left-pane">
        <RoomListSection
          :loading="loading"
          :rooms="rooms"
          :current-room-id="selectedRoomId"
          :create-disabled="loading || !agents.length"
          @select-room="loadRoomMessages($event, { force: true })"
          @create-room="openCreateRoomDialog"
        />
      </div>

      <button
        type="button"
        class="left-stack-splitter"
        :class="{ dragging: sidebarDividerDragging }"
        aria-label="调整聊天室和成员卡片高度"
        @pointerdown="startSidebarResize"
      >
        <span class="splitter-grip"></span>
      </button>

      <div class="left-pane">
        <AgentListSection :agents="visibleAgents" @select-agent="openAgent" />
      </div>
    </div>

    <div ref="messageViewport" class="chat-shell">
      <ChatPanel
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

    <CreateRoomDialog
      :open="createRoomDialogOpen && !createRoomConfirmOpen"
      :room-name="createRoomName"
      :members="roomCreateMemberOptions"
      :selected-member-ids="createRoomMemberIds"
      :submitting="creatingRoom"
      :can-submit="canSubmitCreateRoom"
      @close="closeCreateRoomDialog"
      @update:room-name="createRoomName = $event"
      @toggle-member="toggleCreateRoomMember"
      @submit="requestCreateRoomConfirm"
    />

    <ConfirmDialog
      :open="createRoomConfirmOpen"
      title="确认创建聊天室"
      :message="createRoomConfirmMessage"
      confirm-label="确认创建"
      cancel-label="返回编辑"
      @close="closeCreateRoomConfirm"
      @confirm="confirmCreateRoom"
    />

    <AgentDetailDialog
      :open="agentDetailOpen"
      :agent-id="selectedAgentId"
      :agent-name="selectedAgentName"
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
}

.left-pane {
  min-height: 0;
  display: flex;
}

.left-pane > * {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
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
