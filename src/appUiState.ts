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

let nextGlobalToastId = 1;
const globalSuccessToastTimers = new Map<number, number>();

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
}

export function clearGlobalRequestError(toastId?: number): void {
  if (toastId === undefined) {
    globalRequestErrors.value = [];
    return;
  }
  globalRequestErrors.value = globalRequestErrors.value.filter((toast) => toast.id !== toastId);
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
