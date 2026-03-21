<script setup lang="ts">
import { computed } from 'vue';
import type { MessageInfo, RoomState } from '../types';
import MessageStream from './MessageStream.vue';

const props = defineProps<{
  currentRoom: RoomState | null;
  messages: MessageInfo[];
  errorMessage: string;
  reloadingMessages: boolean;
  draft: string;
  composerNotice: string;
}>();

const emit = defineEmits<{
  updateDraft: [value: string];
  submit: [];
}>();

const isPrivateRoom = computed(() => props.currentRoom?.room_type === 'private');
</script>

<template>
  <section class="chat panel">
    <div class="chat-head">
      <div>
        <p class="eyebrow">当前房间</p>
        <h2>{{ currentRoom?.room_name ?? '暂无房间' }}</h2>
      </div>
      <div class="chat-side-info">
        <span>{{ currentRoom?.team_name ?? '未分组' }}</span>
        <span>{{ currentRoom?.room_type === 'private' ? '可发送消息' : '观察模式' }}</span>
      </div>
    </div>

    <div v-if="errorMessage" class="banner error">{{ errorMessage }}</div>
    <div v-else-if="reloadingMessages" class="banner">正在加载消息…</div>

    <div class="message-viewport">
      <MessageStream :messages="messages" />
    </div>

    <form class="composer" @submit.prevent="emit('submit')">
      <textarea
        :value="draft"
        :disabled="!isPrivateRoom"
        placeholder="在这里输入发给 Agent 的消息…"
        rows="3"
        @input="emit('updateDraft', ($event.target as HTMLTextAreaElement).value)"
        @keydown.enter.exact.prevent="emit('submit')"
      ></textarea>
      <div class="composer-foot">
        <span>{{ composerNotice || '按 Enter 发送，Shift + Enter 换行' }}</span>
        <button type="submit" :disabled="!isPrivateRoom || !draft.trim()">发送</button>
      </div>
    </form>
  </section>
</template>
