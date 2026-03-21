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
const hasBanner = computed(() => Boolean(props.errorMessage || props.reloadingMessages));
</script>

<template>
  <section class="chat panel" :class="{ 'has-banner': hasBanner, 'no-banner': !hasBanner }">
    <div class="chat-head">
      <div>
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

    <form v-if="isPrivateRoom" class="composer active" @submit.prevent="emit('submit')">
      <div class="composer-editor">
        <textarea
          :value="draft"
          placeholder="在此输入消息..."
          rows="2"
          @input="emit('updateDraft', ($event.target as HTMLTextAreaElement).value)"
          @keydown.enter.exact.prevent="emit('submit')"
        ></textarea>
        <div class="composer-foot">
          <span>按 Enter 发送，Shift + Enter 换行</span>
          <button type="submit" :disabled="!draft.trim()">发送</button>
        </div>
      </div>
    </form>

    <div v-else class="composer-hint">{{ composerNotice }}</div>
  </section>
</template>

<style scoped>
.chat {
  display: grid;
  gap: 0;
  padding: 8px 7px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--chat-bg);
}

.chat.has-banner {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
}

.chat.no-banner {
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.chat-head {
  grid-row: 1;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-end;
  padding: 0 2px 8px;
  border-bottom: 1px solid var(--chat-divider);
}

.chat-head h2 {
  margin: 0;
  font-family: 'IBM Plex Sans', 'Noto Sans SC', sans-serif;
  font-weight: 600;
  letter-spacing: 0;
}

.chat-side-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  color: var(--muted);
  font-size: 0.78rem;
}

.banner {
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--banner-bg);
  font-size: 0.78rem;
}

.chat.has-banner .banner {
  grid-row: 2;
  margin-top: 8px;
}

.banner.error {
  background: var(--banner-error-bg);
  color: var(--banner-error-text);
}

.message-viewport {
  min-height: 0;
  overflow: hidden;
}

.chat.has-banner .message-viewport {
  grid-row: 3;
}

.chat.no-banner .message-viewport {
  grid-row: 2;
  margin-top: 2px;
}

.composer {
  background: transparent;
  border-top: 1px solid var(--chat-divider);
  padding: 8px 0 0;
  overflow: hidden;
}

.chat.has-banner .composer {
  grid-row: 4;
}

.chat.no-banner .composer {
  grid-row: 3;
}

.composer-editor {
  background: var(--composer-bg);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--composer-border);
  border-radius: 8px;
  overflow: hidden;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.composer-editor:focus-within {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 1px var(--focus-glow);
}

.composer textarea {
  width: 100%;
  resize: none;
  min-height: 25vh;
  height: 25vh;
  max-height: 25vh;
  border: none;
  border-radius: 0;
  padding: 12px;
  color: inherit;
  background: transparent;
  outline: none;
  font-size: 0.8rem;
  line-height: 1.3;
  display: block;
}

.composer textarea:focus {
  box-shadow: none;
}

.composer textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.composer-foot {
  position: relative;
  display: block;
  margin-top: 0;
  padding: 12px 64px 9px 12px;
  font-size: 0.74rem;
  background: transparent;
}

.composer-foot span {
  display: block;
  color: var(--muted);
  line-height: 1;
}

.composer-hint {
  background: transparent;
  border-top: 1px solid var(--chat-divider);
  color: var(--hint-text);
  text-align: center;
  padding: 3px 8px;
  font-size: 0.74rem;
}

.chat.has-banner .composer-hint {
  grid-row: 4;
}

.chat.no-banner .composer-hint {
  grid-row: 3;
}

.composer button {
  position: absolute;
  right: 9px;
  bottom: 9px;
  border: 0;
  border-radius: 6px;
  padding: 5px 10px;
  background: var(--selected);
  color: var(--text-strong);
  font-weight: 700;
  cursor: pointer;
  font-size: 0.74rem;
}

.composer button:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

@media (max-width: 980px) {
  .chat-head,
  .composer-foot {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
