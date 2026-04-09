export const settingsNavItems = [
  { id: 'teams', label: '团队管理', note: '团队信息与组织结构' },
  { id: 'roles', label: '角色管理', note: '角色模板与职责分配' },
  { id: 'models', label: '大模型服务管理', note: '模型服务与调用策略' },
];

export type SettingsNavItem = (typeof settingsNavItems)[number];
