import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadgeService } from '../src/services/badge.service';

describe('BadgeService', () => {
  const mockSetBadgeText = vi.fn().mockResolvedValue(undefined);
  const mockSetBadgeBackgroundColor = vi.fn().mockResolvedValue(undefined);
  const mockSetTitle = vi.fn().mockResolvedValue(undefined);
  const mockSetBadgeTextColor = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as any).chrome = {
      action: {
        setBadgeText: mockSetBadgeText,
        setBadgeBackgroundColor: mockSetBadgeBackgroundColor,
        setTitle: mockSetTitle,
        setBadgeTextColor: mockSetBadgeTextColor,
      },
    };
  });

  it('sets score badge for high scores (Grade A)', async () => {
    await BadgeService.setScoreBadge(123, 95, 2);

    expect(mockSetBadgeText).toHaveBeenCalledWith({ tabId: 123, text: '95' });
    expect(mockSetBadgeBackgroundColor).toHaveBeenCalledWith({ tabId: 123, color: '#10b981' });
    expect(mockSetTitle).toHaveBeenCalledWith({
      tabId: 123,
      title: 'SiteRadar: Score 95/100 (Grade A) • 2 findings',
    });
  });

  it('sets score badge for failing scores (Grade F)', async () => {
    await BadgeService.setScoreBadge(123, 45, 12);

    expect(mockSetBadgeText).toHaveBeenCalledWith({ tabId: 123, text: '45' });
    expect(mockSetBadgeBackgroundColor).toHaveBeenCalledWith({ tabId: 123, color: '#ef4444' });
    expect(mockSetTitle).toHaveBeenCalledWith({
      tabId: 123,
      title: 'SiteRadar: Score 45/100 (Grade F) • 12 findings',
    });
  });

  it('sets scanning in-progress state', async () => {
    await BadgeService.setScanning(123);

    expect(mockSetBadgeText).toHaveBeenCalledWith({ tabId: 123, text: '...' });
    expect(mockSetBadgeBackgroundColor).toHaveBeenCalledWith({ tabId: 123, color: '#2563eb' });
  });

  it('clears badge on request', async () => {
    await BadgeService.clear(123);

    expect(mockSetBadgeText).toHaveBeenCalledWith({ tabId: 123, text: '' });
    expect(mockSetTitle).toHaveBeenCalledWith({ tabId: 123, title: 'SiteRadar' });
  });
});

