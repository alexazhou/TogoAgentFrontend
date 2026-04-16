<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { connectionState } from '../appUiState';
import AgentActivityDialog from '../components/agent/AgentActivityDialog.vue';
import ConsoleAgentListPanel from '../components/console/ConsoleAgentListPanel.vue';
import ConsoleChatPanel from '../components/console/ConsoleChatPanel.vue';
import ConsoleRoomListPanel from '../components/console/ConsoleRoomListPanel.vue';
import CreateRoomDialog from '../components/console/CreateRoomDialog.vue';
import { useAgentActivityDialogState } from '../composables/useAgentActivityDialogState';
import { useConsoleRuntimeState } from '../composables/useConsoleRuntimeState';
import { useConsoleSidebarLayout } from '../composables/useConsoleSidebarLayout';
import { loadDeptTree, loadRoleTemplates } from '../realtime/runtimeStore';
import { useDeptTree, useRoleTemplates } from '../realtime/selectors';
import { findTeamById } from '../teamStore';

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const reloadingMessages = ref(false);
const errorMessage = ref('');
const createRoomDialogOpen = ref(false);
const leftStack = useTemplateRef('leftStack');

const teamId = computed(() => Number(route.params.teamId));
const routeRoomId = computed<number | null>(() => {
  const raw = route.params.roomId;
  if (typeof raw !== 'string') {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
});
const currentTeam = computed(() => findTeamById(teamId.value));
async function navigateToRoom(roomId: number, replace = false): Promise<void> {
  const method = replace ? router.replace : router.push;
  await method({
    name: 'console',
    params: { teamId: teamId.value, roomId },
  });
}

const {
  agents,
  currentRoom,
  messages,
  rooms,
  selectedRoomId,
  clearSelectedRoom,
  refreshRuntimeState,
  loadRoomMessages: loadRuntimeRoomMessages,
  clearRuntimeContext,
} = useConsoleRuntimeState({
  teamId,
  routeRoomId,
  navigateToRoom,
});
const deptTree = useDeptTree(teamId);
const roleTemplates = useRoleTemplates();
const {
  leftStackStyle,
  sidebarDividerDragging,
  startSidebarResize,
} = useConsoleSidebarLayout(leftStack);
const {
  open: agentDetailOpen,
  selectedAgentId,
  selectedAgentName,
  selectedAgentStatus,
  selectedAgentTemplateName,
  openAgent,
  closeAgentDetail,
} = useAgentActivityDialogState(agents, roleTemplates);

async function loadRoomMessages(
  roomId: number,
  options?: { force?: boolean; replaceRoute?: boolean; syncRoute?: boolean },
): Promise<void> {
  if (!options?.force && selectedRoomId.value === roomId) {
    return;
  }

  reloadingMessages.value = true;
  errorMessage.value = '';

  try {
    await loadRuntimeRoomMessages(roomId, options);
  } catch (error) {
    errorMessage.value = '加载消息失败，请检查网络或后端状态。';
    console.error(error);
  } finally {
    reloadingMessages.value = false;
  }
}

async function refreshAll(): Promise<void> {
  if (!currentTeam.value) {
    return;
  }

  loading.value = true;
  errorMessage.value = '';

  try {
    const [{ rooms: nextRooms }] = await Promise.all([
      refreshRuntimeState(),
      loadRoleTemplates(),
      loadDeptTree(teamId.value),
    ]);

    const fallbackRoomId = nextRooms[0]?.room_id ?? null;
    const targetRoomId =
      routeRoomId.value && nextRooms.some((room) => room.room_id === routeRoomId.value)
        ? routeRoomId.value
        : fallbackRoomId;

    if (targetRoomId !== null) {
      await loadRoomMessages(targetRoomId, {
        force: true,
        replaceRoute: routeRoomId.value !== targetRoomId,
        syncRoute: true,
      });
    } else {
      clearSelectedRoom();
    }
  } catch (error) {
    errorMessage.value = '无法连接到后端服务，请确认服务已启动。';
    console.error(error);
  } finally {
    loading.value = false;
  }
}

function openCreateRoomDialog(): void {
  if (loading.value || !currentTeam.value) {
    return;
  }
  createRoomDialogOpen.value = true;
}

function closeCreateRoomDialog(): void {
  createRoomDialogOpen.value = false;
}

watch(
  () => currentTeam.value?.name,
  (teamName, previousTeamName) => {
    if (!teamName || teamName === previousTeamName) {
      return;
    }
    refreshAll().catch(console.error);
  },
);

watch(
  () => routeRoomId.value,
  (roomId) => {
    if (roomId === null || roomId === selectedRoomId.value) {
      return;
    }
    if (!rooms.value.some((room) => room.room_id === roomId)) {
      return;
    }
    loadRoomMessages(roomId, { force: true, syncRoute: false }).catch(console.error);
  },
);

watch(
  () => connectionState.value,
  (state, previousState) => {
    if (
      !currentTeam.value
      || state !== 'connected'
      || previousState === 'connected'
      || previousState === 'connecting'
    ) {
      return;
    }
    refreshAll().catch(console.error);
  },
);

onMounted(async () => {
  if (currentTeam.value) {
    await refreshAll();
  }
});

onBeforeUnmount(() => {
  clearRuntimeContext();
});
</script>

<template>
  <div class="workspace-grid">
    <div ref="leftStack" class="left-stack" :style="leftStackStyle">
      <ConsoleRoomListPanel
        :team-id="teamId"
        :loading="loading"
        :current-room-id="selectedRoomId"
        @select-room="loadRoomMessages($event, { force: true })"
        @create-room="openCreateRoomDialog"
      />

      <button
        type="button"
        class="left-stack-splitter"
        :class="{ dragging: sidebarDividerDragging }"
        aria-label="调整聊天室和成员卡片高度"
        @pointerdown="startSidebarResize"
      >
        <span class="splitter-grip"></span>
      </button>

      <ConsoleAgentListPanel :team-id="teamId" @select-agent="openAgent" />
    </div>

    <div class="chat-pane">
      <ConsoleChatPanel
        :current-room="currentRoom"
        :agents="agents"
        :dept-tree="deptTree"
        :role-templates="roleTemplates"
        :messages="messages"
        :error-message="errorMessage"
        :reloading-messages="reloadingMessages"
        :team-enabled="currentTeam?.enabled ?? true"
        @update-error="errorMessage = $event"
        @click-working-agent="openAgent"
      />
    </div>

    <CreateRoomDialog :open="createRoomDialogOpen" @close="closeCreateRoomDialog" />

    <AgentActivityDialog
      :open="agentDetailOpen"
      :agent-id="selectedAgentId"
      :agent-name="selectedAgentName"
      :agent-status="selectedAgentStatus"
      :role-template-name="selectedAgentTemplateName"
      @close="closeAgentDetail"
    />
  </div>
</template>

<style scoped>
.workspace-grid {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 8px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.left-stack {
  display: grid;
  min-height: 0;
  min-width: 0;
}

.left-stack-splitter {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: row-resize;
  touch-action: none;
}

.splitter-grip {
  width: 100%;
  height: 2px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel-border) 55%, transparent);
  opacity: 0;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.left-stack-splitter:hover .splitter-grip {
  opacity: 0;
}

.left-stack-splitter.dragging .splitter-grip {
  opacity: 0.22;
  transform: scaleY(1.2);
}

.chat-pane {
  min-height: 0;
  min-width: 0;
  height: 100%;
  display: flex;
  overflow: hidden;
}

@media (max-width: 980px) {
  .workspace-grid {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(280px, 38vh) minmax(0, 1fr);
  }

  .left-stack {
    min-height: 0;
  }
}
</style>
