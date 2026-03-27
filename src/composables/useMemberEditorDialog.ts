import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { getAgentDetail } from '../api';

export type MemberEditorMode = 'view' | 'edit';

export type MemberTemplateOption = {
  name: string;
  model: string;
};

export type MemberDriverOption = {
  value: string;
  label: string;
};

type UseMemberEditorDialogOptions = {
  teamId: Ref<number>;
  templateOptions: ComputedRef<MemberTemplateOption[]>;
  driverCatalog: Ref<MemberDriverOption[]>;
  resolveTemplate: (memberName: string) => string;
  canLoadMemberDetail?: (memberName: string) => boolean;
};

export function useMemberEditorDialog(options: UseMemberEditorDialogOptions) {
  const editingMemberName = ref('');
  const memberEditorKeyword = ref('');
  const memberEditorTemplate = ref('');
  const memberEditorDriver = ref('');
  const memberEditorMode = ref<MemberEditorMode>('view');
  const memberDriverCache = new Map<string, string>();
  let memberEditorRequestId = 0;

  const memberEditorOpen = computed(() => editingMemberName.value.length > 0);
  const memberEditorEditable = computed(() => memberEditorMode.value === 'edit');
  const currentMemberTemplateOption = computed(
    () => options.templateOptions.value.find((item) => item.name === memberEditorTemplate.value) ?? null,
  );
  const filteredMemberTemplateOptions = computed(() => {
    const keyword = memberEditorKeyword.value.trim().toLowerCase();
    if (!keyword) {
      return options.templateOptions.value;
    }

    return options.templateOptions.value.filter((item) => item.name.toLowerCase().includes(keyword));
  });
  const memberDriverOptions = computed(() => {
    const optionsMap = new Map<string, string>();

    options.driverCatalog.value.forEach((driver) => {
      optionsMap.set(driver.value, driver.label);
    });

    if (memberEditorDriver.value && !optionsMap.has(memberEditorDriver.value)) {
      optionsMap.set(memberEditorDriver.value, memberEditorDriver.value);
    }

    return Array.from(optionsMap.entries()).map(([value, label]) => ({ value, label }));
  });

  function resetDialogState(): void {
    memberEditorRequestId += 1;
    editingMemberName.value = '';
    memberEditorKeyword.value = '';
    memberEditorTemplate.value = '';
    memberEditorDriver.value = '';
    memberEditorMode.value = 'view';
  }

  async function loadMemberDriver(agentName: string): Promise<void> {
    const requestId = ++memberEditorRequestId;

    if (options.canLoadMemberDetail && !options.canLoadMemberDetail(agentName)) {
      memberEditorDriver.value = '';
      return;
    }

    if (memberDriverCache.has(agentName)) {
      memberEditorDriver.value = memberDriverCache.get(agentName) || '';
      return;
    }

    try {
      const detail = await getAgentDetail(options.teamId.value, agentName);
      if (requestId !== memberEditorRequestId || editingMemberName.value !== agentName) {
        return;
      }

      const nextDriver = detail.driver_type || '';
      memberDriverCache.set(agentName, nextDriver);
      memberEditorDriver.value = nextDriver;
    } catch (error) {
      console.error(error);
      if (requestId !== memberEditorRequestId || editingMemberName.value !== agentName) {
        return;
      }

      memberEditorDriver.value = '';
    }
  }

  function openMemberEditor(agentName: string): void {
    memberEditorMode.value = 'edit';
    editingMemberName.value = agentName;
    memberEditorKeyword.value = '';
    memberEditorTemplate.value = options.resolveTemplate(agentName);
    memberEditorDriver.value = '';
    void loadMemberDriver(agentName);
  }

  function openMemberViewer(agentName: string): void {
    memberEditorMode.value = 'view';
    editingMemberName.value = agentName;
    memberEditorKeyword.value = '';
    memberEditorTemplate.value = options.resolveTemplate(agentName);
    memberEditorDriver.value = '';
    void loadMemberDriver(agentName);
  }

  function openPendingMemberEditor(displayName = '新成员'): void {
    memberEditorMode.value = 'edit';
    editingMemberName.value = displayName;
    memberEditorKeyword.value = '';
    memberEditorTemplate.value = '';
    memberEditorDriver.value = '';
  }

  function closeMemberEditor(): void {
    resetDialogState();
  }

  function replaceSelectedTemplate(templateName: string): void {
    memberEditorTemplate.value = templateName;
  }

  return {
    editingMemberName,
    memberEditorKeyword,
    memberEditorTemplate,
    memberEditorDriver,
    memberEditorMode,
    memberEditorOpen,
    memberEditorEditable,
    currentMemberTemplateOption,
    filteredMemberTemplateOptions,
    memberDriverOptions,
    openMemberEditor,
    openMemberViewer,
    openPendingMemberEditor,
    closeMemberEditor,
    resetDialogState,
    replaceSelectedTemplate,
  };
}
