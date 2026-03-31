<script setup lang="ts">
import { getAgentAvatarUrl } from '../avatar';

defineProps<{
  open: boolean;
  roomName: string;
  members: Array<{
    id: number;
    name: string;
    subtitle?: string | null;
    status?: 'active' | 'idle';
  }>;
  selectedMemberIds: number[];
  submitting?: boolean;
  canSubmit?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  submit: [];
  'update:roomName': [value: string];
  toggleMember: [memberId: number];
}>();

function isSelected(memberId: number, selectedMemberIds: number[]): boolean {
  return selectedMemberIds.includes(memberId);
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="create-room-overlay" @click.self="emit('close')">
      <section class="create-room-dialog panel">
        <div class="create-room-head">
          <p class="create-room-eyebrow">Create Room</p>
          <h3>新建聊天室</h3>
        </div>

        <label class="create-room-field">
          <span>房间名称</span>
          <input
            :value="roomName"
            type="text"
            maxlength="64"
            placeholder="例如：项目同步群"
            @input="emit('update:roomName', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <section class="create-room-members">
          <div class="create-room-members-head">
            <span>选择成员</span>
            <small>至少 2 人，已选 {{ selectedMemberIds.length }} 人</small>
          </div>

          <div v-if="members.length" class="create-room-members-grid">
            <button
              v-for="member in members"
              :key="member.id"
              type="button"
              class="create-room-member"
              :class="{ 'is-selected': isSelected(member.id, selectedMemberIds) }"
              @click="emit('toggleMember', member.id)"
            >
              <span v-if="isSelected(member.id, selectedMemberIds)" class="create-room-member-check">✓</span>
              <img
                class="create-room-member-avatar"
                :src="getAgentAvatarUrl(member.name)"
                :alt="`${member.name} avatar`"
              />
              <div class="create-room-member-body">
                <div class="create-room-member-head">
                  <strong>{{ member.name }}</strong>
                </div>
                <p>{{ member.subtitle || '未配置角色' }}</p>
              </div>
            </button>
          </div>

          <div v-else class="create-room-empty">
            当前团队没有可选成员。
          </div>
        </section>

        <div class="create-room-actions">
          <button type="button" class="ghost-button" @click="emit('close')">取消</button>
          <button
            type="button"
            class="secondary-button"
            :disabled="submitting || !canSubmit"
            @click="emit('submit')"
          >
            提交
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.create-room-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(6, 10, 16, 0.52);
  backdrop-filter: blur(8px);
}

.create-room-dialog {
  width: min(560px, 100%);
  max-height: min(720px, calc(100vh - 40px));
  padding: 18px;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr) auto;
  gap: 14px;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 26%, var(--panel-border) 74%);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--panel-bg) 95%, transparent) 0%,
      color-mix(in srgb, var(--surface-soft) 92%, transparent) 100%
    );
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.34);
}

.create-room-head {
  display: grid;
  gap: 4px;
}

.create-room-eyebrow {
  margin: 0;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
}

.create-room-head h3 {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.12rem;
}

.create-room-field {
  display: grid;
  gap: 8px;
}

.create-room-field > span,
.create-room-members-head > span {
  color: var(--muted);
  font-size: 0.74rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.create-room-field input {
  width: 100%;
  height: 38px;
  border: 1px solid color-mix(in srgb, var(--focus-border) 34%, var(--panel-border) 66%);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface-soft) 82%, var(--panel-bg) 18%);
  color: var(--text-strong);
  padding: 0 12px;
  outline: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.create-room-field input:focus {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-border) 14%, transparent);
}

.create-room-members {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
}

.create-room-members-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.create-room-members-head small {
  color: var(--muted);
  font-size: 0.74rem;
}

.create-room-members-grid {
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
  gap: 10px;
  align-content: start;
  padding-top: 3px;
  padding-right: 4px;
  padding-bottom: 3px;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}

.create-room-members-grid::-webkit-scrollbar {
  width: 10px;
}

.create-room-members-grid::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 999px;
}

.create-room-members-grid::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 999px;
  border: 2px solid var(--scrollbar-track);
}

.create-room-member {
  position: relative;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 8px;
  align-items: stretch;
  border: 1px solid color-mix(in srgb, var(--panel-border) 82%, transparent 18%);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-soft) 78%, var(--panel-bg) 22%);
  color: var(--text-strong);
  padding: 10px;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

.create-room-member:hover {
  border-color: color-mix(in srgb, var(--focus-border) 52%, var(--panel-border) 48%);
  transform: translateY(-1px);
}

.create-room-member.is-selected {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 30%, var(--surface-soft) 70%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 28%, transparent);
}

.create-room-member-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.create-room-member-body {
  min-width: 0;
  display: grid;
  align-content: center;
  gap: 6px;
  padding: 2px 2px 2px 0;
}

.create-room-member-head {
  min-width: 0;
}

.create-room-member-avatar {
  width: 48px;
  height: 100%;
  min-height: 48px;
  border-radius: 10px;
  object-fit: cover;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--panel-border-strong) 30%, transparent);
  background: color-mix(in srgb, var(--panel-bg) 82%, var(--surface-soft) 18%);
}

.create-room-member-head strong {
  font-size: 0.88rem;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-room-member p {
  margin: 0;
  color: var(--muted);
  font-size: 0.74rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-room-member-check {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--focus-border) 82%, var(--panel-bg) 18%);
  color: white;
  font-size: 0.78rem;
  line-height: 1;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}

.create-room-empty {
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 0.82rem;
}

.create-room-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.create-room-actions > .ghost-button,
.create-room-actions > .secondary-button {
  min-width: 88px;
  height: 32px;
  padding: 0 14px;
}
</style>
