<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { totalMessageCount } from '../appUiState';
import { createTeam, getAgents } from '../api';
import { loadTeams, teams } from '../teamStore';
import type { AgentInfo } from '../types';

const router = useRouter();

const name = ref('');
const workingDirectory = ref('');
const availableAgents = ref<string[]>([]);
const selectedAgents = ref<string[]>([]);
const keyword = ref('');
const submitting = ref(false);
const errorMessage = ref('');

const canSubmit = computed(
  () => name.value.trim().length > 0 && selectedAgents.value.length > 0 && !submitting.value,
);
const filteredAgents = computed(() => {
  const search = keyword.value.trim().toLowerCase();
  if (!search) {
    return availableAgents.value;
  }

  return availableAgents.value.filter((agentName) => agentName.toLowerCase().includes(search));
});
const visibleMemberSlots = computed(() => {
  const members = selectedAgents.value.map((agentName) => ({
    name: agentName,
    agent: agentName,
  }));

  while (members.length < 4) {
    members.push({ name: '', agent: '' });
  }

  return members.slice(0, 4);
});

function toggleAgent(agentName: string): void {
  if (selectedAgents.value.includes(agentName)) {
    selectedAgents.value = selectedAgents.value.filter((item) => item !== agentName);
    return;
  }
  selectedAgents.value = [...selectedAgents.value, agentName];
}

async function loadAvailableAgents(): Promise<void> {
  const runtimeAgents = await getAgents();
  const unique = new Set<string>();
  runtimeAgents.forEach((agent: AgentInfo) => unique.add(agent.template_name || agent.name));
  availableAgents.value = Array.from(unique).sort((left, right) => left.localeCompare(right));
}

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value) {
    return;
  }

  submitting.value = true;
  errorMessage.value = '';

  try {
    await createTeam({
      name: name.value.trim(),
      working_directory: workingDirectory.value.trim(),
      members: selectedAgents.value.map((agentName) => ({
        name: agentName,
        agent: agentName,
      })),
      preset_rooms: [
        {
          name: '团队群聊',
          members: selectedAgents.value,
          initial_topic: '请团队成员先完成自我介绍，并开始围绕共同任务协作。',
          max_turns: 100,
        },
      ],
    });
    await loadTeams();
    const createdTeam = teams.value.find((team) => team.name === name.value.trim());
    if (createdTeam) {
      router.push({ name: 'console', params: { teamId: createdTeam.id } }).catch(console.error);
    }
  } catch (error) {
    errorMessage.value = '创建团队失败，请检查名称是否重复。';
    console.error(error);
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  totalMessageCount.value = 0;
  loadAvailableAgents().catch(console.error);
});
</script>

<template>
  <section class="page panel">
    <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

    <form class="form-grid" @submit.prevent="handleSubmit">
      <label class="name-panel">
        <span class="panel-label">团队名称</span>
        <input v-model="name" type="text" placeholder="例如：alpha-delivery" />
        <span class="panel-label">工作目录</span>
        <input v-model="workingDirectory" type="text" placeholder="例如：/workspace/alpha-delivery" />
      </label>

      <section class="member-panel">
        <div class="member-panel-head">
          <span class="panel-label">团队成员</span>
        </div>

        <div class="member-graph">
          <div class="team-root">
            <span>{{ name.trim() || '团队' }}</span>
          </div>

          <div class="member-rail" aria-hidden="true"></div>

          <div class="member-slots">
            <button
              v-for="member in visibleMemberSlots"
              :key="member.name || `empty-${visibleMemberSlots.indexOf(member)}`"
              class="member-node"
              :class="{ 'is-empty': !member.name }"
              type="button"
              @click="member.name && toggleAgent(member.name)"
            >
              <span>{{ member.name || '+' }}</span>
              <small v-if="member.name">{{ member.agent }}</small>
            </button>
          </div>
        </div>

        <div class="member-actions">
          <button type="button" class="action-button secondary-button" @click="$router.back()">取消</button>
          <button class="action-button primary-button" type="submit" :disabled="!canSubmit">
            {{ submitting ? '创建中…' : '创建' }}
          </button>
        </div>
      </section>

      <section class="library-panel">
        <div class="library-head">
          <span class="panel-label">备选Agent</span>
          <label class="search-box">
            <span>关键词搜索</span>
            <input v-model="keyword" type="text" placeholder="搜索 agent 名称" />
          </label>
        </div>

        <div class="agent-grid">
          <button
            v-for="agentName in filteredAgents"
            :key="agentName"
            class="agent-tile"
            :class="{ selected: selectedAgents.includes(agentName) }"
            type="button"
            @click="toggleAgent(agentName)"
          >
            <span class="agent-avatar">{{ agentName.slice(0, 1).toUpperCase() }}</span>
            <strong>{{ agentName }}</strong>
          </button>
        </div>

        <p class="library-note">
          选择的 Agent 会作为团队成员加入默认群聊 `团队群聊`，再次点击可移除。
        </p>
      </section>
    </form>
  </section>
</template>

<style scoped>
.page {
  height: 100%;
  overflow: auto;
  padding: 26px;
}

.form-grid {
  display: grid;
  gap: 18px;
  max-width: 1040px;
  margin: 0 auto;
}

.panel-label {
  color: var(--text-strong);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.name-panel,
.member-panel,
.library-panel {
  display: grid;
  gap: 14px;
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--panel-bg) 92%, white 8%) 0%, var(--panel-bg) 100%);
  box-shadow: 0 10px 26px color-mix(in srgb, var(--panel-shadow, rgba(0, 0, 0, 0.14)) 80%, transparent);
  padding: 18px 20px;
}

.name-panel input,
.search-box input {
  height: 44px;
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--surface-soft) 80%, transparent);
  color: var(--text-strong);
  padding: 0 14px;
  outline: none;
  box-shadow: none;
  font-size: 1rem;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.name-panel input:focus,
.search-box input:focus {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-border) 18%, transparent);
  background: var(--panel-bg);
}

.member-panel-head,
.member-actions,
.library-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.member-panel-head {
  margin-bottom: 4px;
}

.member-graph {
  position: relative;
  min-height: 260px;
  border: 1px solid var(--panel-border);
  border-radius: 18px;
  background:
    radial-gradient(circle at top, color-mix(in srgb, var(--selected) 40%, transparent) 0%, transparent 62%),
    color-mix(in srgb, var(--surface-soft) 72%, transparent);
  padding: 24px 18px 18px;
}

.team-root {
  width: 90px;
  height: 70px;
  margin: 0 auto;
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8px;
  color: var(--text-strong);
  background: var(--panel-bg);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--panel-shadow, rgba(0, 0, 0, 0.12)) 55%, transparent);
}

.member-rail {
  position: absolute;
  left: 50%;
  top: 93px;
  width: min(72%, 560px);
  height: 48px;
  transform: translateX(-50%);
  border-top: 1px solid color-mix(in srgb, var(--panel-border-strong) 78%, transparent);
}

.member-rail::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -32px;
  width: 1px;
  height: 32px;
  background: color-mix(in srgb, var(--panel-border-strong) 78%, transparent);
}

.member-slots {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  margin-top: 102px;
}

.member-node {
  position: relative;
  min-height: 96px;
  border: 1px solid var(--panel-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--panel-bg) 82%, var(--surface-soft) 18%);
  color: var(--text-strong);
  display: grid;
  place-items: center;
  gap: 2px;
  padding: 10px;
  text-align: center;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.member-node::before {
  content: '';
  position: absolute;
  top: -32px;
  left: 50%;
  width: 1px;
  height: 32px;
  transform: translateX(-50%);
  background: color-mix(in srgb, var(--panel-border-strong) 78%, transparent);
}

.member-node.is-empty {
  color: var(--muted);
  cursor: default;
  background: color-mix(in srgb, var(--surface-soft) 58%, transparent);
  border-style: dashed;
}

.member-node span {
  font-weight: 600;
}

.member-node small {
  color: var(--muted);
  font-size: 0.76rem;
}

.member-node:not(.is-empty):hover {
  transform: translateY(-2px);
  border-color: var(--focus-border);
  box-shadow: 0 12px 18px color-mix(in srgb, var(--panel-shadow, rgba(0, 0, 0, 0.14)) 38%, transparent);
}

.member-actions {
  margin-top: 2px;
}

.action-button,
.agent-tile,
.secondary-button,
.primary-button {
  cursor: pointer;
}

.primary-button,
.secondary-button {
  min-width: 92px;
  height: 42px;
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: color-mix(in srgb, var(--panel-bg) 82%, transparent);
  color: var(--text-strong);
  padding: 0 18px;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.primary-button {
  justify-self: end;
  border-color: color-mix(in srgb, var(--focus-border) 45%, var(--panel-border) 55%);
  background: color-mix(in srgb, var(--selected) 62%, var(--panel-bg) 38%);
}

.primary-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.primary-button:not(:disabled):hover,
.secondary-button:hover {
  border-color: var(--focus-border);
  background: color-mix(in srgb, var(--selected) 58%, var(--panel-bg) 42%);
  transform: translateY(-1px);
}

.search-box {
  display: grid;
  gap: 8px;
  min-width: 300px;
  color: var(--text-strong);
}

.search-box span {
  font-size: 0.95rem;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px 24px;
}

.agent-tile {
  min-height: 112px;
  border: 1px solid var(--panel-border);
  border-radius: 18px;
  background: color-mix(in srgb, var(--panel-bg) 80%, transparent);
  color: var(--text-strong);
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 10px;
  padding: 12px;
  text-align: center;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.agent-tile.selected {
  border-color: var(--focus-border);
  background: var(--selected);
  box-shadow: 0 12px 18px color-mix(in srgb, var(--panel-shadow, rgba(0, 0, 0, 0.14)) 34%, transparent);
}

.agent-tile:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--focus-border) 70%, var(--panel-border) 30%);
  background: color-mix(in srgb, var(--selected) 42%, var(--panel-bg) 58%);
}

.agent-avatar {
  width: 54px;
  height: 54px;
  border: 1px solid currentColor;
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
}

.library-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.error-banner {
  max-width: 1040px;
  margin: 0 auto 14px;
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--banner-error-bg);
  color: var(--banner-error-text);
}

@media (max-width: 960px) {
  .page {
    padding: 18px;
  }

  .member-slots,
  .agent-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .member-rail {
    width: min(56%, 260px);
  }

  .library-head,
  .member-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .search-box {
    min-width: 100%;
    width: 100%;
  }
}

@media (max-width: 640px) {
  .member-slots,
  .agent-grid {
    grid-template-columns: 1fr;
  }

  .member-rail {
    display: none;
  }

  .member-node::before {
    display: none;
  }

  .member-graph {
    min-height: auto;
  }
}
</style>
