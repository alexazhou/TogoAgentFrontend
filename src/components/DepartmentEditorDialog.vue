<script setup lang="ts">
defineProps<{
  open: boolean;
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
      <section class="department-editor-dialog panel">
        <div class="department-editor-head">
          <div class="department-editor-title-row">
            <h2 class="department-editor-title">编辑部门</h2>
            <p class="section-eyebrow">Department</p>
          </div>
          <p class="department-editor-meta">主管：{{ memberName }}</p>
        </div>

        <label class="department-editor-field">
          <span>部门名称</span>
          <input
            :value="departmentName"
            class="department-editor-input"
            type="text"
            placeholder="请输入部门名称"
            @input="emit('update:departmentName', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <label class="department-editor-field">
          <span>部门责任</span>
          <textarea
            :value="departmentResponsibility"
            class="department-editor-input department-editor-textarea"
            rows="4"
            placeholder="请输入部门责任"
            @input="emit('update:departmentResponsibility', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </label>

        <div class="department-editor-actions">
          <button type="button" class="ghost-button" @click="emit('close')">取消</button>
          <button type="button" class="secondary-button" @click="emit('save')">保存</button>
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
  color: var(--accent);
  font-size: 0.9rem;
  font-weight: 600;
}

.department-editor-input {
  width: 100%;
  border: 1px solid var(--team-create-control-border);
  border-radius: 16px;
  background: var(--panel-bg);
  color: var(--text-strong);
  padding: 14px 18px;
  font-size: 0.98rem;
  outline: none;
}

.department-editor-input:focus {
  border-color: var(--focus-border);
  box-shadow: 0 0 0 2px var(--focus-glow);
}

.department-editor-textarea {
  min-height: 112px;
  resize: vertical;
  line-height: 1.5;
  font-family: inherit;
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
