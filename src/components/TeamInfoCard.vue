<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string;
  workingDirectory: string;
  slogan: string;
  rules: string;
  readonly?: boolean;
}>(), {
  readonly: false,
});

const emit = defineEmits<{
  'update:name': [value: string];
  'update:workingDirectory': [value: string];
  'update:slogan': [value: string];
  'update:rules': [value: string];
}>();
</script>

<template>
  <label class="name-panel">
    <span class="panel-title">团队信息</span>
    <span class="field-label">团队名称</span>
    <input
      :value="name"
      type="text"
      placeholder="例如：alpha-delivery"
      :readonly="props.readonly"
      @input="emit('update:name', ($event.target as HTMLInputElement).value)"
    />
    <span class="field-label">工作目录</span>
    <input
      :value="workingDirectory"
      type="text"
      placeholder="例如：/workspace/alpha-delivery"
      :readonly="props.readonly"
      @input="emit('update:workingDirectory', ($event.target as HTMLInputElement).value)"
    />
    <span class="field-label">团队口号</span>
    <input
      :value="slogan"
      type="text"
      placeholder="例如：硅基动力，优秀实力"
      :readonly="props.readonly"
      @input="emit('update:slogan', ($event.target as HTMLInputElement).value)"
    />
    <span class="field-label">团队制度</span>
    <textarea
      :value="rules"
      rows="3"
      placeholder="例如：1. 先沟通后执行 2. 结果同步到群聊"
      :readonly="props.readonly"
      @input="emit('update:rules', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>
  </label>
</template>

<style scoped>
.name-panel {
  display: grid;
  gap: 8px;
  border: 1px solid var(--team-create-panel-border);
  border-radius: 20px;
  background: var(--panel-bg);
  box-shadow: var(--panel-shadow);
  padding: 10px 12px;
  align-content: start;
}

.panel-title {
  color: var(--text-strong);
  font-size: 0.96rem;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.field-label {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

input,
textarea {
  border: 1px solid var(--team-create-control-border);
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--text-strong);
  padding: 0 12px;
  outline: none;
  box-shadow: none;
  font-size: 0.9rem;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease;
}

input {
  height: 36px;
}

textarea {
  min-height: 84px;
  resize: vertical;
  padding: 10px 12px;
  line-height: 1.45;
}

input[readonly],
textarea[readonly] {
  cursor: default;
}

input:focus,
textarea:focus {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-border) 18%, transparent);
  background: var(--panel-bg);
}
</style>
