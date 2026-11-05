/**
 * @file src/core/orchestrator/scheduler.ts
 * @description Task execution scheduler with bounded concurrency, per-module timeouts,
 * retry guards, and isolated error boundaries.
 * Authoritative specification according to WEBSITE-INTELLIGENCE-ARCHITECTURE.md § 9.
 */

import type { CollectionResult } from '../../types/inspection';
import type { ModulePlanItem } from './mode-plans';

export interface TaskExecutionContext {
  scanId: string;
  moduleId: string;
  signal: AbortSignal;
}

export type TaskRunner<T = unknown> = (context: TaskExecutionContext) => Promise<CollectionResult<T>>;

export interface ScheduledTask<T = unknown> {
  planItem: ModulePlanItem;
  run: TaskRunner<T>;
}

export interface SchedulerProgressUpdate {
  moduleId: string;
  moduleName: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  completedCount: number;
  totalCount: number;
  percent: number;
}

export interface SchedulerOptions {
  scanId: string;
  maxConcurrency?: number;
  signal?: AbortSignal;
  onProgress?: (progress: SchedulerProgressUpdate) => void;
}

export class TaskScheduler {
  private scanId: string;
  private maxConcurrency: number;
  private signal?: AbortSignal;
  private onProgress?: (progress: SchedulerProgressUpdate) => void;

  constructor(options: SchedulerOptions) {
    this.scanId = options.scanId;
    this.maxConcurrency = Math.max(1, options.maxConcurrency ?? 3);
    this.signal = options.signal;
    this.onProgress = options.onProgress;
  }

  async executeAll(tasks: ScheduledTask[]): Promise<Record<string, CollectionResult<unknown>>> {
    const results: Record<string, CollectionResult<unknown>> = {};
    const totalCount = tasks.length;
    let completedCount = 0;

    // Check if scan is already aborted
    if (this.signal?.aborted) {
      for (const task of tasks) {
        results[task.planItem.id] = this.createAbortedResult(task.planItem, 'Scan cancelled before execution');
      }
      return results;
    }

    // Partition tasks: standard tasks vs heavy tasks (e.g. axe-core)
    const standardTasks = tasks.filter((t) => !t.planItem.heavy);
    const heavyTasks = tasks.filter((t) => t.planItem.heavy);

    // 1. Execute standard tasks with bounded concurrency
    const taskQueue = [...standardTasks];
    const inFlight = new Set<Promise<void>>();

    const runNext = async (task: ScheduledTask): Promise<void> => {
      if (this.signal?.aborted) {
        results[task.planItem.id] = this.createAbortedResult(task.planItem, 'Scan cancelled during execution');
        completedCount++;
        this.emitProgress(task.planItem, 'skipped', completedCount, totalCount);
        return;
      }

      this.emitProgress(task.planItem, 'running', completedCount, totalCount);

      const result = await this.executeTaskWithGuards(task);
      results[task.planItem.id] = result;
      completedCount++;

      this.emitProgress(
        task.planItem,
        result.status === 'failed' ? 'failed' : 'completed',
        completedCount,
        totalCount,
      );
    };

    while (taskQueue.length > 0 || inFlight.size > 0) {
      if (this.signal?.aborted) {
        // Drain pending queue as skipped
        while (taskQueue.length > 0) {
          const task = taskQueue.shift()!;
          results[task.planItem.id] = this.createAbortedResult(task.planItem, 'Scan cancelled by user');
          completedCount++;
        }
        break;
      }

      while (taskQueue.length > 0 && inFlight.size < this.maxConcurrency) {
        const task = taskQueue.shift()!;
        const promise = runNext(task).finally(() => {
          inFlight.delete(promise);
        });
        inFlight.add(promise);
      }

      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      }
    }

    // Await all standard in-flight completions
    await Promise.allSettled(Array.from(inFlight));

    // 2. Execute heavy tasks sequentially (concurrency = 1) to eliminate DOM thrashing
    for (const heavyTask of heavyTasks) {
      if (this.signal?.aborted) {
        results[heavyTask.planItem.id] = this.createAbortedResult(heavyTask.planItem, 'Scan cancelled before heavy task');
        completedCount++;
        this.emitProgress(heavyTask.planItem, 'skipped', completedCount, totalCount);
        continue;
      }

      this.emitProgress(heavyTask.planItem, 'running', completedCount, totalCount);
      const result = await this.executeTaskWithGuards(heavyTask);
      results[heavyTask.planItem.id] = result;
      completedCount++;
      this.emitProgress(
        heavyTask.planItem,
        result.status === 'failed' ? 'failed' : 'completed',
        completedCount,
        totalCount,
      );
    }

    return results;
  }

  private async executeTaskWithGuards(task: ScheduledTask): Promise<CollectionResult<unknown>> {
    const { planItem, run } = task;
    let attempt = 0;
    const maxAttempts = 1 + (planItem.retryCount || 0);

    while (attempt < maxAttempts) {
      attempt++;
      const childController = new AbortController();

      const onParentAbort = () => {
        childController.abort(this.signal?.reason || new Error('Scan cancelled by user'));
      };

      if (this.signal) {
        this.signal.addEventListener('abort', onParentAbort, { once: true });
      }

      let timerId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
          const timeoutErr = new Error(`Module execution exceeded timeout of ${planItem.timeoutMs}ms`);
          childController.abort(timeoutErr);
          reject(timeoutErr);
        }, planItem.timeoutMs);
      });

      try {
        const result = await Promise.race([
          run({
            scanId: this.scanId,
            moduleId: planItem.id,
            signal: childController.signal,
          }),
          timeoutPromise,
        ]);

        clearTimeout(timerId);
        if (this.signal) {
          this.signal.removeEventListener('abort', onParentAbort);
        }

        return this.normalizeResult(result, planItem);
      } catch (err: any) {
        clearTimeout(timerId);
        if (this.signal) {
          this.signal.removeEventListener('abort', onParentAbort);
        }

        // If parent scan is cancelled, abort immediately without retrying
        if (this.signal?.aborted) {
          return this.createAbortedResult(planItem, 'Scan cancelled during execution');
        }

        // If retries remain, back off briefly
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
          continue;
        }

        // Return isolated failure result
        const isTimeout = childController.signal.aborted && /timeout/i.test(childController.signal.reason?.message || '');
        return this.createFailureResult(planItem, err?.message || 'Module execution threw unexpected error', isTimeout);
      }
    }

    return this.createFailureResult(planItem, 'Exhausted retry attempts', false);
  }

  private normalizeResult(result: CollectionResult<unknown>, planItem: ModulePlanItem): CollectionResult<unknown> {
    if (!result) {
      return this.createFailureResult(planItem, 'Collector returned undefined or null result', false);
    }

    return {
      module: planItem.id,
      status: result.status || 'completed',
      collectedAt: result.collectedAt || Date.now(),
      data: result.data ?? null,
      coverage: {
        expected: planItem.expectedChecks,
        collected: result.coverage?.collected ?? (result.data ? planItem.expectedChecks : 0),
        unavailable: result.coverage?.unavailable ?? (result.data ? 0 : planItem.expectedChecks),
        supported: result.coverage?.supported ?? true,
        message: result.coverage?.message,
      },
      limitations: Array.from(new Set([...(planItem.limitations || []), ...(result.limitations || [])])),
      errors: result.errors || [],
      sources: result.sources || ['DOM'],
    };
  }

  private createFailureResult(planItem: ModulePlanItem, errorMsg: string, isTimeout: boolean): CollectionResult<unknown> {
    return {
      module: planItem.id,
      status: 'failed',
      collectedAt: Date.now(),
      data: null,
      coverage: {
        expected: planItem.expectedChecks,
        collected: 0,
        unavailable: planItem.expectedChecks,
        supported: true,
        message: isTimeout ? 'Execution timed out' : errorMsg,
      },
      limitations: planItem.limitations || [],
      errors: [errorMsg],
      sources: ['Orchestrator'],
    };
  }

  private createAbortedResult(planItem: ModulePlanItem, reason: string): CollectionResult<unknown> {
    return {
      module: planItem.id,
      status: 'skipped',
      collectedAt: Date.now(),
      data: null,
      coverage: {
        expected: planItem.expectedChecks,
        collected: 0,
        unavailable: planItem.expectedChecks,
        supported: true,
        message: reason,
      },
      limitations: planItem.limitations || [],
      errors: [reason],
      sources: ['CancellationController'],
    };
  }

  private emitProgress(
    planItem: ModulePlanItem,
    status: 'running' | 'completed' | 'failed' | 'skipped',
    completedCount: number,
    totalCount: number,
  ): void {
    if (this.onProgress) {
      const percent = totalCount > 0 ? Math.min(100, Math.round((completedCount / totalCount) * 100)) : 0;
      this.onProgress({
        moduleId: planItem.id,
        moduleName: planItem.name,
        status,
        completedCount,
        totalCount,
        percent,
      });
    }
  }
}
