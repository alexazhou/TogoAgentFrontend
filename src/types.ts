export type AgentStatus = 'active' | 'idle';
export type RoomType = 'private' | 'group';

export interface AgentInfo {
  id?: number | null;
  name: string;
  employee_number?: number | null;
  role_template_id?: number | null;
  model: string;
  team_name: string;
  status: AgentStatus;
  employ_status?: string | null;
  driver?: string;
}

export interface AgentDetail extends AgentInfo {
  agent_name: string;
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
  room_key: string;
  room_name: string;
  team_name: string;
  sender: string;
  content: string;
  time: string;
}

export interface WsAgentStatusEvent {
  event: 'member_status';
  member_name: string;
  team_name: string;
  status: 'ACTIVE' | 'IDLE';
}

export type WsEvent = WsMessageEvent | WsAgentStatusEvent;

export interface RoomState extends RoomInfo {
  preview: string;
  unread: number;
}

export interface RoomMemberProfile {
  name: string;
  employee_number: number | null;
  role_template_name: string | null;
}

export interface TeamSummary {
  id: number;
  name: string;
  working_directory: string;
  config: Record<string, unknown>;
  max_function_calls: number | null;
  enabled: boolean;
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

export interface DeptTreeNode {
  dept_name: string;
  dept_responsibility: string;
  manager: string;
  members: string[];
  children: DeptTreeNode[];
}

export interface FrontendModelOption {
  name: string;
  model: string;
  enabled: boolean;
}

export interface FrontendDriverType {
  name: string;
  description: string;
}

export interface FrontendConfig {
  models: FrontendModelOption[];
  driver_types: FrontendDriverType[];
  default_model: string | null;
}

export interface DirectoriesConfig {
  config_dir: string;
  workspace_dir: string;
  data_dir: string;
  log_dir: string;
}

export interface TeamDetail extends TeamSummary {
  members: TeamMember[];
  rooms: TeamRoomDetail[];
}

export interface TeamMember {
  name: string;
  role_template_id: number;
}

export interface CreateTeamPayload {
  name: string;
  working_directory: string;
  config: Record<string, unknown>;
  members: Array<{
    name: string;
    role_template: string;
  }>;
  preset_rooms: Array<{
    name: string;
    members: string[];
    initial_topic: string;
    max_turns: number;
  }>;
}

export interface RoleTemplateSummary {
  id: number;
  name: string;
  model: string;
  prompt?: string;
  type?: string | null;
  driver?: string | null;
}

export interface RoleTemplateDetail extends RoleTemplateSummary {
  prompt: string;
  allowed_tools: string[] | null;
}
