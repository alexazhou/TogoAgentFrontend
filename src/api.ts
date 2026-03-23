import type {
  AgentDetail,
  AgentInfo,
  CreateTeamPayload,
  MessageInfo,
  RoomInfo,
  TeamDetail,
  TeamSummary,
} from './types';

type RawRoomInfo = Partial<RoomInfo> & {
  name?: string;
  agents?: string[];
  messages?: Array<{
    sender_name?: string;
    content?: string;
    send_time?: string;
  }>;
  room_type?: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function makeUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

function withSearch(path: string, params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

function makeWsUrl(path: string): string {
  if (API_BASE_URL) {
    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = path;
    return url.toString();
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(makeUrl(path), {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function normalizeRoom(room: RawRoomInfo): RoomInfo {
  const teamName = room.team_name ?? 'default';
  const roomName = room.room_name ?? room.name ?? '';
  const roomType = (room.room_type ?? 'group').toLowerCase();

  return {
    room_id: room.room_id as number,
    room_name: roomName,
    team_name: teamName,
    room_type: roomType === 'private' ? 'private' : 'group',
    state: room.state ?? 'idle',
    members: room.members ?? room.agents ?? [],
  };
}

export async function getAgents(): Promise<AgentInfo[]> {
  const data = await requestJson<{ agents: AgentInfo[] }>('/agents/list.json');
  return data.agents;
}

export async function getAgentsByTeam(teamName: string): Promise<AgentInfo[]> {
  const data = await requestJson<{ agents: AgentInfo[] }>(
    withSearch('/agents/list.json', { team_name: teamName }),
  );
  return data.agents;
}

export async function getRooms(teamName?: string): Promise<RoomInfo[]> {
  const data = await requestJson<{ rooms: RawRoomInfo[] }>(
    withSearch('/rooms/list.json', { team_name: teamName }),
  );
  return data.rooms.map(normalizeRoom);
}

export async function getTeams(): Promise<TeamSummary[]> {
  const data = await requestJson<{ teams: TeamSummary[] }>('/teams/list.json');
  return data.teams;
}

export async function getTeamDetail(teamId: number): Promise<TeamDetail> {
  return requestJson<TeamDetail>(`/teams/${teamId}.json`);
}

export async function createTeam(payload: CreateTeamPayload): Promise<{ status: string; name: string }> {
  return requestJson('/teams/create.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAgentDetail(teamId: number, agentName: string): Promise<AgentDetail> {
  return requestJson<AgentDetail>(`/teams/${teamId}/agents/${encodeURIComponent(agentName)}.json`);
}

export async function getRoomMessages(roomId: number): Promise<MessageInfo[]> {
  const data = await requestJson<{ messages: MessageInfo[] }>(
    `/rooms/${roomId}/messages/list.json`,
  );
  return data.messages;
}

export async function postRoomMessage(roomId: number, content: string): Promise<void> {
  await requestJson(`/rooms/${roomId}/messages/send.json`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function createEventsSocket(): WebSocket {
  return new WebSocket(makeWsUrl('/ws/events.json'));
}
