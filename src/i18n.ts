import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN.json';
import en from './locales/en.json';

const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: { 'zh-CN': zhCN, en },
});

export default i18n;

/** Standalone translation function for use outside Vue components (stores, utils, api). */
export function t(key: string, params?: Record<string, string | number>): string {
  return i18n.global.t(key, params ?? {}) as string;
}

export async function syncLanguageFromBackend(): Promise<void> {
  try {
    const resp = await fetch('/system/status.json');
    if (resp.ok) {
      const data = await resp.json() as { language?: string };
      if (data.language) {
        i18n.global.locale.value = data.language;
      }
    }
  } catch {
    // silently fall back to default language
  }
}
