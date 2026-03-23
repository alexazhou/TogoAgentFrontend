import { ref } from 'vue';
import type { ConnectionState } from './utils';

export const connectionState = ref<ConnectionState>('connected');
export const reconnectProgress = ref(0);
export const totalMessageCount = ref(0);
