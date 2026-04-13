import { computed, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AgentInfo, AgentStatus, RoleTemplateSummary } from '../types';

export function useAgentActivityDialogState(
  agents: Ref<AgentInfo[]>,
  roleTemplates: Ref<RoleTemplateSummary[]>,
) {
  const { t } = useI18n();
  const open = ref(false);
  const selectedAgentId = ref<number | null>(null);
  const selectedAgentName = ref<string | null>(null);

  const roleTemplateNameMap = computed(
    () => new Map(roleTemplates.value.map((template) => [template.id, template.name])),
  );

  const selectedAgentStatus = computed<AgentStatus | null>(
    () => agents.value.find((agent) => agent.id === selectedAgentId.value)?.status ?? null,
  );

  const selectedAgentTemplateName = computed<string | null>(() => {
    const roleTemplateId = agents.value.find((agent) => agent.id === selectedAgentId.value)?.role_template_id;
    if (typeof roleTemplateId !== 'number') {
      return null;
    }

    return roleTemplateNameMap.value.get(roleTemplateId) ?? t('agent.templateFallback', { id: roleTemplateId });
  });

  function openAgent(agentName: string): void {
    selectedAgentId.value = agents.value.find((agent) => agent.name === agentName)?.id ?? null;
    selectedAgentName.value = agentName;
    open.value = true;
  }

  function closeAgentDetail(): void {
    open.value = false;
    selectedAgentId.value = null;
    selectedAgentName.value = null;
  }

  return {
    open,
    selectedAgentId,
    selectedAgentName,
    selectedAgentStatus,
    selectedAgentTemplateName,
    openAgent,
    closeAgentDetail,
  };
}
