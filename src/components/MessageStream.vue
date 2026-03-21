<script setup lang="ts">
import type { MessageInfo } from '../types';
import { bubbleSide, formatTime } from '../utils';

defineProps<{
  messages: MessageInfo[];
}>();
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
          <span v-if="bubbleSide(message.sender) === 'left'" class="sender">{{ message.sender }}</span>
          <span class="time">{{ formatTime(message.time) }}</span>
          <span v-if="bubbleSide(message.sender) === 'right'" class="sender">{{ message.sender }}</span>
        </div>
        <div class="bubble">{{ message.content }}</div>
      </template>
    </div>
  </div>
</template>
