/**
 * Returns the active WebExtension API namespace, preferring `browser` (Firefox)
 * and falling back to `chrome` (Chromium).
 */
export function getExtensionApi(): any {
  const g = globalThis as { browser?: any; chrome?: any };
  return g.browser ?? g.chrome ?? null;
}

/**
 * Opens an external URL or extension-relative HTML page in a new browser tab.
 */
export function openExtensionTab(urlOrPath: string): void {
  if (!urlOrPath) return;
  const isExternal = /^https?:\/\//i.test(urlOrPath);
  const api = getExtensionApi();

  try {
    const resolvedUrl =
      !isExternal && typeof api?.runtime?.getURL === 'function'
        ? api.runtime.getURL(urlOrPath)
        : urlOrPath;

    if (typeof api?.tabs?.create === 'function') {
      void Promise.resolve(api.tabs.create({ url: resolvedUrl, active: true })).catch(() => {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
      });
      return;
    }

    window.open(resolvedUrl, '_blank', 'noopener,noreferrer');
  } catch {
    window.open(urlOrPath, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Opens the extension options page (with an optional hash fragment like `#intelligence`).
 */
export function openExtensionOptions(hash = ''): void {
  const path = `options.html${hash}`;
  const api = getExtensionApi();

  try {
    if (typeof api?.tabs?.create === 'function' && typeof api?.runtime?.getURL === 'function') {
      const url = api.runtime.getURL(path);
      void Promise.resolve(api.tabs.create({ url, active: true })).catch(() => {
        window.open(url, '_blank', 'noopener,noreferrer');
      });
      return;
    }
    if (typeof api?.runtime?.openOptionsPage === 'function') {
      void Promise.resolve(api.runtime.openOptionsPage()).catch(() => {
        window.open(path, '_blank', 'noopener,noreferrer');
      });
      return;
    }
    const url = typeof api?.runtime?.getURL === 'function' ? api.runtime.getURL(path) : path;
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.open(path, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Returns true if the current browser exposes either Firefox `sidebarAction.open`
 * or Chromium `sidePanel.open`.
 */
export function supportsSidePanelOpen(): boolean {
  const api = getExtensionApi();
  return (
    typeof api?.sidebarAction?.open === 'function' ||
    typeof api?.sidePanel?.open === 'function'
  );
}
