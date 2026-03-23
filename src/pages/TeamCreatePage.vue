<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { totalMessageCount } from '../appUiState';
import { createTeam, getAgents } from '../api';
import { loadTeams, teams } from '../teamStore';
import type { AgentInfo } from '../types';

const router = useRouter();

const name = ref('');
const availableAgents = ref<string[]>([]);
const selectedAgents = ref<string[]>([]);
const submitting = ref(false);
const errorMessage = ref('');

const canSubmit = computed(
  () => name.value.trim().length > 0 && selectedAgents.value.length > 0 && !submitting.value,
);

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
  runtimeAgents.forEach((agent: AgentInfo) => unique.add(agent.name));
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
      members: selectedAgents.value,
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
    <div class="page-head">
      <div>
        <p class="page-eyebrow">Team Setup</p>
        <h2>创建团队</h2>
      </div>
      <button type="button" class="secondary-button" @click="$router.back()">返回</button>
    </div>

    <div v-if="errorMessage" class="error-banner">{{ errorMessage }}</div>

    <form class="form-grid" @submit.prevent="handleSubmit">
      <label class="field">
        <span>团队名称</span>
        <input v-model="name" type="text" placeholder="例如：alpha-delivery" />
      </label>

      <section class="selector-card">
        <div class="selector-head">
          <h3>选择 Agent</h3>
          <span>{{ selectedAgents.length }} / {{ availableAgents.length }}</span>
        </div>
        <div class="agent-grid">
          <label v-for="agentName in availableAgents" :key="agentName" class="agent-option">
            <input
              :checked="selectedAgents.includes(agentName)"
              type="checkbox"
              @change="toggleAgent(agentName)"
            />
            <span>{{ agentName }}</span>
          </label>
        </div>
      </section>

      <section class="summary-card">
        <h3>默认配置</h3>
        <p>创建后会自动生成 1 个群聊：`团队群聊`。</p>
        <p>所选 Agent 会全部加入该群聊，初始话题与最大轮次按默认值写入。</p>
      </section>

      <div class="actions">
        <button class="primary-button" type="submit" :disabled="!canSubmit">
          {{ submitting ? '创建中…' : '创建团队' }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.page {
  height: 100%;
  overflow: auto;
  padding: 22px;
}

.page-head,
.selector-head,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-head {
  margin-bottom: 20px;
}

.page-eyebrow {
  margin: 0 0 4px;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.72rem;
}

.page-head h2,
.selector-head h3,
.summary-card h3 {
  margin: 0;
  color: var(--text-strong);
}

.form-grid {
  display: grid;
  gap: 16px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: var(--muted);
  font-size: 0.8rem;
}

.field input {
  height: 42px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  background: var(--composer-bg);
  color: var(--text-strong);
  padding: 0 12px;
}

.selector-card,
.summary-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
  padding: 16px;
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.agent-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  border: 1px solid var(--panel-border);
  border-radius: 10px;
  padding: 0 12px;
  background: var(--panel-bg);
}

.summary-card p {
  margin: 8px 0 0;
  color: var(--muted);
}

.primary-button,
.secondary-button {
  height: 40px;
  border-radius: 10px;
  padding: 0 14px;
  cursor: pointer;
}

.primary-button {
  border: 1px solid var(--focus-border);
  background: var(--selected);
  color: var(--text-strong);
}

.secondary-button {
  border: 1px solid var(--panel-border);
  background: var(--pill-bg);
  color: var(--text-strong);
}

.primary-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.error-banner {
  margin-bottom: 14px;
  border-radius: 10px;
  padding: 10px 12px;
  background: var(--banner-error-bg);
  color: var(--banner-error-text);
}
</style>
