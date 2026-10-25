/**
 * Background clash jobs (audit issue 2.1).
 *
 * `POST /api/projects/{id}/clashes/check` is a single synchronous request that can run for
 * tens of seconds on a large model. The additive job API avoids that:
 *
 *   POST /api/projects/{id}/clashes/jobs            -> 202 {job_id, status}
 *   GET  /api/projects/{id}/clashes/jobs/{job_id}   -> {status, progress, result, error}
 *
 * This module is deliberately framework-free: the API calls, the terminal-state predicate and
 * the polling loop are all plain functions so they can be unit-tested without a DOM.
 */

import { apiFetch, buildApiError } from './api';
import type {
  ClashCheckResponse,
  ClashJobProgress,
  ClashJobStartResponse,
  ClashJobStatus,
  ClashJobStatusValue,
} from '../types/ifc';

/** The inspector polls at this cadence (design: every 500 ms). */
export const CLASH_JOB_POLL_INTERVAL_MS = 500;

const TERMINAL_STATUSES: ReadonlySet<string> = new Set<ClashJobStatusValue>([
  'succeeded',
  'failed',
]);

/** A job id / route the server does not know (404 or 405): fall back to the sync route once. */
export class ClashJobUnavailableError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Clash job endpoint is unavailable (HTTP ${status})`);
    this.name = 'ClashJobUnavailableError';
    this.status = status;
  }
}

/** The job finished with `status: failed`; `message` is the server's reason. */
export class ClashJobFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClashJobFailedError';
  }
}

export function isTerminal(status: string | undefined | null): boolean {
  return typeof status === 'string' && TERMINAL_STATUSES.has(status);
}

function jobsUrl(projectId: string, jobId?: string): string {
  const base = `/api/projects/${projectId}/clashes/jobs`;
  return jobId ? `${base}/${jobId}` : base;
}

async function readJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/** Normalise a poll payload so a missing/partial `progress` cannot crash the UI. */
export function normalizeClashJobStatus(raw: unknown): ClashJobStatus {
  const body = (raw ?? {}) as Partial<ClashJobStatus> & Record<string, unknown>;
  const progress = (body.progress ?? {}) as Partial<ClashJobProgress>;
  return {
    job_id: typeof body.job_id === 'string' ? body.job_id : '',
    status: (body.status as ClashJobStatusValue) ?? 'queued',
    progress: {
      phase: progress.phase,
      checked: Number(progress.checked ?? 0) || 0,
      total: Number(progress.total ?? 0) || 0,
    },
    result: (body.result as ClashCheckResponse | null) ?? null,
    error: typeof body.error === 'string' ? body.error : null,
  };
}

/** Start a background clash check. Throws `ClashJobUnavailableError` on 404/405. */
export async function startClashJob(
  projectId: string,
  tolerance: number,
  modelIds?: string[]
): Promise<ClashJobStartResponse> {
  const res = await apiFetch(jobsUrl(projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tolerance, model_ids: modelIds })
  });

  if (res.status === 404 || res.status === 405) {
    throw new ClashJobUnavailableError(res.status);
  }
  const body = await readJson(res);
  if (!res.ok) {
    throw buildApiError(body, res.status, res.statusText, 'Could not start the clash check');
  }
  const start = body as ClashJobStartResponse | null;
  if (!start || typeof start.job_id !== 'string' || !start.job_id) {
    throw new Error('The clash job endpoint returned no job id');
  }
  return start;
}

/** Read one job snapshot. Throws `ClashJobUnavailableError` on 404/405. */
export async function pollClashJob(projectId: string, jobId: string): Promise<ClashJobStatus> {
  const res = await apiFetch(jobsUrl(projectId, jobId));
  if (res.status === 404 || res.status === 405) {
    throw new ClashJobUnavailableError(res.status);
  }
  const body = await readJson(res);
  if (!res.ok) {
    throw buildApiError(body, res.status, res.statusText, 'Could not read the clash job');
  }
  return normalizeClashJobStatus(body);
}

export interface WaitForClashJobOptions {
  /** Poll cadence in ms. Defaults to 500. */
  intervalMs?: number;
  /** Aborts polling (unmount / project change). */
  signal?: AbortSignal;
  /** Called with every snapshot so the UI can show live progress. */
  onProgress?: (status: ClashJobStatus) => void;
  /** Test seams. */
  poll?: (projectId: string, jobId: string) => Promise<ClashJobStatus>;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function abortError(): Error {
  const error = new Error('Clash job polling was aborted');
  error.name = 'AbortError';
  return error;
}

/**
 * Poll until the job is terminal and resolve with its result.
 *
 * * `succeeded` -> `ClashCheckResponse` (throws if the server sent no result).
 * * `failed`    -> `ClashJobFailedError` carrying the server's message.
 * * 404/405     -> `ClashJobUnavailableError` so the caller can retry synchronously once.
 */
export async function waitForClashJob(
  projectId: string,
  jobId: string,
  options: WaitForClashJobOptions = {}
): Promise<ClashCheckResponse> {
  const {
    intervalMs = CLASH_JOB_POLL_INTERVAL_MS,
    signal,
    onProgress,
    poll = pollClashJob,
    sleep = defaultSleep,
  } = options;

  for (;;) {
    if (signal?.aborted) throw abortError();
    const status = await poll(projectId, jobId);
    onProgress?.(status);

    if (isTerminal(status.status)) {
      if (status.status === 'failed') {
        throw new ClashJobFailedError(
          status.error || 'The clash check failed. See the server log for details.'
        );
      }
      if (!status.result) {
        throw new ClashJobFailedError('The clash check finished without a result.');
      }
      return status.result;
    }
    if (signal?.aborted) throw abortError();
    await sleep(intervalMs, signal);
  }
}
