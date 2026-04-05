import { ref } from 'vue';
import type { ConnectionState } from './utils';

export type GlobalToastKind = 'error' | 'success';

export interface GlobalToastItem {
  id: number;
  kind: GlobalToastKind;
  message: string;
}

export const connectionState = ref<ConnectionState>('connected');
export const reconnectProgress = ref(0);
export const totalMessageCount = ref(0);
export const globalToasts = ref<GlobalToastItem[]>([]);

let nextGlobalToastId = 1;
const globalToastTimers = new Map<number, number>();

function removeGlobalToast(toastId: number): void {
  globalToasts.value = globalToasts.value.filter((toast) => toast.id !== toastId);
  const timer = globalToastTimers.get(toastId);
  if (timer !== undefined) {
    window.clearTimeout(timer);
    globalToastTimers.delete(toastId);
  }
}

function pushGlobalToast(kind: GlobalToastKind, message: string, durationMs?: number): number {
  const toastId = nextGlobalToastId++;
  globalToasts.value = [...globalToasts.value, { id: toastId, kind, message }];

  if (durationMs !== undefined) {
    const timer = window.setTimeout(() => {
      removeGlobalToast(toastId);
    }, durationMs);
    globalToastTimers.set(toastId, timer);
  }

  return toastId;
}

export function showGlobalRequestError(message: string): void {
  pushGlobalToast('error', message);
}

export function clearGlobalRequestError(toastId?: number): void {
  if (toastId === undefined) {
    globalToasts.value
      .filter((toast) => toast.kind === 'error')
      .forEach((toast) => removeGlobalToast(toast.id));
    return;
  }
  removeGlobalToast(toastId);
}

export function showGlobalSuccessToast(message: string, durationMs = 2400): void {
  pushGlobalToast('success', message, durationMs);
}

export function clearGlobalSuccessToast(toastId?: number): void {
  if (toastId === undefined) {
    globalToasts.value
      .filter((toast) => toast.kind === 'success')
      .forEach((toast) => removeGlobalToast(toast.id));
    return;
  }
  removeGlobalToast(toastId);
}
