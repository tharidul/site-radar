/**
 * @file src/utils/theme.ts
 * @description Theme state manager supporting 'dark' and 'light' modes with storage persistence.
 */

import { getBrowserAdapter } from '@/browser/adapters';

export type AppTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'app_theme';

export async function loadSavedTheme(): Promise<AppTheme> {
  try {
    const adapter = getBrowserAdapter();
    const stored = await adapter.getStorage<AppTheme>([THEME_STORAGE_KEY]);
    const val = stored?.[THEME_STORAGE_KEY];
    if (val === 'light' || val === 'dark') {
      return val;
    }
  } catch {
    // Fallback if storage access is restricted
  }
  return 'dark'; // Default to anti-slop dark theme standard
}

export async function saveTheme(theme: AppTheme): Promise<void> {
  try {
    const adapter = getBrowserAdapter();
    await adapter.setStorage({ [THEME_STORAGE_KEY]: theme });
  } catch {
    // Ignore storage failure
  }
}

export function applyThemeToDom(theme: AppTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }
}
