<script setup lang="ts">
defineProps<{
  keyword: string;
  filteredAgents: string[];
  selectedAgents: string[];
}>();

const emit = defineEmits<{
  'update:keyword': [value: string];
  toggleAgent: [agentName: string];
}>();
</script>

<template>
  <section class="library-panel">
    <div class="library-head">
      <span class="panel-label">备选Agent</span>
      <label class="search-box">
        <input
          :value="keyword"
          type="text"
          placeholder="搜索Agent"
          @input="emit('update:keyword', ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <div class="agent-grid">
      <button
        v-for="agentName in filteredAgents"
        :key="agentName"
        class="agent-tile"
        :class="{ selected: selectedAgents.includes(agentName) }"
        type="button"
        @click="emit('toggleAgent', agentName)"
      >
        <span class="agent-avatar">{{ agentName.slice(0, 1).toUpperCase() }}</span>
        <strong>{{ agentName }}</strong>
      </button>

      <div v-if="!filteredAgents.length" class="empty-state">
        Agent 加载失败
      </div>
    </div>

    <p class="library-note">
      选择的 Agent 会作为团队成员加入默认群聊 `团队群聊`，再次点击可移除。
    </p>
  </section>
</template>

<style scoped>
.library-panel {
  display: grid;
  gap: 8px;
  border: 1px solid var(--team-create-panel-border);
  border-radius: 20px;
  background: var(--panel-bg);
  box-shadow: var(--panel-shadow);
  padding: 10px 12px;
  grid-column: 1 / -1;
  grid-row: 2;
  min-height: 0;
  overflow: hidden;
  grid-template-rows: auto minmax(0, 1fr) auto;
}

.library-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
  margin: -2px 0 0;
}

.library-head > .panel-label {
  padding-top: 0;
}

.panel-label {
  color: var(--text-strong);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 220px;
  color: var(--text-strong);
}

.search-box input {
  width: 220px;
  height: 32px;
  font-size: 0.84rem;
  border-radius: 10px;
  border: 1px solid var(--team-create-control-border);
  background: var(--surface-soft);
  color: var(--text-strong);
  padding: 0 12px;
  outline: none;
  box-shadow: none;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

.search-box input:focus {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-border) 18%, transparent);
  background: var(--panel-bg);
}

.agent-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px 16px;
  min-height: 0;
  overflow: auto;
  align-content: start;
  padding-right: 4px;
}

.agent-grid:has(.empty-state:only-child) {
  display: flex;
  align-items: center;
  justify-content: center;
}

.agent-tile {
  min-height: 88px;
  border: 1px solid var(--team-create-control-border);
  border-radius: 18px;
  background: var(--panel-bg);
  color: var(--text-strong);
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 8px;
  padding: 10px;
  text-align: center;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.agent-tile.selected {
  border-color: var(--focus-border);
  background: var(--selected);
  box-shadow: none;
}

.agent-tile:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--focus-border) 70%, var(--panel-border) 30%);
  background: var(--selected);
}

.agent-avatar {
  width: 42px;
  height: 42px;
  border: 1px solid currentColor;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
}

.library-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.78rem;
}

.empty-state {
  min-height: 88px;
  min-width: min(280px, 100%);
  border: 1px dashed var(--team-create-control-border);
  border-radius: 18px;
  display: grid;
  place-items: center;
  padding: 12px;
  color: var(--muted);
  background: color-mix(in srgb, var(--surface-soft) 70%, transparent);
  text-align: center;
}

@media (max-width: 960px) {
  .agent-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .library-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .search-box {
    min-width: 100%;
    width: 100%;
  }

  .search-box input {
    width: 100%;
  }
}

@media (max-width: 640px) {
  .agent-grid {
    grid-template-columns: 1fr;
  }

  .search-box {
    min-width: 100%;
  }
}
</style>
