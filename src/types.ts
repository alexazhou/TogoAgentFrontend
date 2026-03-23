export type AgentStatus = 'active' | 'idle';
export type RoomType = 'private' | 'group';

export interface AgentInfo {
  name: string;
  model: string;
  team_name: string;
  status: AgentStatus;
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
  status: 'ACTIVE' | 'IDLE';  // 后端发送大写，前端会转换为小写
}

export type WsEvent = WsMessageEvent | WsAgentStatusEvent;

export interface RoomState extends RoomInfo {
  preview: string;
  unread: number;
}
