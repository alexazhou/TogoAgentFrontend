<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { getAgentAvatarUrl } from '../avatar';
import type { MessageInfo, RoomMemberProfile, RoomState } from '../types';
import MessageStream from './MessageStream.vue';

const props = defineProps<{
  currentRoom: RoomState | null;
  memberProfiles: RoomMemberProfile[];
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
const membersOpen = ref(false);
const currentMembers = computed(() => props.memberProfiles);

const isScheduling = computed(() => props.currentRoom?.state === 'scheduling');
const currentSpeaker = computed(() => props.currentRoom?.current_turn_agent?.name ?? null);

watch(
  () => props.currentRoom?.room_id ?? null,
  () => {
    membersOpen.value = false;
  },
);

function toggleMembers(): void {
  if (!props.currentRoom) {
    return;
  }
  membersOpen.value = !membersOpen.value;
}

function closeMembers(): void {
  membersOpen.value = false;
}

function handleEnterKey(e: KeyboardEvent): void {
  if (e.isComposing) return;
  e.preventDefault();
  emit('submit');
}
</script>

<template>
  <section class="chat panel" :class="{ 'has-banner': hasBanner, 'no-banner': !hasBanner }">
    <div class="chat-head">
      <div class="chat-head-title">
        <h2>{{ currentRoom?.room_name ?? '暂无房间' }}</h2>
      </div>
      <div class="chat-side-info">
        <template v-if="currentRoom">
          <span
            class="chat-head-pill"
            :class="isScheduling ? 'chat-head-pill-scheduling' : 'chat-head-pill-idle'"
            :data-tooltip="isScheduling && currentSpeaker ? `等待 ${currentSpeaker} 发言` : ''"
          >
            {{ isScheduling ? '活跃中' : '空闲' }}
          </span>
        </template>
        <button
          type="button"
          class="chat-members-button"
          :disabled="!currentRoom"
          @click="toggleMembers"
        >
          成员{{ currentMembers.length }}
        </button>
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
          @keydown.enter.exact="handleEnterKey"
        ></textarea>
        <div class="composer-foot">
          <span>按 Enter 发送，Shift + Enter 换行</span>
          <button type="submit" :disabled="!draft.trim()">发送</button>
        </div>
      </div>
    </form>

    <div v-else-if="composerNotice" class="composer-hint">{{ composerNotice }}</div>

    <Teleport to="body">
      <div v-if="membersOpen" class="chat-members-modal" @click.self="closeMembers">
        <section class="chat-members-dialog">
          <div class="chat-members-dialog__head">
            <div>
              <p class="chat-members-dialog__eyebrow">Room Members</p>
              <h3>房间成员</h3>
            </div>
            <div class="chat-members-dialog__actions">
              <span>{{ currentMembers.length }} 人</span>
              <button type="button" class="chat-members-dialog__close" @click="closeMembers">关闭</button>
            </div>
          </div>

          <div v-if="currentMembers.length" class="chat-members-grid">
            <article v-for="member in currentMembers" :key="member.name" class="chat-member-card">
              <span v-if="member.employee_number !== null" class="chat-member-card__employee">#{{ member.employee_number }}</span>
              <div class="chat-member-card__avatar-wrap">
                <span v-if="member.is_leader" class="chat-member-card__leader-flag">Leader</span>
                <img class="chat-member-card__avatar" :src="getAgentAvatarUrl(member.name)" :alt="`${member.name} avatar`" />
              </div>
              <strong>{{ member.name }}</strong>
              <span v-if="member.role_template_name" class="chat-member-card__meta">{{ member.role_template_name }}</span>
            </article>
          </div>
          <p v-else class="chat-members-empty">当前房间没有成员。</p>
        </section>
      </div>
    </Teleport>
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
  align-items: center;
  padding: 0 2px 8px;
  border-bottom: 1px solid var(--chat-divider);
}

.chat-head h2 {
  margin: 0;
  font-family: 'IBM Plex Sans', 'Noto Sans SC', sans-serif;
  font-weight: 600;
  letter-spacing: 0;
}

.chat-head-title {
  display: flex;
  align-items: center;
}

.chat-side-info {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  margin-left: auto;
}

.chat-head-pill,
.chat-members-button {
  border: 1px solid var(--panel-border);
  background: color-mix(in srgb, var(--panel-bg) 88%, var(--surface-soft) 12%);
  color: var(--muted);
  font-size: 0.76rem;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.chat-head-pill {
  position: relative;
  min-height: 28px;
  padding: 4px 12px 2px;
  border-radius: 8px;
  font-weight: 600;
}

.chat-head-pill-scheduling {
  color: #3fb950;
  border-color: color-mix(in srgb, #3fb950 35%, var(--panel-border) 65%);
  background: color-mix(in srgb, #3fb950 14%, var(--panel-bg) 86%);
}

.chat-head-pill-idle {
  color: var(--muted);
}

.chat-head-pill[data-tooltip]:not([data-tooltip=''])::after {
  content: attr(data-tooltip);
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  padding: 6px 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-soft) 78%, var(--panel-bg) 22%);
  border: 1px solid var(--panel-border);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
  color: var(--text-strong);
  font-size: 0.72rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(-4px);
  pointer-events: none;
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.chat-head-pill[data-tooltip]:not([data-tooltip='']):hover::after {
  opacity: 1;
  transform: translateY(0);
}

.chat-members-button {
  min-height: 28px;
  padding: 4px 12px 2px;
  border-radius: 8px;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    color 140ms ease;
}

.chat-members-button:hover:not(:disabled) {
  border-color: var(--focus-border);
  color: var(--text-strong);
  background: color-mix(in srgb, var(--selected) 58%, var(--panel-bg) 42%);
}

.chat-members-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.chat-members-modal {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(6, 10, 16, 0.42);
  backdrop-filter: blur(6px);
}

.chat-members-dialog {
  width: min(860px, 100%);
  max-height: min(720px, calc(100vh - 48px));
  overflow: auto;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 20%, var(--panel-border) 80%);
  border-radius: 20px;
  background: color-mix(in srgb, var(--panel-bg) 97%, var(--surface-soft) 3%);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
}

.chat-members-dialog__head,
.chat-members-dialog__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chat-members-dialog__head {
  margin-bottom: 16px;
}

.chat-members-dialog__eyebrow {
  margin: 0 0 4px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
}

.chat-members-dialog__head h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.15rem;
}

.chat-members-dialog__actions span,
.chat-members-empty {
  color: var(--muted);
  font-size: 0.74rem;
}

.chat-members-dialog__close {
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 0.76rem;
  line-height: 1;
  padding: 7px 12px;
  cursor: pointer;
}

.chat-members-dialog__close:hover {
  border-color: var(--focus-border);
  color: var(--text-strong);
}

.chat-members-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.chat-member-card {
  position: relative;
  padding: 12px 8px 10px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 10%, var(--panel-border) 90%);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-soft) 80%, var(--panel-bg) 20%);
  display: grid;
  justify-items: center;
  gap: 8px;
  text-align: center;
}

.chat-member-card__employee {
  position: absolute;
  top: 8px;
  left: 8px;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1;
  letter-spacing: 0.04em;
}

.chat-member-card__avatar-wrap {
  position: relative;
  padding-top: 14px;
}

.chat-member-card__leader-flag {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translate(-50%, -30%);
  color: #5f87ab;
  font-size: 0.72rem;
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.03em;
  white-space: nowrap;
}

.chat-member-card__avatar {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 22%, var(--panel-border) 78%);
  object-fit: cover;
  background: color-mix(in srgb, var(--surface-soft) 76%, var(--panel-bg) 24%);
}

.chat-member-card strong {
  color: var(--text-strong);
  font-size: 0.78rem;
  line-height: 1.25;
  word-break: break-word;
}

.chat-member-card__meta {
  color: var(--muted);
  font-size: 0.76rem;
  line-height: 1.25;
  word-break: break-word;
}

.chat-members-empty {
  margin: 0;
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

  .chat-members-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .chat-members-modal {
    padding: 14px;
  }

  .chat-members-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
