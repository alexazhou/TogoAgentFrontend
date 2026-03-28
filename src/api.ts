import type {
  AgentStatus,
  AgentDetail,
  AgentInfo,
  CreateTeamPayload,
  DeptTreeNode,
  MessageInfo,
  RoleTemplateSummary,
  RoomInfo,
  TeamDetail,
  TeamSummary,
} from './types';
import { showGlobalRequestError } from './appUiState';

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

type RawAgentInfo = Partial<AgentInfo> & {
  status?: string;
  role_template_name?: string;
  employ_status?: string;
  driver?: string;
};

type RawAgentDetail = Partial<AgentDetail> & {
  status?: string;
  role_template_name?: string;
  employ_status?: string;
  driver?: string;
};

type RawDeptTreeResponse = {
  dept_tree?: DeptTreeNode | null;
};

type RawRoleTemplateSummary = Partial<RoleTemplateSummary>;

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
  try {
    const response = await fetch(makeUrl(path), {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });

    if (!response.ok) {
      const message = `请求失败：${response.status} ${path}`;
      showGlobalRequestError(message);
      throw new Error(`Request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Request failed:')) {
      throw error;
    }

    showGlobalRequestError(`无法连接后端：${path}`);
    throw error;
  }
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
    state: (room.state ?? 'idle').toLowerCase(),
    members: room.members ?? room.agents ?? [],
  };
}

function normalizeAgentStatus(status?: string): AgentStatus {
  return status?.toLowerCase() === 'active' ? 'active' : 'idle';
}

function normalizeAgent(agent: RawAgentInfo): AgentInfo {
  const templateName = agent.role_template_name ?? agent.template_name ?? null;
  return {
    id: typeof agent.id === 'number' ? agent.id : null,
    name: String(agent.name ?? ''),
    template_name: templateName,
    role_template_name: templateName,
    model: String(agent.model ?? ''),
    team_name: String(agent.team_name ?? ''),
    status: normalizeAgentStatus(agent.status),
    employ_status: agent.employ_status ?? null,
    driver: typeof agent.driver === 'string' ? agent.driver : '',
  };
}

function parseDriverType(detail: RawAgentDetail): string {
  if (detail.driver_type) {
    return String(detail.driver_type);
  }

  if (typeof detail.driver !== 'string' || !detail.driver.trim()) {
    return '';
  }

  try {
    const parsed = JSON.parse(detail.driver) as { type?: unknown };
    return typeof parsed.type === 'string' ? parsed.type : '';
  } catch {
    return '';
  }
}

function normalizeAgentDetail(agent: RawAgentDetail): AgentDetail {
  return {
    ...normalizeAgent(agent),
    agent_name: String(agent.agent_name ?? agent.role_template_name ?? agent.template_name ?? agent.name ?? ''),
    driver_type: parseDriverType(agent),
    prompt: String(agent.prompt ?? ''),
  };
}

export async function getAgents(): Promise<AgentInfo[]> {
  const data = await requestJson<{ agents: RawAgentInfo[] }>('/agents/list.json');
  return data.agents.map(normalizeAgent);
}

export async function getAgentsByTeamId(teamId: number): Promise<AgentInfo[]> {
  const data = await requestJson<{ agents: RawAgentInfo[] }>(
    withSearch('/agents/list.json', { team_id: teamId }),
  );
  return data.agents.map(normalizeAgent);
}

export async function setAgentsByTeamId(
  teamId: number,
  payload: Array<{
    id: number;
    name: string;
    role_template_name: string;
    model: string;
    driver: string;
  }>,
): Promise<{ status: string }> {
  return requestJson(`/teams/${teamId}/agents/batch_update.json`, {
    method: 'PUT',
    body: JSON.stringify({ agents: payload }),
  });
}

export async function getRooms(teamId?: number): Promise<RoomInfo[]> {
  const data = await requestJson<{ rooms: RawRoomInfo[] }>(
    withSearch('/rooms/list.json', { team_id: teamId }),
  );
  return data.rooms.map(normalizeRoom);
}

export async function getTeams(): Promise<TeamSummary[]> {
  const data = await requestJson<{ teams: TeamSummary[] }>('/teams/list.json');
  return data.teams;
}

export async function getRoleTemplates(): Promise<RoleTemplateSummary[]> {
  const data = await requestJson<{ role_templates: RawRoleTemplateSummary[] }>('/role_templates/list.json');
  return data.role_templates.map((template) => ({
    name: String(template.name ?? ''),
    model: String(template.model ?? ''),
  }));
}

export async function getTeamDetail(teamId: number): Promise<TeamDetail> {
  return requestJson<TeamDetail>(`/teams/${teamId}.json`);
}

export async function getDeptTree(teamId: number): Promise<DeptTreeNode | null> {
  const data = await requestJson<RawDeptTreeResponse>(`/teams/${teamId}/dept_tree.json`);
  return data.dept_tree ?? null;
}

export async function setDeptTree(teamId: number, deptTree: DeptTreeNode): Promise<{ status: string }> {
  return requestJson(`/teams/${teamId}/dept_tree.json`, {
    method: 'PUT',
    body: JSON.stringify({ dept_tree: deptTree }),
  });
}

export async function updateTeam(
  teamId: number,
  payload: {
    working_directory?: string;
    config?: Record<string, unknown>;
    members?: Array<{
      name: string;
      role_template: string;
    }>;
    preset_rooms?: Array<{
      name: string;
      members: string[];
      initial_topic?: string | null;
      max_turns: number;
    }>;
  },
): Promise<{ status: string; name: string }> {
  return requestJson(`/teams/${teamId}/modify.json`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createTeam(payload: CreateTeamPayload): Promise<{ status: string; name: string }> {
  return requestJson('/teams/create.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAgentDetail(teamId: number, agentName: string): Promise<AgentDetail> {
  const encodedAgentName = encodeURIComponent(agentName);
  const data = await requestJson<RawAgentDetail>(
    `/teams/${teamId}/agents/${encodedAgentName}.json`,
  );
  return normalizeAgentDetail(data);
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
