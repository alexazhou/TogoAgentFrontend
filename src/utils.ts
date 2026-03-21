import type { MessageInfo, RoomState } from './types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type BubbleSide = 'left' | 'right' | 'center';

export function groupRoomsByTeam(rooms: RoomState[]): Array<[string, RoomState[]]> {
  const map = new Map<string, RoomState[]>();

  for (const room of rooms) {
    const bucket = map.get(room.team_name) ?? [];
    bucket.push(room);
    map.set(room.team_name, bucket);
  }

  return Array.from(map.entries());
}

export function formatPreview(message: Pick<MessageInfo, 'sender' | 'content'>): string {
  return `${message.sender}: ${message.content.replace(/\n/g, ' ')}`;
}

export function formatTime(time: string): string {
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

export function bubbleSide(sender: string): BubbleSide {
  if (sender === 'system') {
    return 'center';
  }
  if (sender === 'Operator') {
    return 'right';
  }
  return 'left';
}

export function formatConnectionState(state: ConnectionState, reconnectAttempt: number): string {
  if (state === 'connected') {
    return '已连接';
  }
  if (state === 'reconnecting') {
    return `重连中 #${reconnectAttempt}`;
  }
  if (state === 'disconnected') {
    return '已断开';
  }
  return '连接中';
}
