<script setup lang="ts">
import type { AgentInfo, RoomState } from '../types';
import AgentListSection from './AgentListSection.vue';
import RoomListSection from './RoomListSection.vue';

defineProps<{
  loading: boolean;
  rooms: RoomState[];
  currentRoomId: number | null;
  agents: AgentInfo[];
}>();

const emit = defineEmits<{
  selectRoom: [roomId: number];
  selectAgent: [agentName: string];
}>();
</script>

<template>
  <aside class="sidebar panel">
    <RoomListSection
      :loading="loading"
      :rooms="rooms"
      :current-room-id="currentRoomId"
      @select-room="emit('selectRoom', $event)"
    />
    <AgentListSection :agents="agents" @select-agent="emit('selectAgent', $event)" />
  </aside>
</template>
