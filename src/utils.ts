import type { MessageInfo, RoomState } from './types';
import { t } from './i18n';

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'waiting_reconnect'
  | 'reconnecting'
  | 'disconnected';
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
  const normalizedSender = sender.trim().toUpperCase();
  if (normalizedSender === 'SYSTEM') {
    return 'center';
  }
  if (normalizedSender === 'OPERATOR') {
    return 'right';
  }
  return 'left';
}

export function formatConnectionState(state: ConnectionState): string {
  if (state === 'connected') {
    return t('connection.connected');
  }
  if (state === 'waiting_reconnect') {
    return t('connection.waitReconnect');
  }
  if (state === 'reconnecting') {
    return t('connection.reconnecting');
  }
  if (state === 'disconnected') {
    return t('connection.disconnected');
  }
  return t('connection.connecting');
}
