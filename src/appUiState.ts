import { ref } from 'vue';
import type { ConnectionState } from './utils';

export const connectionState = ref<ConnectionState>('connected');
export const reconnectProgress = ref(0);
export const totalMessageCount = ref(0);
export const globalRequestError = ref('');
export const globalSuccessToast = ref('');
let globalSuccessToastTimer: number | null = null;

export function showGlobalRequestError(message: string): void {
  globalRequestError.value = message;
}

export function clearGlobalRequestError(): void {
  globalRequestError.value = '';
}

export function showGlobalSuccessToast(message: string, durationMs = 2400): void {
  globalSuccessToast.value = message;
  if (globalSuccessToastTimer !== null) {
    window.clearTimeout(globalSuccessToastTimer);
  }
  globalSuccessToastTimer = window.setTimeout(() => {
    globalSuccessToast.value = '';
    globalSuccessToastTimer = null;
  }, durationMs);
}

export function clearGlobalSuccessToast(): void {
  globalSuccessToast.value = '';
  if (globalSuccessToastTimer !== null) {
    window.clearTimeout(globalSuccessToastTimer);
    globalSuccessToastTimer = null;
  }
}
