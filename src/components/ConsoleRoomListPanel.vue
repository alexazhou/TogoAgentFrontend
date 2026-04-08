<script setup lang="ts">
import RoomListSection from './RoomListSection.vue';
import type { RoomState } from '../types';

defineProps<{
  loading: boolean;
  rooms: RoomState[];
  currentRoomId: number | null;
  createDisabled?: boolean;
}>();

const emit = defineEmits<{
  selectRoom: [roomId: number];
  createRoom: [];
}>();
</script>

<template>
  <div class="console-panel">
    <RoomListSection
      :loading="loading"
      :rooms="rooms"
      :current-room-id="currentRoomId"
      :create-disabled="createDisabled"
      @select-room="emit('selectRoom', $event)"
      @create-room="emit('createRoom')"
    />
  </div>
</template>

<style scoped>
.console-panel {
  min-height: 0;
  min-width: 0;
  display: flex;
}

.console-panel > * {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  height: 100%;
  width: 100%;
}
</style>
