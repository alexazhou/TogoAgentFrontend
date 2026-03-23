export type AgentStatus = 'active' | 'idle';
export type RoomType = 'private' | 'group';

export interface AgentInfo {
  name: string;
  model: string;
  team_name: string;
  status: AgentStatus;
}

export interface AgentDetail extends AgentInfo {
  driver_type: string;
  prompt: string;
}

export interface RoomInfo {
  room_id: number;
  room_name: string;
  team_name: string;
  room_type: RoomType;
  state: string;
  members: string[];
}

export interface MessageInfo {
  sender: string;
  content: string;
  time: string;
}

export interface WsMessageEvent {
  event: 'message';
  room_id: number;
  room_name: string;
  team_name: string;
  sender: string;
  content: string;
  time: string;
}

export interface WsAgentStatusEvent {
  event: 'agent_status';
  agent_name: string;
  team_name: string;
  status: 'ACTIVE' | 'IDLE';
}

export type WsEvent = WsMessageEvent | WsAgentStatusEvent;

export interface RoomState extends RoomInfo {
  preview: string;
  unread: number;
}

export interface TeamSummary {
  id: number;
  name: string;
  max_function_calls: number | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface TeamRoomDetail {
  id: number;
  name: string;
  initial_topic: string | null;
  max_turns: number;
  members: string[];
}

export interface TeamDetail extends TeamSummary {
  members: string[];
  rooms: TeamRoomDetail[];
}

export interface CreateTeamPayload {
  name: string;
  members: string[];
  preset_rooms: Array<{
    name: string;
    members: string[];
    initial_topic: string;
    max_turns: number;
  }>;
}
