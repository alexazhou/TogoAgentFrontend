import type {
  AgentActivity,
  AgentActivityStatus,
  AgentActivityType,
  AgentSnapshot,
  AgentStatus,
  AgentDetail,
  AgentInfo,
  CreateTeamPayload,
  DeptTreeNode,
  DirectoriesConfig,
  FrontendConfig,
  FrontendDriverType,
  FrontendModelOption,
  LlmServiceInfo,
  LlmServiceListResponse,
  LlmServiceTestResult,
  MessageInfo,
  RoleTemplateDetail,
  RoleTemplateSummary,
  RoomInfo,
  TeamDetail,
  TeamSummary,
} from './types';
import { showGlobalRequestError } from './appUiState';
import { t } from './i18n';
import type { AppLocale } from './i18n';

type RawRoomInfo = {
  gt_room?: {
    id?: unknown;
    name?: unknown;
    type?: unknown;
    biz_id?: unknown;
    tags?: unknown;
  };
  team_name?: string;
  state?: string;
  need_scheduling?: boolean;
  current_turn_agent?: AgentSnapshot | null;
  agents?: unknown;
};

type RawAgentInfo = Partial<AgentInfo> & {
  employee_number?: number;
  status?: string;
  role_template_id?: number;
  employ_status?: string;
  driver?: string;
  special?: string | null;
};

type RawAgentDetail = Partial<AgentDetail> & {
  employee_number?: number;
  status?: string;
  role_template_id?: number;
  employ_status?: string;
  driver?: string;
};

type RawAgentActivity = Partial<AgentActivity> & {
  id?: unknown;
  agent_id?: unknown;
  team_id?: unknown;
  activity_type?: unknown;
  status?: unknown;
  title?: unknown;
  detail?: unknown;
  error_message?: unknown;
  started_at?: unknown;
  finished_at?: unknown;
  duration_ms?: unknown;
  metadata?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type RawDeptTreeResponse = {
  dept_tree?: DeptTreeNode | null;
};

type RawRoleTemplateSummary = Partial<RoleTemplateSummary> & {
  id?: unknown;
  name?: unknown;
  model?: unknown;
  soul?: unknown;
  type?: string | null;
  allowed_tools?: unknown;
};
type RawFrontendModelOption = Partial<FrontendModelOption>;
type RawFrontendDriverType = Partial<FrontendDriverType>;
type RawFrontendConfig = {
  models?: RawFrontendModelOption[];
  driver_types?: RawFrontendDriverType[];
  default_model?: string | null;
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
  try {
    const response = await fetch(makeUrl(path), {
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });

    if (!response.ok) {
      let errorDetail = '';
      let contentType = '';
      let errorCode = '';

      try {
        contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorBody = await response.json() as {
            error_desc?: unknown;
            error_code?: unknown;
            message?: unknown;
          };
          if (typeof errorBody.error_desc === 'string' && errorBody.error_desc.trim()) {
            errorDetail = errorBody.error_desc.trim();
          } else if (typeof errorBody.message === 'string' && errorBody.message.trim()) {
            errorDetail = errorBody.message.trim();
          } else if (typeof errorBody.error_code === 'string' && errorBody.error_code.trim()) {
            errorDetail = errorBody.error_code.trim();
          }
          if (typeof errorBody.error_code === 'string' && errorBody.error_code.trim()) {
            errorCode = errorBody.error_code.trim();
          }
        } else {
          const errorText = (await response.text()).trim();
          if (errorText) {
            errorDetail = errorText;
          }
        }
      } catch {
        errorDetail = '';
      }

      const isProxyConnectionFailure = errorCode === 'BACKEND_UNAVAILABLE'
        || response.headers.get('x-proxy-error') === 'backend-unavailable';

      if (isProxyConnectionFailure) {
        showGlobalRequestError(t('error.cannotConnect', { path }));
        throw new Error('Backend unavailable');
      }

      const message = errorDetail
        ? t('error.requestFailedDetail', { status: response.status, path, detail: errorDetail })
        : t('error.requestFailed', { status: response.status, path });
      showGlobalRequestError(message);
      throw new Error(
        errorDetail
          ? `Request failed: ${response.status} ${errorDetail}`
          : `Request failed: ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Request failed:')) {
      throw error;
    }

    showGlobalRequestError(t('error.cannotConnect', { path }));
    throw error;
  }
}

function normalizeRoom(room: RawRoomInfo): RoomInfo {
  const gtRoom = room.gt_room;
  const teamName = typeof room.team_name === 'string' ? room.team_name : 'default';
  const roomName = String(gtRoom?.name ?? '');
  const roomType = String(gtRoom?.type ?? 'group').toLowerCase();

  return {
    room_id: Number(gtRoom?.id ?? 0),
    room_name: roomName,
    team_name: teamName,
    room_type: roomType === 'private' ? 'private' : 'group',
    state: (room.state ?? 'idle').toLowerCase(),
    need_scheduling: Boolean(room.need_scheduling),
    agents: Array.isArray(room.agents)
      ? room.agents
        .map((agent) => typeof agent === 'number' ? agent : Number(agent))
        .filter((id) => !Number.isNaN(id) && id !== 0 && id !== -2)
      : [],
    tags: Array.isArray(gtRoom?.tags)
      ? gtRoom.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    biz_id: typeof gtRoom?.biz_id === 'string' && gtRoom.biz_id.trim() ? gtRoom.biz_id : null,
    current_turn_agent: room.current_turn_agent ?? null,
  };
}

function normalizeAgentStatus(status?: string): AgentStatus {
  const normalized = status?.toLowerCase();
  if (normalized === 'active' || normalized === 'failed') {
    return normalized;
  }
  return 'idle';
}

function normalizeActivityType(value?: unknown): AgentActivityType {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'llm_infer' || normalized === 'tool_call' || normalized === 'compact') {
    return normalized;
  }
  return 'agent_state';
}

function normalizeActivityStatus(value?: unknown): AgentActivityStatus {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'started' || normalized === 'succeeded' || normalized === 'failed') {
    return normalized;
  }
  return 'cancelled';
}

function normalizeDriverTypeValue(value?: string | null): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'native' || normalized === 'claude_sdk' || normalized === 'tsp') {
    return normalized;
  }
  return '';
}

function normalizeAgent(agent: RawAgentInfo): AgentInfo {
  const normalizedSpecial = agent.special === 'operator' || agent.special === 'system'
    ? agent.special
    : null;

  return {
    id: typeof agent.id === 'number' ? agent.id : null,
    name: String(agent.name ?? ''),
    employee_number: typeof agent.employee_number === 'number' ? agent.employee_number : null,
    role_template_id: typeof agent.role_template_id === 'number' ? agent.role_template_id : null,
    model: String(agent.model ?? ''),
    team_id: typeof agent.team_id === 'number' ? agent.team_id : null,
    team_name: typeof agent.team_name === 'string' ? agent.team_name : null,
    status: normalizeAgentStatus(agent.status),
    employ_status: agent.employ_status ?? null,
    driver: normalizeDriverTypeValue(typeof agent.driver === 'string' ? agent.driver : ''),
    special: normalizedSpecial,
  };
}

function parseDriverType(detail: RawAgentDetail): string {
  if (detail.driver_type) {
    return normalizeDriverTypeValue(String(detail.driver_type));
  }

  return normalizeDriverTypeValue(typeof detail.driver === 'string' ? detail.driver : '');
}

function normalizeAgentDetail(agent: RawAgentDetail): AgentDetail {
  return {
    ...normalizeAgent(agent),
    agent_name: String(agent.agent_name ?? agent.name ?? ''),
    driver_type: parseDriverType(agent),
    prompt: String(agent.prompt ?? ''),
    error_message: typeof agent.error_message === 'string' ? agent.error_message : null,
  };
}

function normalizeAgentActivity(activity: RawAgentActivity): AgentActivity {
  return {
    id: Number(activity.id ?? 0),
    agent_id: Number(activity.agent_id ?? 0),
    team_id: Number(activity.team_id ?? 0),
    activity_type: normalizeActivityType(activity.activity_type),
    status: normalizeActivityStatus(activity.status),
    title: String(activity.title ?? ''),
    detail: typeof activity.detail === 'string' ? activity.detail : '',
    error_message: typeof activity.error_message === 'string' ? activity.error_message : null,
    started_at: typeof activity.started_at === 'string' ? activity.started_at : null,
    finished_at: typeof activity.finished_at === 'string' ? activity.finished_at : null,
    duration_ms: typeof activity.duration_ms === 'number' ? activity.duration_ms : null,
    metadata: typeof activity.metadata === 'object' && activity.metadata !== null
      ? activity.metadata as Record<string, unknown>
      : {},
    created_at: typeof activity.created_at === 'string' ? activity.created_at : null,
    updated_at: typeof activity.updated_at === 'string' ? activity.updated_at : null,
  };
}

export async function getAgents(): Promise<AgentInfo[]> {
  const data = await requestJson<{ agents: RawAgentInfo[] }>('/agents/list.json');
  return data.agents.map(normalizeAgent);
}

export async function getAgentsByTeamId(teamId: number, options?: { includeSpecial?: boolean }): Promise<AgentInfo[]> {
  const data = await requestJson<{ agents: RawAgentInfo[] }>(
    withSearch('/agents/list.json', {
      team_id: teamId,
      include_special: options?.includeSpecial ? 1 : undefined,
    }),
  );
  return data.agents.map(normalizeAgent);
}

export async function setAgentsByTeamId(
  teamId: number,
  payload: Array<{
    id: number;
    name: string;
    role_template_id: number;
    model: string;
    driver: string;
  }>,
): Promise<{ status: string }> {
  return requestJson(`/teams/${teamId}/agents/batch_update.json`, {
    method: 'PUT',
    body: JSON.stringify({ agents: payload }),
  });
}

export async function saveMembersByTeamId(
  teamId: number,
  payload: Array<{
    id: number | null;
    name: string;
    role_template_id: number;
    model: string;
    driver: string;
  }>,
): Promise<AgentInfo[]> {
  const data = await requestJson<{ agents: RawAgentInfo[] }>(`/teams/${teamId}/agents/save.json`, {
    method: 'PUT',
    body: JSON.stringify({ agents: payload }),
  });
  return data.agents.map(normalizeAgent);
}

export async function getRooms(teamId?: number): Promise<RoomInfo[]> {
  const data = await requestJson<{ rooms: RawRoomInfo[] }>(
    withSearch('/rooms/list.json', { team_id: teamId }),
  );
  return data.rooms.map(normalizeRoom);
}

export async function createTeamRoom(teamId: number, payload: {
  name: string;
  agent_ids: number[];
  initial_topic?: string | null;
  max_turns?: number;
}): Promise<{ status: string; room_name: string }> {
  return requestJson(`/teams/${teamId}/rooms/create.json`, {
    method: 'POST',
    body: JSON.stringify({
      initial_topic: null,
      max_turns: 100,
      ...payload,
    }),
  });
}

export async function getTeams(): Promise<TeamSummary[]> {
  const data = await requestJson<{ teams: TeamSummary[] }>('/teams/list.json');
  return data.teams;
}

export async function getRoleTemplates(): Promise<RoleTemplateSummary[]> {
  const data = await requestJson<{ role_templates: RawRoleTemplateSummary[] }>('/role_templates/list.json');
  return data.role_templates.map((template) => ({
    id: Number(template.id ?? 0),
    name: String(template.name ?? ''),
    model: String(template.model ?? ''),
    soul: String(template.soul ?? ''),
    type: template.type,
  }));
}

export async function getRoleTemplateDetail(templateId: number): Promise<RoleTemplateDetail> {
  const data = await requestJson<RawRoleTemplateSummary>(`/role_templates/${templateId}.json`);
  return {
    id: Number(data.id ?? templateId),
    name: String(data.name ?? ''),
    model: String(data.model ?? ''),
    soul: String(data.soul ?? ''),
    type: data.type,
    allowed_tools: Array.isArray(data.allowed_tools)
      ? data.allowed_tools.map((item) => String(item))
      : null,
  };
}

export async function createRoleTemplate(payload: {
  name: string;
  soul: string;
  model: string;
  allowed_tools: string[] | null;
}): Promise<RoleTemplateDetail> {
  const data = await requestJson<RawRoleTemplateSummary>('/role_templates/create.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    id: Number(data.id ?? 0),
    name: String(data.name ?? ''),
    model: String(data.model ?? ''),
    soul: String(data.soul ?? ''),
    type: data.type,
    allowed_tools: Array.isArray(data.allowed_tools)
      ? data.allowed_tools.map((item) => String(item))
      : null,
  };
}

export async function updateRoleTemplate(templateId: number, payload: {
  name: string;
  soul: string;
  model: string;
  allowed_tools: string[] | null;
}): Promise<RoleTemplateDetail> {
  const data = await requestJson<RawRoleTemplateSummary>(`/role_templates/${templateId}/modify.json`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    id: Number(data.id ?? templateId),
    name: String(data.name ?? ''),
    model: String(data.model ?? ''),
    soul: String(data.soul ?? ''),
    type: data.type,
    allowed_tools: Array.isArray(data.allowed_tools)
      ? data.allowed_tools.map((item) => String(item))
      : null,
  };
}

export async function deleteRoleTemplate(templateId: number): Promise<{ status: string; id: number; name: string }> {
  return requestJson(`/role_templates/${templateId}/delete.json`, {
    method: 'POST',
  });
}

export async function getFrontendConfig(): Promise<FrontendConfig> {
  const data = await requestJson<RawFrontendConfig>('/config/frontend.json');
  return {
    models: (data.models ?? []).map((item) => ({
      name: String(item.name ?? ''),
      model: String(item.model ?? ''),
      enabled: item.enabled !== false,
    })),
    driver_types: (data.driver_types ?? []).map((item) => ({
      name: String(item.name ?? ''),
      description: String(item.description ?? ''),
    })),
    default_model: typeof data.default_model === 'string' && data.default_model.trim()
      ? data.default_model
      : null,
  };
}

export async function getDirectories(): Promise<DirectoriesConfig> {
  return requestJson<DirectoriesConfig>('/config/directories.json');
}

export async function getTeamDetail(teamId: number): Promise<TeamDetail> {
  return requestJson<TeamDetail>(`/teams/${teamId}.json`);
}

export async function getDeptTree(teamId: number): Promise<DeptTreeNode | null> {
  const data = await requestJson<RawDeptTreeResponse>(`/teams/${teamId}/dept_tree.json`);
  return data.dept_tree ?? null;
}

export async function setDeptTree(teamId: number, deptTree: DeptTreeNode): Promise<{ status: string }> {
  return requestJson(`/teams/${teamId}/dept_tree/update.json`, {
    method: 'PUT',
    body: JSON.stringify({ dept_tree: deptTree }),
  });
}

export async function updateTeam(
  teamId: number,
  payload: {
    name?: string;
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

export async function setTeamEnabled(teamId: number, enabled: boolean): Promise<{ status: string; enabled: boolean }> {
  return requestJson(`/teams/${teamId}/set_enabled.json`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

export async function deleteTeam(teamId: number): Promise<{ status: string; name: string }> {
  return requestJson(`/teams/${teamId}/delete.json`, {
    method: 'POST',
  });
}

export async function clearTeamData(teamId: number): Promise<{
  status: string;
  team_id: number;
  deleted: { tasks: number; histories: number; messages: number };
}> {
  return requestJson(`/teams/${teamId}/clear_data.json`, {
    method: 'POST',
  });
}

export async function createTeam(payload: CreateTeamPayload): Promise<{ status: string; id: number; name: string }> {
  return requestJson('/teams/create.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAgentDetail(agentId: number): Promise<AgentDetail> {
  const data = await requestJson<RawAgentDetail>(`/agents/${agentId}.json`);
  return normalizeAgentDetail(data);
}

export async function getAgentActivities(agentId: number): Promise<AgentActivity[]> {
  const data = await requestJson<{ activities: RawAgentActivity[] }>(`/agents/${agentId}/activities.json`);
  return (data.activities ?? []).map(normalizeAgentActivity);
}

export async function resumeAgent(agentId: number): Promise<{ status: string; agent_id: number; room_id: number }> {
  return requestJson(`/agents/${agentId}/resume.json`, {
    method: 'POST',
  });
}

export async function stopAgent(agentId: number): Promise<{ status: string; agent_id: number }> {
  return requestJson(`/agents/${agentId}/stop.json`, {
    method: 'POST',
  });
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

// ── System Status & Quick Init (V13) ──

export interface SystemStatus {
  initialized: boolean;
  default_llm_server?: string;
  message?: string;
  schedule_state?: 'stopped' | 'blocked' | 'running';
}

export async function getSystemStatus(): Promise<SystemStatus> {
  return requestJson<SystemStatus>('/system/status.json');
}

export async function quickInit(payload: {
  base_url: string;
  api_key: string;
  model: string;
  type?: string;
}): Promise<{ status: string; message: string; detail?: { name: string; model: string } }> {
  return requestJson('/config/quick_init.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getLlmServices(): Promise<LlmServiceListResponse> {
  return requestJson<LlmServiceListResponse>('/config/llm_services/list.json');
}

export async function createLlmService(payload: Partial<LlmServiceInfo>): Promise<{ status: string; index: number }> {
  return requestJson('/config/llm_services/create.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function modifyLlmService(index: number, payload: Record<string, unknown>): Promise<{ status: string }> {
  return requestJson(`/config/llm_services/${index}/modify.json`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteLlmService(index: number): Promise<{ status: string; deleted_name: string }> {
  return requestJson(`/config/llm_services/${index}/delete.json`, {
    method: 'POST',
  });
}

export async function setDefaultLlmService(index: number): Promise<{ status: string; default_llm_server: string }> {
  return requestJson(`/config/llm_services/${index}/set_default.json`, {
    method: 'POST',
  });
}

export async function testLlmService(payload: {
  mode: 'saved' | 'temp';
  index?: number;
  base_url?: string;
  api_key?: string;
  type?: string;
  model?: string;
  extra_headers?: Record<string, string>;
}): Promise<LlmServiceTestResult> {
  return requestJson('/config/llm_services/test.json', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function setLanguage(language: AppLocale): Promise<{ language: AppLocale }> {
  return requestJson('/config/language.json', {
    method: 'POST',
    body: JSON.stringify({ language }),
  });
}
