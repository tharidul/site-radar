import { describe, it, expect, beforeEach } from 'vitest';
import { InspectionOrchestrator, type ActiveScanSession } from '../src/core/orchestrator/inspection-orchestrator';
import { MockBrowserAdapter } from '../src/browser/adapters/mock.adapter';
import type { WebsiteInspection } from '../src/types/inspection';

describe('Scan Session Persistence & Restoration', () => {
  let adapter: MockBrowserAdapter;
  let orchestrator: InspectionOrchestrator;

  beforeEach(() => {
    adapter = new MockBrowserAdapter();
    orchestrator = new InspectionOrchestrator({ browserAdapter: adapter });
  });

  it('persists and restores session across in-memory loss (SW restart simulation)', async () => {
    const mockInspection: WebsiteInspection = {
      id: 'scan_test_123',
      mode: 'quick',
      target: {
        url: 'http://localhost:3000/',
        origin: 'http://localhost:3000',
        hostname: 'localhost',
        inspectedAt: Date.now(),
        isLocalDevelopment: true,
      },
      browser: { name: 'chrome' },
      modules: {},
      findings: [],
      summary: {
        completedModules: 5,
        partialModules: 0,
        failedModules: 0,
        totalFindings: 0,
        passedFindings: 0,
        warningFindings: 0,
        failedFindings: 0,
      },
      startedAt: Date.now(),
      completedAt: Date.now() + 1000,
    };

    const session: ActiveScanSession = {
      scanId: 'scan_test_123',
      mode: 'quick',
      targetUrl: 'http://localhost:3000/',
      tabId: 42,
      state: 'completed',
      startedAt: mockInspection.startedAt,
      completedAt: mockInspection.completedAt,
      inspection: mockInspection,
    };

    // 1. Persist session
    await orchestrator.persistSession(session);

    // 2. Clear in-memory Map only (simulating service worker unloading while storage remains)
    const freshOrchestrator = new InspectionOrchestrator({ browserAdapter: adapter });
    expect(freshOrchestrator.getSession('scan_test_123')).toBeUndefined();

    // 3. Restore from storage using tabId and url
    const restored = await freshOrchestrator.restoreFromStorage(42, 'http://localhost:3000/');
    expect(restored).toBeDefined();
    expect(restored?.scanId).toBe('scan_test_123');
    expect(restored?.state).toBe('completed');
    expect(restored?.inspection?.target.url).toBe('http://localhost:3000/');

    // 4. getSession now finds it in-memory
    const inMemorySession = freshOrchestrator.getSession(undefined, 42, 'http://localhost:3000/');
    expect(inMemorySession).toBeDefined();
    expect(inMemorySession?.scanId).toBe('scan_test_123');
  });

  it('matches session by origin even if tabId differs (e.g. after tab reload)', async () => {
    const session: ActiveScanSession = {
      scanId: 'scan_origin_match',
      mode: 'quick',
      targetUrl: 'http://localhost:3000/',
      tabId: 10,
      state: 'completed',
      startedAt: Date.now(),
    };

    await orchestrator.persistSession(session);

    const freshOrchestrator = new InspectionOrchestrator({ browserAdapter: adapter });
    // Tab ID is now 99 (e.g. reloaded or reopened), but URL is same origin
    const restored = await freshOrchestrator.restoreFromStorage(99, 'http://localhost:3000/');
    expect(restored).toBeDefined();
    expect(restored?.scanId).toBe('scan_origin_match');
  });

  it('purges storage when clearSessions is executed', async () => {
    const session: ActiveScanSession = {
      scanId: 'scan_to_clear',
      mode: 'quick',
      targetUrl: 'http://localhost:3000/',
      tabId: 5,
      state: 'completed',
      startedAt: Date.now(),
    };

    await orchestrator.persistSession(session);
    await orchestrator.clearSessions();

    const freshOrchestrator = new InspectionOrchestrator({ browserAdapter: adapter });
    const restored = await freshOrchestrator.restoreFromStorage(5, 'http://localhost:3000/');
    expect(restored).toBeUndefined();
  });
});
