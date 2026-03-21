<script setup lang="ts">
import type { RoomState } from '../types';

defineProps<{
  loading: boolean;
  groupedRooms: Array<[string, RoomState[]]>;
  currentRoomId: string | null;
}>();

const emit = defineEmits<{
  selectRoom: [roomId: string];
}>();
</script>

<template>
  <section class="sidebar-block">
    <div class="block-head">
      <h2>聊天室</h2>
      <span>
        {{ loading ? 0 : groupedRooms.reduce((count, [, teamRooms]) => count + teamRooms.length, 0) }}
      </span>
    </div>

    <div class="sidebar-scroll">
      <div v-if="loading" class="placeholder">正在同步房间列表…</div>

      <template v-else>
        <div v-for="[teamName, teamRooms] in groupedRooms" :key="teamName" class="team-group">
          <div class="team-name">{{ teamName }}</div>
          <button
            v-for="room in teamRooms"
            :key="room.room_id"
            class="room-card"
            :class="{ selected: room.room_id === currentRoomId }"
            type="button"
            @click="emit('selectRoom', room.room_id)"
          >
            <div class="room-head">
              <div class="room-title">
                <span class="room-icon">{{ room.room_type === 'private' ? '单' : '群' }}</span>
                <strong>{{ room.room_name }}</strong>
              </div>
              <span v-if="room.unread > 0" class="unread-badge">{{ room.unread }}</span>
            </div>
            <div class="room-meta">{{ room.members.length }} 人 · {{ room.state }}</div>
            <p class="room-preview">{{ room.preview }}</p>
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
