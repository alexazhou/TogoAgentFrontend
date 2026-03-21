<script setup lang="ts">
import type { MessageInfo } from '../types';
import { bubbleSide, formatTime } from '../utils';

defineProps<{
  messages: MessageInfo[];
}>();

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
  if (sender === 'Operator') {
    return '#7f91a4';
  }
  const hash = Array.from(sender).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return NAME_COLORS[hash % NAME_COLORS.length];
}
</script>

<template>
  <div class="message-stream">
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
          <span
            v-if="bubbleSide(message.sender) === 'left'"
            class="sender"
            :style="{ color: senderColor(message.sender) }"
          >
            {{ message.sender }}
          </span>
          <span class="time">{{ formatTime(message.time) }}</span>
          <span
            v-if="bubbleSide(message.sender) === 'right'"
            class="sender"
            :style="{ color: senderColor(message.sender) }"
          >
            {{ message.sender }}
          </span>
        </div>
        <div class="bubble">{{ message.content }}</div>
      </template>
    </div>
  </div>
</template>
