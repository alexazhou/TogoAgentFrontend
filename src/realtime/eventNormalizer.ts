import type {
  AgentActivity,
  AgentActivityStatus,
  AgentActivityType,
  AgentSnapshot,
  AgentStatus,
  MessageInfo,
} from '../types';

export type FrontendRealtimeEvent =
  | {
    type: 'message';
    teamId: number;
    roomId: number;
    roomName: string;
    senderId: number;
    message: MessageInfo;
  }
  | {
    type: 'agent_status';
    teamId: number;
    agentId: number;
    agentName: string;
    status: AgentStatus;
  }
  | {
    type: 'agent_activity';
    agentId: number;
    activity: AgentActivity;
  }
  | {
    type: 'room_status';
    teamId: number;
    roomId: number;
    state: string;
    needScheduler: boolean;
    currentTurnAgent: AgentSnapshot | null;
  }
  | {
    type: 'schedule_state';
    scheduleState: 'stopped' | 'blocked' | 'running';
    notRunningReason: string;
  };

type RawRecord = Record<string, unknown>;

function normalizeEntityI18n(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: Record<string, Record<string, string>> = {};
  for (const [field, rawTextMap] of Object.entries(value as RawRecord)) {
    if (!rawTextMap || typeof rawTextMap !== 'object') {
      continue;
    }

    const textMap: Record<string, string> = {};
    for (const [locale, text] of Object.entries(rawTextMap as RawRecord)) {
      if (typeof text === 'string') {
        textMap[locale] = text;
      }
    }

    normalized[field] = textMap;
  }

  return normalized;
}

function normalizeAgentStatus(value: unknown): AgentStatus {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'active' || normalized === 'failed') {
    return normalized;
  }
  return 'idle';
}

function normalizeActivityType(value: unknown): AgentActivityType {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'llm_infer' || normalized === 'tool_call' || normalized === 'compact') {
    return normalized;
  }
  return 'agent_state';
}

function normalizeActivityStatus(value: unknown): AgentActivityStatus {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'started' || normalized === 'succeeded' || normalized === 'failed') {
    return normalized;
  }
  return 'cancelled';
}

function normalizeAgentSnapshot(value: unknown): AgentSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as RawRecord;
  const id = Number(raw.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    name: String(raw.name ?? ''),
    i18n: normalizeEntityI18n(raw.i18n),
    ...(typeof raw.team_id === 'number' && { team_id: raw.team_id }),
    ...(typeof raw.model === 'string' && { model: raw.model }),
    ...(typeof raw.driver === 'string' && { driver: raw.driver }),
    ...(typeof raw.employ_status === 'string' && { employ_status: raw.employ_status }),
    ...(typeof raw.employee_number === 'number' && { employee_number: raw.employee_number }),
    ...(typeof raw.role_template_id === 'number' && { role_template_id: raw.role_template_id }),
  };
}

function normalizeAgentActivity(value: unknown): AgentActivity | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as RawRecord;
  const agentId = Number(raw.agent_id ?? 0);
  if (!Number.isFinite(agentId) || agentId <= 0) {
    return null;
  }

  return {
    id: Number(raw.id ?? 0),
    agent_id: agentId,
    team_id: Number(raw.team_id ?? 0),
    activity_type: normalizeActivityType(raw.activity_type),
    status: normalizeActivityStatus(raw.status),
    title: String(raw.title ?? ''),
    detail: typeof raw.detail === 'string' ? raw.detail : '',
    error_message: typeof raw.error_message === 'string' ? raw.error_message : null,
    started_at: typeof raw.started_at === 'string' ? raw.started_at : null,
    finished_at: typeof raw.finished_at === 'string' ? raw.finished_at : null,
    duration_ms: typeof raw.duration_ms === 'number' ? raw.duration_ms : null,
    metadata: typeof raw.metadata === 'object' && raw.metadata !== null
      ? raw.metadata as Record<string, unknown>
      : {},
    created_at: typeof raw.created_at === 'string' ? raw.created_at : null,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : null,
  };
}

export function normalizeWsEventPayload(payload: unknown): FrontendRealtimeEvent | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const raw = payload as RawRecord;
  const eventType = String(raw.event ?? '').trim().toLowerCase();

  if (eventType === 'message') {
    const gtRoom = raw.gt_room as RawRecord | undefined;
    const teamId = Number(gtRoom?.team_id ?? 0);
    const roomId = Number(gtRoom?.id ?? 0);
    if (!Number.isFinite(teamId) || !Number.isFinite(roomId) || teamId <= 0 || roomId <= 0) {
      return null;
    }

    return {
      type: 'message',
      teamId,
      roomId,
      roomName: String(gtRoom?.name ?? ''),
      senderId: Number(raw.sender_id ?? 0),
      message: {
        sender_id: Number(raw.sender_id ?? 0),
        content: String(raw.content ?? ''),
        time: String(raw.time ?? ''),
      },
    };
  }

  if (eventType === 'agent_status') {
    const gtAgent = raw.gt_agent as RawRecord | undefined;
    const teamId = Number(gtAgent?.team_id ?? 0);
    const agentId = Number(gtAgent?.id ?? 0);
    if (!Number.isFinite(teamId) || !Number.isFinite(agentId) || teamId <= 0 || agentId <= 0) {
      return null;
    }

    return {
      type: 'agent_status',
      teamId,
      agentId,
      agentName: String(gtAgent?.name ?? ''),
      status: normalizeAgentStatus(raw.status),
    };
  }

  if (eventType === 'agent_activity') {
    const activity = normalizeAgentActivity(raw.activity ?? raw.data);
    if (!activity) {
      return null;
    }

    return {
      type: 'agent_activity',
      agentId: activity.agent_id,
      activity,
    };
  }

  if (eventType === 'room_status') {
    const gtRoom = raw.gt_room as RawRecord | undefined;
    const teamId = Number(gtRoom?.team_id ?? 0);
    const roomId = Number(gtRoom?.id ?? 0);
    if (!Number.isFinite(teamId) || !Number.isFinite(roomId) || teamId <= 0 || roomId <= 0) {
      return null;
    }

    return {
      type: 'room_status',
      teamId,
      roomId,
      state: String(raw.state ?? '').trim().toLowerCase(),
      needScheduler: Boolean(raw.need_scheduling),
      currentTurnAgent: normalizeAgentSnapshot(raw.current_turn_agent),
    };
  }

  if (eventType === 'schedule_state') {
    const scheduleState = String(raw.schedule_state ?? '').trim().toLowerCase();
    if (scheduleState !== 'stopped' && scheduleState !== 'blocked' && scheduleState !== 'running') {
      return null;
    }
    return {
      type: 'schedule_state',
      scheduleState,
      notRunningReason: String(raw.not_running_reason ?? ''),
    };
  }

  return null;
}
