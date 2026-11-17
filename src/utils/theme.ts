
import { getBrowserAdapter } from '@/browser/adapters';

export type AppTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'app_theme';

export async function loadSavedTheme(): Promise<AppTheme> {
  try {
    if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem(THEME_STORAGE_KEY);
      if (local === 'light' || local === 'dark') {
        return local;
      }
    }
    const adapter = getBrowserAdapter();
    const stored = await adapter.getStorage<AppTheme>([THEME_STORAGE_KEY]);
    const val = stored?.[THEME_STORAGE_KEY];
    if (val === 'light' || val === 'dark') {
      return val;
    }
  } catch {
  }
  return 'dark';
}

export async function saveTheme(theme: AppTheme): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    }
    const adapter = getBrowserAdapter();
    await adapter.setStorage({ [THEME_STORAGE_KEY]: theme });
  } catch {
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
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', theme);
  }
}
