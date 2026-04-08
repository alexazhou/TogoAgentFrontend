<script setup lang="ts">
import ChatPanel from './ChatPanel.vue';
import type { MessageInfo, RoomMemberProfile, RoomState } from '../types';

defineProps<{
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
</script>

<template>
  <div class="chat-shell">
    <ChatPanel
      :current-room="currentRoom"
      :member-profiles="memberProfiles"
      :messages="messages"
      :error-message="errorMessage"
      :reloading-messages="reloadingMessages"
      :draft="draft"
      :composer-notice="composerNotice"
      @update-draft="emit('updateDraft', $event)"
      @submit="emit('submit')"
    />
  </div>
</template>

<style scoped>
.chat-shell {
  min-height: 0;
  min-width: 0;
  height: 100%;
  display: flex;
}

.chat-shell > * {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 100%;
}
</style>
