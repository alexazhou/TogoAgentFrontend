import { ref } from 'vue';
import type { ConnectionState } from './utils';

export const connectionState = ref<ConnectionState>('connected');
export const reconnectProgress = ref(0);
export const totalMessageCount = ref(0);
export const globalRequestError = ref('');

export function showGlobalRequestError(message: string): void {
  globalRequestError.value = message;
}

export function clearGlobalRequestError(): void {
  globalRequestError.value = '';
}
