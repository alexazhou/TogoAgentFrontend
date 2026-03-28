<script setup lang="ts">
defineProps<{
  open: boolean;
  editable?: boolean;
  memberName: string;
  departmentName: string;
  departmentResponsibility: string;
}>();

const emit = defineEmits<{
  close: [];
  save: [];
  'update:departmentName': [value: string];
  'update:departmentResponsibility': [value: string];
}>();
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="department-editor-overlay" @click.self="emit('close')">
      <section
        class="department-editor-dialog panel"
        :class="{ 'department-editor-dialog--readonly': !editable }"
      >
        <div class="department-editor-head">
          <div class="department-editor-title-row">
            <h2 class="department-editor-title">{{ editable ? '编辑部门' : '查看部门' }}</h2>
            <p class="section-eyebrow">Department</p>
          </div>
          <p class="department-editor-meta">主管：{{ memberName }}</p>
        </div>

        <label class="department-editor-field">
          <span>部门名称</span>
          <input
            :value="departmentName"
            class="department-editor-input"
            :class="{ 'department-editor-input--readonly': !editable }"
            type="text"
            :placeholder="editable ? '请输入部门名称' : ''"
            :readonly="!editable"
            @input="emit('update:departmentName', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="department-editor-field">
          <span>部门责任</span>
          <textarea
            :value="departmentResponsibility"
            class="department-editor-input department-editor-textarea"
            :class="{ 'department-editor-input--readonly': !editable }"
            rows="4"
            :placeholder="editable ? '请输入部门责任' : ''"
            :readonly="!editable"
            @input="emit('update:departmentResponsibility', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>

        <div class="department-editor-actions">
          <button type="button" class="ghost-button" @click="emit('close')">{{ editable ? '取消' : '关闭' }}</button>
          <button v-if="editable" type="button" class="secondary-button" @click="emit('save')">保存</button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.department-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(6, 10, 16, 0.44);
  backdrop-filter: blur(8px);
}

.department-editor-dialog {
  width: min(520px, 100%);
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
}

.department-editor-head {
  display: grid;
  gap: 6px;
}

.department-editor-title-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.department-editor-title {
  margin: 0;
  color: var(--text-strong);
  font-size: 1.52rem;
  line-height: 1.04;
}

.section-eyebrow {
  margin: 0;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.68rem;
}

.department-editor-meta {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
}

.department-editor-field {
  display: grid;
  gap: 8px;
}

.department-editor-field > span {
  color: var(--muted);
  font-size: 0.74rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.department-editor-input {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--focus-border) 34%, var(--panel-border) 66%);
  border-radius: 12px;
  background: color-mix(in srgb, #fff 88%, var(--surface-soft) 12%);
  color: var(--text-strong);
  padding: 14px 18px;
  font-size: 0.98rem;
  outline: none;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}

.department-editor-input:focus {
  border-color: var(--focus-border);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--focus-border) 38%, transparent),
    0 0 0 3px color-mix(in srgb, var(--focus-border) 14%, transparent);
}

.department-editor-input--readonly {
  border: 1px dashed color-mix(in srgb, var(--focus-border) 18%, var(--panel-border) 82%);
  background: color-mix(in srgb, var(--surface-soft) 86%, var(--panel-bg) 14%);
  color: color-mix(in srgb, var(--muted) 84%, var(--text-strong) 16%);
  -webkit-text-fill-color: color-mix(in srgb, var(--muted) 84%, var(--text-strong) 16%);
  box-shadow: none;
}

.department-editor-textarea {
  min-height: 112px;
  resize: vertical;
  line-height: 1.5;
  font-family: inherit;
}

.department-editor-dialog--readonly .department-editor-input[readonly] {
  cursor: default;
}

.department-editor-dialog--readonly .department-editor-input:focus {
  border: 1px dashed color-mix(in srgb, var(--focus-border) 18%, var(--panel-border) 82%);
  background: color-mix(in srgb, var(--surface-soft) 86%, var(--panel-bg) 14%);
  box-shadow: none;
}

.department-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.department-editor-actions > button {
  width: 112px;
  min-width: 112px;
  height: 32px;
  padding: 0 14px;
  font-size: 0.84rem;
}
</style>
