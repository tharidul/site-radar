import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InspectionOrchestrator, type ActiveScanSession } from '../src/core/orchestrator/inspection-orchestrator';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';

function makeSession(overrides: Partial<ActiveScanSession> = {}): ActiveScanSession {
  return {
    scanId: overrides.scanId ?? `scan_${Math.random().toString(36).slice(2, 8)}`,
    mode: overrides.mode ?? 'full',
    targetUrl: overrides.targetUrl ?? 'https://example.com/',
    tabId: overrides.tabId ?? 1,
    state: overrides.state ?? 'completed',
    startedAt: overrides.startedAt ?? Date.now(),
    ...overrides,
  };
}

describe('Orchestrator Lifecycle & Storage Bounds (MED-12, MED-13, MED-17)', () => {
  let adapter: MockBrowserAdapter;
  let orchestrator: InspectionOrchestrator;

  beforeEach(() => {
    adapter = new MockBrowserAdapter();
    orchestrator = new InspectionOrchestrator({ browserAdapter: adapter });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('MED-12: Bounded origin session persistence (LRU max 10)', () => {
    it('caps persisted origin session keys at 10 and prunes the oldest origins', async () => {
      for (let i = 1; i <= 12; i++) {
        await orchestrator.persistSession(
          makeSession({
            scanId: `scan_${i}`,
            targetUrl: `https://site-${i}.example.com/page`,
            tabId: i,
          }),
        );
      }

      const stored = await adapter.getStorage<unknown>(null, 'session');
      const originKeys = Object.keys(stored).filter((k) =>
        k.startsWith('siteradar_session_origin_https://'),
      );

      expect(originKeys).toHaveLength(10);
      expect(stored['siteradar_session_origin_https://site-1.example.com']).toBeUndefined();
      expect(stored['siteradar_session_origin_https://site-2.example.com']).toBeUndefined();
      expect(stored['siteradar_session_origin_https://site-3.example.com']).toBeDefined();
      expect(stored['siteradar_session_origin_https://site-12.example.com']).toBeDefined();
    });

    it('promotes re-persisted origins in the LRU and evicts the least recently used origin', async () => {
      for (let i = 1; i <= 10; i++) {
        await orchestrator.persistSession(
          makeSession({
            scanId: `scan_${i}`,
            targetUrl: `https://site-${i}.example.com/`,
            tabId: i,
          }),
        );
      }

      // Touch site-1 so site-2 becomes the least recently used origin
      await orchestrator.persistSession(
        makeSession({
          scanId: 'scan_1_refresh',
          targetUrl: 'https://site-1.example.com/updated',
          tabId: 1,
        }),
      );

      // Adding site-11 should evict site-2, while keeping site-1
      await orchestrator.persistSession(
        makeSession({
          scanId: 'scan_11',
          targetUrl: 'https://site-11.example.com/',
          tabId: 11,
        }),
      );

      const stored = await adapter.getStorage<unknown>(null, 'session');
      expect(stored['siteradar_session_origin_https://site-1.example.com']).toBeDefined();
      expect(stored['siteradar_session_origin_https://site-2.example.com']).toBeUndefined();
      expect(stored['siteradar_session_origin_https://site-11.example.com']).toBeDefined();
    });

    it('clears the LRU index along with origin session keys on clearSessions()', async () => {
      await orchestrator.persistSession(
        makeSession({
          scanId: 'scan_clear',
          targetUrl: 'https://clear-me.example.com/',
          tabId: 7,
        }),
      );

      await orchestrator.clearSessions();
      const stored = await adapter.getStorage<unknown>(null, 'session');
      const sessionKeys = Object.keys(stored).filter((k) => k.startsWith('siteradar_session_'));
      expect(sessionKeys).toHaveLength(0);
    });
  });

  describe('MED-13: Stale running sessions transitioned to failed on SW restart', () => {
    it('marks a restored running session as failed when no active in-memory scan exists and persists the update', async () => {
      const runningSession = makeSession({
        scanId: 'scan_interrupted',
        targetUrl: 'https://interrupted.example.com/',
        tabId: 42,
        state: 'running',
      });
      await orchestrator.persistSession(runningSession);

      // Simulate service worker restart with a fresh orchestrator sharing storage
      const freshOrchestrator = new InspectionOrchestrator({ browserAdapter: adapter });
      const restored = await freshOrchestrator.restoreFromStorage(42, 'https://interrupted.example.com/');

      expect(restored).toBeDefined();
      expect(restored?.scanId).toBe('scan_interrupted');
      expect(restored?.state).toBe('failed');
      expect(restored?.error).toBe('Scan interrupted by service worker restart.');

      // Verify persisted storage record was also updated so subsequent restores see failed
      const secondRestore = await new InspectionOrchestrator({ browserAdapter: adapter }).restoreFromStorage(
        42,
        'https://interrupted.example.com/',
      );
      expect(secondRestore?.state).toBe('failed');
      expect(secondRestore?.error).toBe('Scan interrupted by service worker restart.');
    });

    it('preserves running state when the scan is actively tracked in memory', async () => {
      const activeSession = makeSession({
        scanId: 'scan_still_active',
        targetUrl: 'https://active.example.com/',
        tabId: 55,
        state: 'running',
      });
      // Seed in-memory activeSessions via internal map for active scan simulation
      (orchestrator as any).activeSessions.set(activeSession.scanId, activeSession);
      await orchestrator.persistSession(activeSession);

      const restored = await orchestrator.restoreFromStorage(55, 'https://active.example.com/');
      expect(restored?.state).toBe('running');
      expect(restored?.error).toBeUndefined();
    });
  });

  describe('MED-17: MockBrowserAdapter skips live network HEAD fetch', () => {
    it('completes localhost full inspection under MockBrowserAdapter without invoking fetch()', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      adapter.setMockTab({
        id: 1,
        url: 'http://localhost:3000/',
        title: 'Localhost Dev',
        active: true,
        windowId: 1,
        incognito: false,
      });

      const result = await orchestrator.startInspection('full', 1, { refreshPage: false });

      expect(result).toBeDefined();
      expect(result.target.url).toBe('http://localhost:3000/');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
