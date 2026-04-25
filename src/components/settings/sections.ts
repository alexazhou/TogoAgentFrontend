export const SETTINGS_ROUTE_SECTIONS = [
  'general',
  'teams',
  'roles',
  'models',
  'runtime',
] as const;

export type SettingsRouteSection = (typeof SETTINGS_ROUTE_SECTIONS)[number];

export const DEFAULT_SETTINGS_SECTION: SettingsRouteSection = 'general';

export const SETTINGS_NAV_ITEMS = [
  'general',
  'teams',
  'roles',
  'models',
  'runtime',
  'quickInit',
] as const;

export type SettingsNavItemId = (typeof SETTINGS_NAV_ITEMS)[number];

export function isSettingsRouteSection(value: string): value is SettingsRouteSection {
  return SETTINGS_ROUTE_SECTIONS.includes(value as SettingsRouteSection);
}
