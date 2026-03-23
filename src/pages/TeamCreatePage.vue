<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { totalMessageCount } from '../appUiState';
import { createTeam, getAgents } from '../api';
import AgentLibraryCard from '../components/AgentLibraryCard.vue';
import TeamInfoCard from '../components/TeamInfoCard.vue';
import TeamMembersCard from '../components/TeamMembersCard.vue';
import { loadTeams, teams } from '../teamStore';
import type { AgentInfo } from '../types';

const router = useRouter();

const name = ref('');
const workingDirectory = ref('');
const slogan = ref('');
const rules = ref('');
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

function toggleAgent(agentName: string): void {
  if (selectedAgents.value.includes(agentName)) {
    selectedAgents.value = selectedAgents.value.filter((item) => item !== agentName);
    return;
  }
  selectedAgents.value = [...selectedAgents.value, agentName];
}

async function loadAvailableAgents(): Promise<void> {
  try {
    const runtimeAgents = await getAgents();
    const unique = new Set<string>();
    runtimeAgents.forEach((agent: AgentInfo) => unique.add(agent.template_name || agent.name));
    availableAgents.value = Array.from(unique).sort((left, right) => left.localeCompare(right));
  } catch (error) {
    availableAgents.value = [];
    console.error(error);
  }
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
      config: {
        slogan: slogan.value.trim(),
        rules: rules.value.trim(),
      },
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
  loadAvailableAgents();
});
</script>

<template>
  <section class="page panel">
    <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

    <form class="form-grid" @submit.prevent="handleSubmit">
      <TeamInfoCard
        :name="name"
        :working-directory="workingDirectory"
        :slogan="slogan"
        :rules="rules"
        @update:name="name = $event"
        @update:working-directory="workingDirectory = $event"
        @update:slogan="slogan = $event"
        @update:rules="rules = $event"
      />

      <TeamMembersCard :team-name="name" :selected-agents="selectedAgents" @toggle-agent="toggleAgent" />

      <AgentLibraryCard
        :keyword="keyword"
        :filtered-agents="filteredAgents"
        :selected-agents="selectedAgents"
        @update:keyword="keyword = $event"
        @toggle-agent="toggleAgent"
      />
    </form>

    <div class="member-actions">
      <button type="button" class="action-button secondary-button" @click="$router.back()">取消</button>
      <button class="action-button primary-button" type="button" :disabled="!canSubmit" @click="handleSubmit">
        {{ submitting ? '创建中…' : '创建' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.page {
  height: 100%;
  overflow: hidden;
  padding: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 8px;
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
}

.form-grid {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  grid-template-rows: minmax(0, auto) minmax(0, 1fr);
  gap: 8px;
  max-width: none;
  height: 100%;
  min-height: 0;
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.member-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  margin-top: 0;
  flex-shrink: 0;
  padding: 0 0 2px;
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
  height: 38px;
  border: 1px solid var(--team-create-control-border);
  border-radius: 14px;
  background: var(--panel-bg);
  color: var(--text-strong);
  padding: 0 18px;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    transform 0.18s ease;
}

.primary-button {
  border-color: color-mix(in srgb, var(--focus-border) 45%, var(--panel-border) 55%);
  background: var(--selected);
}

.primary-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.primary-button:not(:disabled):hover,
.secondary-button:hover {
  border-color: var(--focus-border);
  background: var(--selected);
  transform: translateY(-1px);
}

.error-banner {
  max-width: 1040px;
  margin: 0 0 8px;
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--banner-error-bg);
  color: var(--banner-error-text);
}

@media (max-width: 960px) {
  .form-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto minmax(0, 1fr);
  }

  .member-actions {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
