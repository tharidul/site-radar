import { getScoreColor } from '../utils/colors';

export class BadgeService {
  private static getActionApi(): typeof chrome.action | null {
    if (typeof chrome !== 'undefined' && chrome.action) {
      return chrome.action;
    }
    if (typeof browser !== 'undefined' && (browser as any).action) {
      return (browser as any).action;
    }
    if (typeof chrome !== 'undefined' && (chrome as any).browserAction) {
      return (chrome as any).browserAction;
    }
    return null;
  }

  /**
   * Set badge reflecting overall site health score & grade
   */
  static async setScoreBadge(
    tabId: number,
    score: number,
    issuesCount?: number,
  ): Promise<void> {
    const action = this.getActionApi();
    if (!action || tabId === undefined || tabId === null || tabId < 0) return;

    const rounded = Math.min(100, Math.max(0, Math.round(score)));
    const scoreDef = getScoreColor(rounded);
    const grade = scoreDef.grade;
    const color = scoreDef.stroke;

    try {
      // Set numeric score text (e.g. "94", "100", "58")
      await action.setBadgeText({
        tabId,
        text: String(rounded),
      });

      // Set badge background color
      await action.setBadgeBackgroundColor({
        tabId,
        color,
      });

      // Optional text color for high contrast
      if (typeof (action as any).setBadgeTextColor === 'function') {
        try {
          await (action as any).setBadgeTextColor({
            tabId,
            color: '#FFFFFF',
          });
        } catch {
          // Unsupported in some browser engines
        }
      }

      // Update hover tooltip title
      const issueText = issuesCount !== undefined
        ? ` • ${issuesCount} finding${issuesCount === 1 ? '' : 's'}`
        : '';
      await action.setTitle({
        tabId,
        title: `SiteRadar: Score ${rounded}/100 (Grade ${grade})${issueText}`,
      });
    } catch (err) {
      console.warn('Failed to update extension action badge:', err);
    }
  }

  /**
   * Display scanning in-progress state
   */
  static async setScanning(tabId: number): Promise<void> {
    const action = this.getActionApi();
    if (!action || tabId === undefined || tabId === null || tabId < 0) return;

    try {
      await action.setBadgeText({
        tabId,
        text: '...',
      });
      await action.setBadgeBackgroundColor({
        tabId,
        color: '#2563eb', // Blue
      });
      if (typeof (action as any).setBadgeTextColor === 'function') {
        try {
          await (action as any).setBadgeTextColor({ tabId, color: '#FFFFFF' });
        } catch {}
      }
      await action.setTitle({
        tabId,
        title: 'SiteRadar: Inspecting website...',
      });
    } catch {
      // Ignore background race conditions
    }
  }

  /**
   * Clear badge for tab
   */
  static async clear(tabId?: number): Promise<void> {
    const action = this.getActionApi();
    if (!action) return;

    try {
      if (tabId !== undefined && tabId !== null && tabId >= 0) {
        await action.setBadgeText({ tabId, text: '' });
        await action.setTitle({ tabId, title: 'SiteRadar' });
      } else {
        await action.setBadgeText({ text: '' });
        await action.setTitle({ title: 'SiteRadar' });
      }
    } catch {
      // Ignore
    }
  }
}

