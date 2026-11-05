/**
 * @file src/core/orchestrator/cancellation.ts
 * @description Scan cancellation controller providing instant abort of running
 * inspections, module tasks, and network operations via AbortController.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 9.
 */

export class ScanCancelledError extends Error {
  readonly code = 'SCAN_CANCELLED' as const;
  readonly scanId: string;
  readonly timestamp: number;

  constructor(scanId: string, reason = 'Inspection was cancelled by user') {
    super(`[${scanId}] ${reason}`);
    this.name = 'ScanCancelledError';
    this.scanId = scanId;
    this.timestamp = Date.now();
    Object.setPrototypeOf(this, ScanCancelledError.prototype);
  }
}

export interface ICancellationManager {
  register(scanId: string): AbortSignal;
  cancel(scanId: string, reason?: string): boolean;
  isCancelled(scanId: string): boolean;
  getSignal(scanId: string): AbortSignal | undefined;
  cleanup(scanId: string): void;
  createLinkedTimeout(
    scanId: string,
    timeoutMs: number,
  ): { signal: AbortSignal; cleanup: () => void };
}

export class CancellationManager implements ICancellationManager {
  private controllers = new Map<string, AbortController>();

  register(scanId: string): AbortSignal {
    if (this.controllers.has(scanId)) {
      this.cleanup(scanId);
    }
    const controller = new AbortController();
    this.controllers.set(scanId, controller);
    return controller.signal;
  }

  cancel(scanId: string, reason?: string): boolean {
    const controller = this.controllers.get(scanId);
    if (!controller) {
      return false;
    }
    if (controller.signal.aborted) {
      return true;
    }
    controller.abort(new ScanCancelledError(scanId, reason));
    return true;
  }

  isCancelled(scanId: string): boolean {
    const controller = this.controllers.get(scanId);
    return controller ? controller.signal.aborted : false;
  }

  getSignal(scanId: string): AbortSignal | undefined {
    return this.controllers.get(scanId)?.signal;
  }

  cleanup(scanId: string): void {
    this.controllers.delete(scanId);
  }

  /**
   * Creates a child AbortSignal that aborts if EITHER the parent scan is cancelled
   * OR the specified timeout interval elapses.
   */
  createLinkedTimeout(
    scanId: string,
    timeoutMs: number,
  ): { signal: AbortSignal; cleanup: () => void } {
    const parentSignal = this.getSignal(scanId);
    const childController = new AbortController();

    if (parentSignal?.aborted) {
      childController.abort(parentSignal.reason);
      return { signal: childController.signal, cleanup: () => {} };
    }

    const timerId = setTimeout(() => {
      childController.abort(new Error(`Module execution timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const onParentAbort = () => {
      clearTimeout(timerId);
      childController.abort(parentSignal?.reason);
    };

    if (parentSignal) {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }

    const cleanup = () => {
      clearTimeout(timerId);
      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort);
      }
    };

    return { signal: childController.signal, cleanup };
  }
}

export const cancellationManager = new CancellationManager();
