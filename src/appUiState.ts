import { ref } from 'vue';
import type { ConnectionState } from './utils';

export interface GlobalToastItem {
  id: number;
  message: string;
}

export const connectionState = ref<ConnectionState>('connected');
export const reconnectProgress = ref(0);
export const totalMessageCount = ref(0);
export const globalRequestErrors = ref<GlobalToastItem[]>([]);
export const globalSuccessToasts = ref<GlobalToastItem[]>([]);
export const showQuickInit = ref(false);
export const scheduleState = ref<'stopped' | 'blocked' | 'running' | ''>('');
export const scheduleNotRunningReason = ref('');

type ScheduleStateInput = 'stopped' | 'blocked' | 'running' | 'STOPPED' | 'BLOCKED' | 'RUNNING' | '';

let nextGlobalToastId = 1;
let globalRequestErrorAutoDismissMs: number | null = 5000;
const globalRequestErrorTimers = new Map<number, number>();
const globalSuccessToastTimers = new Map<number, number>();

function removeGlobalRequestError(toastId: number): void {
  globalRequestErrors.value = globalRequestErrors.value.filter((toast) => toast.id !== toastId);
  const timer = globalRequestErrorTimers.get(toastId);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    globalRequestErrorTimers.delete(toastId);
  }
}

function scheduleGlobalRequestErrorRemoval(toastId: number): void {
  const currentTimer = globalRequestErrorTimers.get(toastId);
  if (currentTimer !== undefined) {
    window.clearTimeout(currentTimer);
    globalRequestErrorTimers.delete(toastId);
  }

  if (globalRequestErrorAutoDismissMs === null) {
    return;
  }

  const timer = window.setTimeout(() => {
    removeGlobalRequestError(toastId);
  }, globalRequestErrorAutoDismissMs);
  globalRequestErrorTimers.set(toastId, timer);
}

function removeGlobalSuccessToast(toastId: number): void {
  globalSuccessToasts.value = globalSuccessToasts.value.filter((toast) => toast.id !== toastId);
  const timer = globalSuccessToastTimers.get(toastId);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    globalSuccessToastTimers.delete(toastId);
  }
}

export function showGlobalRequestError(message: string): void {
  const toastId = nextGlobalToastId++;
  globalRequestErrors.value = [...globalRequestErrors.value, { id: toastId, message }];
  scheduleGlobalRequestErrorRemoval(toastId);
}

export function clearGlobalRequestError(toastId?: number): void {
  if (toastId === undefined) {
    globalRequestErrors.value.forEach((toast) => removeGlobalRequestError(toast.id));
    return;
  }
  removeGlobalRequestError(toastId);
}

export function setGlobalRequestErrorAutoDismiss(durationMs: number | null): void {
  globalRequestErrorAutoDismissMs = durationMs;
  globalRequestErrors.value.forEach((toast) => scheduleGlobalRequestErrorRemoval(toast.id));
}

export function showGlobalSuccessToast(message: string, durationMs = 2400): void {
  const toastId = nextGlobalToastId++;
  globalSuccessToasts.value = [...globalSuccessToasts.value, { id: toastId, message }];
  const timer = window.setTimeout(() => {
    removeGlobalSuccessToast(toastId);
  }, durationMs);
  globalSuccessToastTimers.set(toastId, timer);
}

export function clearGlobalSuccessToast(toastId?: number): void {
  if (toastId === undefined) {
    globalSuccessToasts.value.forEach((toast) => removeGlobalSuccessToast(toast.id));
    return;
  }
  removeGlobalSuccessToast(toastId);
}

function normalizeScheduleState(state: ScheduleStateInput): 'stopped' | 'blocked' | 'running' | '' {
  const normalized = String(state).trim().toLowerCase();
  if (normalized === 'stopped' || normalized === 'blocked' || normalized === 'running') {
    return normalized;
  }
  return '';
}

export function updateScheduleState(state: ScheduleStateInput, reason?: string): void {
  scheduleState.value = normalizeScheduleState(state);
  scheduleNotRunningReason.value = reason ?? '';
}
