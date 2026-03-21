import type { AgentInfo, MessageInfo, RoomInfo } from './types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function makeUrl(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
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

export async function getAgents(): Promise<AgentInfo[]> {
  const data = await requestJson<{ agents: AgentInfo[] }>('/agents');
  return data.agents;
}

export async function getRooms(): Promise<RoomInfo[]> {
  const data = await requestJson<{ rooms: RoomInfo[] }>('/rooms');
  return data.rooms;
}

export async function getRoomMessages(roomId: string): Promise<MessageInfo[]> {
  const data = await requestJson<{ messages: MessageInfo[] }>(
    `/rooms/${encodeURIComponent(roomId)}/messages`,
  );
  return data.messages;
}

export async function postRoomMessage(roomId: string, content: string): Promise<void> {
  await requestJson(`/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function createEventsSocket(): WebSocket {
  return new WebSocket(makeWsUrl('/ws/events'));
}
