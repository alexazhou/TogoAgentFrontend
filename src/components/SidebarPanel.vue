<script setup lang="ts">
import type { AgentInfo, RoomState } from '../types';
import AgentListSection from './AgentListSection.vue';
import RoomListSection from './RoomListSection.vue';

defineProps<{
  loading: boolean;
  groupedRooms: Array<[string, RoomState[]]>;
  currentRoomId: string | null;
  agents: AgentInfo[];
}>();

const emit = defineEmits<{
  selectRoom: [roomId: string];
}>();
</script>

<template>
  <aside class="sidebar panel">
    <RoomListSection
      :loading="loading"
      :grouped-rooms="groupedRooms"
      :current-room-id="currentRoomId"
      @select-room="emit('selectRoom', $event)"
    />
    <AgentListSection :agents="agents" />
  </aside>
</template>
