<script setup lang="ts">
import SettingsBreadcrumb from './SettingsBreadcrumb.vue';
import type { SettingsBreadcrumbItem } from './types';

defineProps<{
  breadcrumbItems: SettingsBreadcrumbItem[];
}>();

const emit = defineEmits<{
  navigateBreadcrumb: [key: string];
}>();
</script>

<template>
  <section id="models" class="config-section">
    <SettingsBreadcrumb :items="breadcrumbItems" @navigate="emit('navigateBreadcrumb', $event)" />

    <div class="section-head">
      <div>
        <p class="section-eyebrow">Models</p>
        <h3>大模型服务管理</h3>
      </div>
      <span class="section-status">占位区</span>
    </div>

    <div class="placeholder-grid">
      <article class="placeholder-card">
        <span>默认服务</span>
        <strong>dashscope / openai-compatible</strong>
        <p>预留服务选择、鉴权信息、超时和重试等配置。</p>
      </article>
      <article class="placeholder-card">
        <span>调用策略</span>
        <strong>按场景分配模型</strong>
        <p>预留聊天、工具调用、摘要等模型路由与配额策略。</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.config-section,
.placeholder-card {
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  background: var(--surface-soft);
}

.config-section {
  padding: 12px 14px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.section-eyebrow {
  margin: 0;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
}

.section-head h3 {
  margin: 0;
  color: var(--text-strong);
}

.section-status,
.placeholder-card span {
  color: var(--muted);
}

.placeholder-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.placeholder-card {
  padding: 10px;
}

.placeholder-card strong {
  display: block;
  margin-top: 4px;
  color: var(--text-strong);
}

.placeholder-card p {
  margin: 6px 0 0;
  color: var(--muted);
  line-height: 1.4;
  font-size: 0.78rem;
}

@media (max-width: 780px) {
  .placeholder-grid {
    grid-template-columns: 1fr;
  }
}
</style>
