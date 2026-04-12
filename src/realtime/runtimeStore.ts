import { ref } from 'vue';
import { totalMessageCount, updateScheduleState } from '../appUiState';
import {
  getAgentActivities as fetchAgentActivities,
  getAgentsByTeamId as fetchAgentsByTeamId,
  getDeptTree as fetchDeptTree,
  getRoleTemplates as fetchRoleTemplates,
  getRoomMessages as fetchRoomMessages,
  getRooms as fetchRooms,
} from '../api';
import type {
  AgentActivity,
  AgentInfo,
  AgentStatus,
  DeptTreeNode,
  MessageInfo,
  RoleTemplateSummary,
  RoomState,
} from '../types';
import { formatPreview } from '../utils';
import type { FrontendRealtimeEvent } from './eventNormalizer';
import { subscribeRealtimeEvents } from './wsClient';

const teamAgentsState = ref<Record<number, AgentInfo[]>>({});
const teamRoomsState = ref<Record<number, RoomState[]>>({});
const roomMessagesState = ref<Record<number, MessageInfo[]>>({});
const agentActivitiesState = ref<Record<number, AgentActivity[]>>({});
const agentStatusState = ref<Record<number, AgentStatus>>({});
const teamDeptTreeState = ref<Record<number, DeptTreeNode | null>>({});
const roleTemplatesState = ref<RoleTemplateSummary[]>([]);

const activeTeamId = ref<number | null>(null);
const activeRoomId = ref<number | null>(null);

function syncTotalMessageCount(): void {
  if (activeRoomId.value === null) {
    totalMessageCount.value = 0;
    return;
  }

  totalMessageCount.value = roomMessagesState.value[activeRoomId.value]?.length ?? 0;
}

function resolveMessageSenderName(teamId: number, senderId: number): string {
  if (senderId === -1) {
    return 'OPERATOR';
  }
  if (senderId === -2) {
    return 'SYSTEM';
  }

  const matchedAgent = (teamAgentsState.value[teamId] ?? []).find((agent) => agent.id === senderId);
  if (matchedAgent?.name) {
    return matchedAgent.name;
  }

  return String(senderId);
}

function updateTeamRooms(teamId: number, updater: (rooms: RoomState[]) => RoomState[]): void {
  const currentRooms = teamRoomsState.value[teamId] ?? [];
  teamRoomsState.value = {
    ...teamRoomsState.value,
    [teamId]: updater(currentRooms),
  };
}

function markRoomAsReadInternal(teamId: number, roomId: number): void {
  updateTeamRooms(teamId, (rooms) =>
    rooms.map((room) =>
      room.room_id === roomId
        ? { ...room, unread: 0 }
        : room,
    ),
  );
}

function upsertAgentActivity(activity: AgentActivity): void {
  const currentItems = agentActivitiesState.value[activity.agent_id] ?? [];
  const nextItems = [...currentItems];
  const index = nextItems.findIndex((item) => item.id === activity.id);
  if (index >= 0) {
    nextItems[index] = activity;
  } else {
    nextItems.push(activity);
  }
  nextItems.sort((a, b) => a.id - b.id);
  agentActivitiesState.value = {
    ...agentActivitiesState.value,
    [activity.agent_id]: nextItems,
  };
}

export function seedTeamAgents(teamId: number, agents: AgentInfo[]): void {
  teamAgentsState.value = {
    ...teamAgentsState.value,
    [teamId]: agents,
  };

  const nextStatusState = { ...agentStatusState.value };
  for (const agent of agents) {
    if (typeof agent.id === 'number' && agent.id > 0) {
      nextStatusState[agent.id] = agent.status;
    }
  }
  agentStatusState.value = nextStatusState;
}

export async function loadTeamAgents(teamId: number, options?: { includeSpecial?: boolean }): Promise<AgentInfo[]> {
  const agents = await fetchAgentsByTeamId(teamId, options);
  seedTeamAgents(teamId, agents);
  return agents;
}

export function seedTeamRooms(teamId: number, rooms: RoomState[]): void {
  const existingRooms = new Map((teamRoomsState.value[teamId] ?? []).map((room) => [room.room_id, room]));
  const mergedRooms = rooms.map((room) => {
    const previous = existingRooms.get(room.room_id);
    return {
      ...room,
      unread: previous?.unread ?? room.unread ?? 0,
      current_turn_agent: room.current_turn_agent ?? previous?.current_turn_agent ?? null,
    };
  });

  teamRoomsState.value = {
    ...teamRoomsState.value,
    [teamId]: mergedRooms,
  };
}

export async function loadTeamRooms(teamId: number): Promise<RoomState[]> {
  const baseRooms = await fetchRooms(teamId);
  const previews = await Promise.all(
    baseRooms.map(async (room) => {
      try {
        const roomMessages = await fetchRoomMessages(room.room_id);
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
  const rooms: RoomState[] = baseRooms.map((room) => ({
    ...room,
    preview: previewMap.get(room.room_id) ?? '暂无消息',
    unread: 0,
    current_turn_agent: room.current_turn_agent ?? null,
  }));

  seedTeamRooms(teamId, rooms);
  return rooms;
}

export function seedRoomMessages(roomId: number, messages: MessageInfo[]): void {
  roomMessagesState.value = {
    ...roomMessagesState.value,
    [roomId]: [...messages],
  };
  syncTotalMessageCount();
}

export async function loadRoomMessagesState(roomId: number): Promise<MessageInfo[]> {
  const messages = await fetchRoomMessages(roomId);
  seedRoomMessages(roomId, messages);
  return messages;
}

export function seedAgentActivities(agentId: number, activities: AgentActivity[]): void {
  agentActivitiesState.value = {
    ...agentActivitiesState.value,
    [agentId]: [...activities].sort((a, b) => a.id - b.id),
  };
}

export async function loadAgentActivities(agentId: number): Promise<AgentActivity[]> {
  const activities = await fetchAgentActivities(agentId);
  seedAgentActivities(agentId, activities);
  return activities;
}

export function seedDeptTree(teamId: number, deptTree: DeptTreeNode | null): void {
  teamDeptTreeState.value = {
    ...teamDeptTreeState.value,
    [teamId]: deptTree,
  };
}

export async function loadDeptTree(teamId: number): Promise<DeptTreeNode | null> {
  const deptTree = await fetchDeptTree(teamId);
  seedDeptTree(teamId, deptTree);
  return deptTree;
}

export function seedRoleTemplates(roleTemplates: RoleTemplateSummary[]): void {
  roleTemplatesState.value = [...roleTemplates];
}

export async function loadRoleTemplates(): Promise<RoleTemplateSummary[]> {
  const roleTemplates = await fetchRoleTemplates();
  seedRoleTemplates(roleTemplates);
  return roleTemplates;
}

export function setActiveRealtimeContext(teamId: number | null, roomId: number | null): void {
  activeTeamId.value = teamId;
  activeRoomId.value = roomId;

  if (teamId !== null && roomId !== null) {
    markRoomAsReadInternal(teamId, roomId);
  }

  syncTotalMessageCount();
}

export function getTeamAgents(teamId: number | null): AgentInfo[] {
  if (teamId === null) {
    return [];
  }
  return teamAgentsState.value[teamId] ?? [];
}

export function getTeamRooms(teamId: number | null): RoomState[] {
  if (teamId === null) {
    return [];
  }
  return teamRoomsState.value[teamId] ?? [];
}

export function getRoomMessages(roomId: number | null): MessageInfo[] {
  if (roomId === null) {
    return [];
  }
  return roomMessagesState.value[roomId] ?? [];
}

export function getAgentActivities(agentId: number | null): AgentActivity[] {
  if (agentId === null) {
    return [];
  }
  return agentActivitiesState.value[agentId] ?? [];
}

export function getAgentStatus(agentId: number | null): AgentStatus | null {
  if (agentId === null) {
    return null;
  }
  return agentStatusState.value[agentId] ?? null;
}

export function getDeptTreeState(teamId: number | null): DeptTreeNode | null {
  if (teamId === null) {
    return null;
  }
  return teamDeptTreeState.value[teamId] ?? null;
}

export function getRoleTemplatesState(): RoleTemplateSummary[] {
  return roleTemplatesState.value;
}

export function applyRealtimeEvent(event: FrontendRealtimeEvent): void {
  if (event.type === 'message') {
    const senderName = resolveMessageSenderName(event.teamId, event.senderId);
    const nextMessage: MessageInfo = {
      ...event.message,
      sender: senderName,
    };

    updateTeamRooms(event.teamId, (rooms) =>
      rooms.map((room) => {
        if (room.room_id !== event.roomId) {
          return room;
        }

        const shouldResetUnread =
          activeTeamId.value === event.teamId && activeRoomId.value === event.roomId;

        return {
          ...room,
          preview: formatPreview(nextMessage),
          unread: shouldResetUnread ? 0 : room.unread + 1,
        };
      }),
    );

    const currentMessages = roomMessagesState.value[event.roomId] ?? [];
    const alreadyExists = currentMessages.some((message) =>
      message.sender === nextMessage.sender
      && message.content === nextMessage.content
      && message.time === nextMessage.time,
    );
    if (!alreadyExists) {
      roomMessagesState.value = {
        ...roomMessagesState.value,
        [event.roomId]: [...currentMessages, nextMessage],
      };
    }

    if (activeTeamId.value === event.teamId && activeRoomId.value === event.roomId) {
      syncTotalMessageCount();
    }
    return;
  }

  if (event.type === 'agent_status') {
    agentStatusState.value = {
      ...agentStatusState.value,
      [event.agentId]: event.status,
    };

    const currentAgents = teamAgentsState.value[event.teamId] ?? [];
    if (!currentAgents.length) {
      return;
    }

    teamAgentsState.value = {
      ...teamAgentsState.value,
      [event.teamId]: currentAgents.map((agent) =>
        (agent.id === event.agentId || agent.name === event.agentName)
          ? { ...agent, status: event.status }
          : agent,
      ),
    };
    return;
  }

  if (event.type === 'room_status') {
    updateTeamRooms(event.teamId, (rooms) =>
      rooms.map((room) =>
        room.room_id === event.roomId
          ? {
            ...room,
            state: event.state,
            need_scheduling: event.needScheduler,
            current_turn_agent: event.currentTurnAgent,
          }
          : room,
      ),
    );
    return;
  }

  if (event.type === 'schedule_state') {
    updateScheduleState(event.scheduleState, event.notRunningReason);
    return;
  }

  upsertAgentActivity(event.activity);
}

subscribeRealtimeEvents((event) => {
  applyRealtimeEvent(event);
});
