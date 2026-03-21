<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  createEventsSocket,
  getAgents,
  getRoomMessages,
  getRooms,
  postRoomMessage,
} from './api';
import type {
  AgentInfo,
  MessageInfo,
  RoomInfo,
  RoomState,
  WsAgentStatusEvent,
  WsEvent,
  WsMessageEvent,
} from './types';

type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

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
const messageViewport = ref<HTMLElement | null>(null);

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;

const sortedAgents = computed(() => {
  const unique = new Map<string, AgentInfo>();

  for (const agent of agents.value) {
    if (!unique.has(agent.name)) {
      unique.set(agent.name, agent);
    }
  }

  return Array.from(unique.values());
});

const currentRoom = computed(() =>
  rooms.value.find((room) => room.room_id === currentRoomId.value) ?? null,
);

const isPrivateRoom = computed(() => currentRoom.value?.room_type === 'private');

const totalMessageCount = computed(() => messages.value.length);

const statusLabel = computed(() => {
  if (connectionState.value === 'connected') {
    return '已连接';
  }
  if (connectionState.value === 'reconnecting') {
    return `重连中 #${reconnectAttempt.value}`;
  }
  if (connectionState.value === 'disconnected') {
    return '已断开';
  }
  return '连接中';
});

const groupedRooms = computed(() => {
  const map = new Map<string, RoomState[]>();

  for (const room of rooms.value) {
    const bucket = map.get(room.team_name) ?? [];
    bucket.push(room);
    map.set(room.team_name, bucket);
  }

  return Array.from(map.entries());
});

function formatPreview(message: Pick<MessageInfo, 'sender' | 'content'>): string {
  return `${message.sender}: ${message.content.replace(/\n/g, ' ')}`;
}

function formatTime(time: string): string {
  const date = new Date(time);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

function bubbleSide(sender: string): 'left' | 'right' | 'center' {
  if (sender === 'system') {
    return 'center';
  }
  if (sender === 'Operator') {
    return 'right';
  }
  return 'left';
}

function scrollMessagesToBottom(force = false): void {
  const viewport = messageViewport.value;

  if (!viewport) {
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
  if (room) {
    room.preview = formatPreview({ sender: event.sender, content: event.content });

    if (event.room_id === currentRoomId.value) {
      messages.value = [...messages.value, { sender: event.sender, content: event.content, time: event.time }];
      nextTick(() => scrollMessagesToBottom());
    } else {
      room.unread += 1;
    }
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
  if (ws) {
    ws.close();
  }

  connectionState.value = reconnectAttempt.value > 0 ? 'reconnecting' : 'connecting';
  ws = createEventsSocket();

  ws.addEventListener('open', () => {
    connectionState.value = 'connected';
    reconnectAttempt.value = 0;
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    refreshAll({ preserveSelection: true }).catch(console.error);
  });

  ws.addEventListener('message', (messageEvent) => {
    const payload = JSON.parse(messageEvent.data) as WsEvent;
    if (payload.event === 'message') {
      applyMessageEvent(payload);
      return;
    }
    applyAgentStatusEvent(payload);
  });

  ws.addEventListener('close', () => {
    connectionState.value = 'disconnected';
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
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

watch(currentRoom, (room) => {
  composerNotice.value = room?.room_type === 'private' ? '' : '当前为观察模式';
});

onMounted(async () => {
  await refreshAll();
  connectWebSocket();
});

onBeforeUnmount(() => {
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

    <header class="topbar">
      <div>
        <p class="eyebrow">Team Agent Web Console</p>
        <h1>多人协作观测台</h1>
      </div>
      <div class="status-group">
        <div class="status-pill" :data-state="connectionState">
          <span class="status-dot"></span>
          {{ statusLabel }}
        </div>
        <div class="metric-pill">{{ totalMessageCount }} 条消息</div>
      </div>
    </header>

    <main class="workspace">
      <aside class="sidebar panel">
        <section class="sidebar-block">
          <div class="block-head">
            <h2>聊天室</h2>
            <span>{{ rooms.length }}</span>
          </div>

          <div v-if="loading" class="placeholder">正在同步房间列表…</div>

          <template v-else>
            <div v-for="[teamName, teamRooms] in groupedRooms" :key="teamName" class="team-group">
              <div class="team-name">{{ teamName }}</div>
              <button
                v-for="room in teamRooms"
                :key="room.room_id"
                class="room-card"
                :class="{ selected: room.room_id === currentRoomId }"
                type="button"
                @click="loadRoomMessages(room.room_id, { force: true })"
              >
                <div class="room-head">
                  <div class="room-title">
                    <span class="room-icon">{{ room.room_type === 'private' ? '单' : '群' }}</span>
                    <strong>{{ room.room_name }}</strong>
                  </div>
                  <span v-if="room.unread > 0" class="unread-badge">{{ room.unread }}</span>
                </div>
                <div class="room-meta">{{ room.members.length }} 人 · {{ room.state }}</div>
                <p class="room-preview">{{ room.preview }}</p>
              </button>
            </div>
          </template>
        </section>

        <section class="sidebar-block">
          <div class="block-head">
            <h2>Agent</h2>
            <span>{{ sortedAgents.length }}</span>
          </div>
          <div class="agent-list">
            <div v-for="agent in sortedAgents" :key="agent.name" class="agent-card">
              <div>
                <strong>{{ agent.name }}</strong>
                <p>{{ agent.model }}</p>
              </div>
              <div class="agent-state" :data-state="agent.status">
                <span class="status-dot"></span>
                {{ agent.status === 'active' ? '忙碌' : '空闲' }}
              </div>
            </div>
          </div>
        </section>
      </aside>

      <section class="chat panel">
        <div class="chat-head">
          <div>
            <p class="eyebrow">当前房间</p>
            <h2>{{ currentRoom?.room_name ?? '暂无房间' }}</h2>
          </div>
          <div class="chat-side-info">
            <span>{{ currentRoom?.team_name ?? '未分组' }}</span>
            <span>{{ currentRoom?.room_type === 'private' ? '可发送消息' : '观察模式' }}</span>
          </div>
        </div>

        <div v-if="errorMessage" class="banner error">{{ errorMessage }}</div>
        <div v-else-if="reloadingMessages" class="banner">正在加载消息…</div>

        <div ref="messageViewport" class="message-stream">
          <div
            v-for="(message, index) in messages"
            :key="`${message.time}-${message.sender}-${index}`"
            class="message-row"
            :class="`side-${bubbleSide(message.sender)}`"
          >
            <template v-if="bubbleSide(message.sender) === 'center'">
              <div class="system-note">{{ message.content }}</div>
            </template>
            <template v-else>
              <div class="message-meta">
                <span v-if="bubbleSide(message.sender) === 'left'" class="sender">{{ message.sender }}</span>
                <span class="time">{{ formatTime(message.time) }}</span>
                <span v-if="bubbleSide(message.sender) === 'right'" class="sender">{{ message.sender }}</span>
              </div>
              <div class="bubble">{{ message.content }}</div>
            </template>
          </div>
        </div>

        <form class="composer" @submit.prevent="handleSubmit">
          <textarea
            v-model="draft"
            :disabled="!isPrivateRoom"
            placeholder="在这里输入发给 Agent 的消息…"
            rows="3"
          ></textarea>
          <div class="composer-foot">
            <span>{{ composerNotice || '按 Enter 发送，Shift + Enter 换行' }}</span>
            <button type="submit" :disabled="!isPrivateRoom || !draft.trim()">发送</button>
          </div>
        </form>
      </section>
    </main>
  </div>
</template>
