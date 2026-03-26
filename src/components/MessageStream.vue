<script setup lang="ts">
import { getAgentAvatarUrl } from '../avatar';
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import type { MessageInfo } from '../types';
import { bubbleSide, formatTime } from '../utils';

const props = defineProps<{
  messages: MessageInfo[];
}>();

const streamRef = useTemplateRef('streamRef');
const hasScrollbar = ref(false);
let resizeObserver: ResizeObserver | null = null;

const NAME_COLORS = [
  '#56d4b0',
  '#7eb8d4',
  '#c4a55a',
  '#d4847e',
  '#b392d4',
  '#8cc152',
  '#4fc1e9',
  '#ffce54',
  '#fc6e51',
  '#ac92ec',
  '#e8a838',
  '#a0d468',
  '#5d9cec',
  '#ed5565',
  '#fb6e52',
];

function senderColor(sender: string): string {
  if (sender.toUpperCase() === 'OPERATOR') {
    return '#7f91a4';
  }
  const hash = Array.from(sender).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return NAME_COLORS[hash % NAME_COLORS.length];
}

function updateScrollbarState(): void {
  const stream = streamRef.value;
  if (!stream) {
    hasScrollbar.value = false;
    return;
  }

  hasScrollbar.value = stream.scrollHeight - stream.clientHeight > 1;
}

watch(
  () => props.messages,
  async () => {
    await nextTick();
    updateScrollbarState();
  },
  { deep: true },
);

onMounted(() => {
  updateScrollbarState();
  if (typeof ResizeObserver === 'undefined' || !streamRef.value) {
    return;
  }

  resizeObserver = new ResizeObserver(() => {
    updateScrollbarState();
  });
  resizeObserver.observe(streamRef.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<template>
  <div ref="streamRef" class="message-stream" :class="{ 'has-scrollbar': hasScrollbar }">
    <div
      v-for="(message, index) in messages"
      :key="`${message.time}-${message.sender}-${index}`"
      class="message-row"
      :class="`side-${bubbleSide(message.sender)}`"
    >
      <template v-if="bubbleSide(message.sender) === 'center'">
        <div class="system-note">{{ message.content }}</div>
      </template>
      <template v-else>
        <div class="message-meta">
          <template v-if="bubbleSide(message.sender) === 'left'">
            <img
              class="sender-avatar"
              :src="getAgentAvatarUrl(message.sender)"
              :alt="`${message.sender} avatar`"
            />
            <span class="sender" :style="{ color: senderColor(message.sender) }">
              {{ message.sender }}
            </span>
          </template>
          <span class="time">{{ formatTime(message.time) }}</span>
          <template v-if="bubbleSide(message.sender) === 'right'">
            <span class="sender" :style="{ color: senderColor(message.sender) }">
              {{ message.sender }}
            </span>
            <img
              class="sender-avatar"
              :src="getAgentAvatarUrl(message.sender)"
              :alt="`${message.sender} avatar`"
            />
          </template>
        </div>
        <div class="bubble">{{ message.content }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.message-stream {
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.message-stream::-webkit-scrollbar {
  width: 10px;
}

.message-stream::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 999px;
}

.message-stream::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 999px;
  border: 2px solid var(--scrollbar-track);
}

.message-stream::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.message-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.message-row.side-left {
  align-items: flex-start;
}

.message-row.side-right {
  align-items: flex-end;
}

.message-stream.has-scrollbar .message-row.side-right {
  padding-right: 6px;
}

.message-row.side-center {
  align-items: center;
}

.message-meta {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--muted);
  font-size: 0.72rem;
  padding: 0 6px;
}

.sender {
  font-weight: 600;
  font-size: 0.84rem;
  line-height: 1;
}

.sender-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--panel-border-strong) 30%, transparent);
  background: color-mix(in srgb, var(--panel-bg-elevated) 84%, var(--panel-border) 16%);
}

.time {
  color: var(--hint-text);
}

.bubble,
.system-note {
  max-width: min(80%, 820px);
  border-radius: 6px;
  padding: 10px 14px;
  line-height: 1.55;
  word-break: break-word;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  font-size: 0.82rem;
}

.bubble {
  background: var(--bubble-left);
}

.side-right .bubble {
  background: var(--bubble-right);
  color: var(--bubble-right-text);
}

.system-note {
  text-align: center;
  color: var(--muted);
  background: transparent;
  padding: 6px 0 10px;
  max-width: 100%;
  line-height: 1.45;
}

@media (max-width: 980px) {
  .bubble,
  .system-note {
    max-width: 100%;
  }
}
</style>
