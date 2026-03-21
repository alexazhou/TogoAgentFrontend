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
  <section class="sidebar-card panel">
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
          <div v-if="teamName !== 'default'" class="team-name">{{ teamName }}</div>
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
                <span
                  class="room-icon"
                  :class="room.room_type === 'private' ? 'room-icon-private' : 'room-icon-group'"
                >
                  {{ room.room_type === 'private' ? '单' : '群' }}
                </span>
                <strong>{{ room.room_name }}</strong>
                <span v-if="room.unread > 0" class="unread-inline active">{{ room.unread }}</span>
              </div>
              <div class="room-head-right">
                <div class="room-meta">{{ room.members.length }} 人</div>
              </div>
            </div>
            <p class="room-preview">{{ room.preview }}</p>
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.team-group + .team-group {
  margin-top: 8px;
}

.team-name {
  display: inline-flex;
  margin-bottom: 4px;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--pill-bg);
  color: var(--muted);
  font-size: 0.7rem;
}

.room-card {
  width: 100%;
  display: block;
  padding: 8px 10px;
  border: 1px solid var(--panel-border-strong);
  border-radius: 8px;
  background: var(--surface-soft);
  color: inherit;
  text-align: left;
  transition:
    border-color 120ms ease,
    background 120ms ease;
  cursor: pointer;
}

.room-card + .room-card {
  margin-top: 4px;
}

.room-card:hover,
.room-card.selected {
  border-color: var(--focus-border);
  background: var(--selected);
}

.room-head {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: flex-start;
}

.room-title {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.room-title strong {
  font-size: 0.88rem;
  line-height: 1.15;
  color: var(--room-title-text);
}

.room-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 0.72rem;
  line-height: 1;
  padding-top: 0.5px;
  flex: 0 0 auto;
}

.room-icon-private {
  border: 1px solid var(--room-private-border);
  background: var(--room-private-bg);
  color: var(--room-private-text);
}

.room-icon-group {
  border: 1px solid var(--room-group-border);
  background: var(--room-group-bg);
  color: var(--room-group-text);
}

.unread-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 15px;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--unread-bg);
  color: var(--unread-text);
  font-size: 0.66rem;
  font-weight: 600;
  line-height: 1;
  align-self: center;
}

.room-head-right {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
  flex: 0 0 auto;
}

.room-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.72rem;
  white-space: nowrap;
}

.room-preview {
  margin: 2px 0 0;
  color: var(--muted);
  line-height: 1.15;
  font-size: 0.74rem;
  transform: translateY(2px);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.placeholder {
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 0.78rem;
}
</style>
