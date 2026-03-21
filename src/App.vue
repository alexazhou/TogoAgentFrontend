<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { createEventsSocket, getAgents, getRoomMessages, getRooms, postRoomMessage } from './api';
import AgentListSection from './components/AgentListSection.vue';
import ChatPanel from './components/ChatPanel.vue';
import RoomListSection from './components/RoomListSection.vue';
import TopBar from './components/TopBar.vue';
import type {
  AgentInfo,
  MessageInfo,
  RoomInfo,
  RoomState,
  WsAgentStatusEvent,
  WsEvent,
  WsMessageEvent,
} from './types';
import {
  formatConnectionState,
  formatPreview,
  groupRoomsByTeam,
  type ConnectionState,
} from './utils';

const rooms = ref<RoomState[]>([]);
const agents = ref<AgentInfo[]>([]);
const messages = ref<MessageInfo[]>([]);
const currentRoomId = ref<string | null>(null);
const draft = ref('');
const loading = ref(true);
const reloadingMessages = ref(false);
const errorMessage = ref('');
const connectionState = ref<ConnectionState>('connecting');
const reconnectAttempt = ref(0);
const composerNotice = ref('当前为观察模式');
const messageViewport = useTemplateRef('messageViewport');

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let shouldReconnect = true;
let activeSocketToken = 0;

const currentRoom = computed(
  () => rooms.value.find((room) => room.room_id === currentRoomId.value) ?? null,
);
const totalMessageCount = computed(() => messages.value.length);
const statusLabel = computed(() =>
  formatConnectionState(connectionState.value, reconnectAttempt.value),
);
const groupedRooms = computed(() => groupRoomsByTeam(rooms.value));
const uniqueAgents = computed(() => {
  const unique = new Map<string, AgentInfo>();

  for (const agent of agents.value) {
    if (!unique.has(agent.name)) {
      unique.set(agent.name, agent);
    }
  }

  return Array.from(unique.values());
});

function scrollMessagesToBottom(force = false): void {
  const viewport = messageViewport.value?.querySelector('.message-stream');

  if (!(viewport instanceof HTMLElement)) {
    return;
  }

  const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
  if (force || distanceToBottom < 64) {
    viewport.scrollTop = viewport.scrollHeight;
  }
}

async function loadRoomMessages(roomId: string, options?: { force?: boolean }): Promise<void> {
  if (!options?.force && currentRoomId.value === roomId) {
    return;
  }

  reloadingMessages.value = true;
  errorMessage.value = '';

  try {
    const roomMessages = await getRoomMessages(roomId);
    messages.value = roomMessages;
    currentRoomId.value = roomId;
    const room = rooms.value.find((entry) => entry.room_id === roomId);
    if (room) {
      room.unread = 0;
    }
    composerNotice.value = room?.room_type === 'private' ? '' : '当前为观察模式';
    await nextTick();
    scrollMessagesToBottom(true);
  } catch (error) {
    errorMessage.value = '加载消息失败，请检查网络或后端状态。';
    console.error(error);
  } finally {
    reloadingMessages.value = false;
  }
}

async function hydrateRooms(baseRooms: RoomInfo[]): Promise<RoomState[]> {
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

async function refreshAll(options?: { preserveSelection?: boolean }): Promise<void> {
  loading.value = true;
  errorMessage.value = '';

  try {
    const [nextAgents, nextRooms] = await Promise.all([getAgents(), getRooms()]);
    agents.value = nextAgents;
    rooms.value = await hydrateRooms(nextRooms);

    const fallbackRoomId = rooms.value[0]?.room_id ?? null;
    const targetRoomId =
      options?.preserveSelection && currentRoomId.value
        ? currentRoomId.value
        : currentRoomId.value ?? fallbackRoomId;

    if (targetRoomId) {
      await loadRoomMessages(targetRoomId, { force: true });
    } else {
      messages.value = [];
      currentRoomId.value = null;
    }
  } catch (error) {
    errorMessage.value = '无法连接到后端服务，请确认服务已启动。';
    console.error(error);
  } finally {
    loading.value = false;
  }
}

function applyMessageEvent(event: WsMessageEvent): void {
  const room = rooms.value.find((entry) => entry.room_id === event.room_id);
  if (!room) {
    return;
  }

  room.preview = formatPreview({ sender: event.sender, content: event.content });

  if (event.room_id === currentRoomId.value) {
    messages.value = [
      ...messages.value,
      { sender: event.sender, content: event.content, time: event.time },
    ];
    nextTick(() => scrollMessagesToBottom());
  } else {
    room.unread += 1;
  }
}

function applyAgentStatusEvent(event: WsAgentStatusEvent): void {
  agents.value = agents.value.map((agent) =>
    agent.name === event.agent_name && agent.team_name === event.team_name
      ? { ...agent, status: event.status }
      : agent,
  );
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
  }

  reconnectAttempt.value += 1;
  connectionState.value = 'reconnecting';
  reconnectTimer = window.setTimeout(() => {
    connectWebSocket();
  }, 3000);
}

function connectWebSocket(): void {
  activeSocketToken += 1;
  const socketToken = activeSocketToken;

  if (ws) {
    shouldReconnect = false;
    ws.close();
    shouldReconnect = true;
  }

  connectionState.value = reconnectAttempt.value > 0 ? 'reconnecting' : 'connecting';
  ws = createEventsSocket();

  ws.addEventListener('open', () => {
    if (socketToken !== activeSocketToken) {
      return;
    }
    connectionState.value = 'connected';
    reconnectAttempt.value = 0;
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    refreshAll({ preserveSelection: true }).catch(console.error);
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
    applyAgentStatusEvent(payload);
  });

  ws.addEventListener('close', () => {
    if (socketToken !== activeSocketToken) {
      return;
    }
    connectionState.value = 'disconnected';
    if (shouldReconnect) {
      scheduleReconnect();
    }
  });

  ws.addEventListener('error', () => {
    if (socketToken !== activeSocketToken) {
      return;
    }
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

watch(currentRoom, (room) => {
  composerNotice.value = room?.room_type === 'private' ? '' : '当前为观察模式';
});

onMounted(async () => {
  await refreshAll();
  connectWebSocket();
});

onBeforeUnmount(() => {
  shouldReconnect = false;
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
  }
  if (ws) {
    ws.close();
    ws = null;
  }
});
</script>

<template>
  <div class="shell">
    <div class="ambient ambient-left"></div>
    <div class="ambient ambient-right"></div>

    <TopBar
      :connection-state="connectionState"
      :status-label="statusLabel"
      :total-message-count="totalMessageCount"
    />

    <main class="workspace">
      <div class="left-stack">
        <RoomListSection
          :loading="loading"
          :grouped-rooms="groupedRooms"
          :current-room-id="currentRoomId"
          @select-room="loadRoomMessages($event, { force: true })"
        />

        <AgentListSection :agents="uniqueAgents" />
      </div>

      <div ref="messageViewport" class="chat-shell">
        <ChatPanel
          :current-room="currentRoom"
          :messages="messages"
          :error-message="errorMessage"
          :reloading-messages="reloadingMessages"
          :draft="draft"
          :composer-notice="composerNotice"
          @update-draft="updateDraft"
          @submit="handleSubmit"
        />
      </div>
    </main>
  </div>
</template>
