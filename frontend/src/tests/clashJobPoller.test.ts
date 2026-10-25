/**
 * Audit issue 2.1 - the clash inspector must poll a background job, not block on one request.
 *
 * These are pure tests of `services/clashJob.ts`: the polling loop is driven with an injected
 * `poll`/`sleep` so no timers or network are involved, plus the two HTTP entry points against a
 * stubbed `fetch` for the 404/409 branches the UI's fallback depends on.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLASH_JOB_POLL_INTERVAL_MS,
  ClashJobFailedError,
  ClashJobUnavailableError,
  isTerminal,
  normalizeClashJobStatus,
  pollClashJob,
  startClashJob,
  waitForClashJob
} from '../services/clashJob';
import { setApiToken } from '../services/api';
import type { ClashCheckResponse, ClashJobStatus } from '../types/ifc';

function status(
  value: ClashJobStatus['status'],
  checked = 0,
  total = 0,
  extra: Partial<ClashJobStatus> = {}
): ClashJobStatus {
  return {
    job_id: 'job-1',
    status: value,
    progress: { phase: value === 'succeeded' ? 'done' : 'extracting', checked, total },
    result: null,
    error: null,
    ...extra
  };
}

const RESULT = {
  total_clashes: 2,
  hard_clashes: 1,
  clearance_clashes: 1,
  tolerance: 0.05,
  clashes: [],
  duration_ms: 12,
  elements_checked: 141,
  geometry_failures: 0,
  sampled: false
} satisfies ClashCheckResponse;

describe('isTerminal', () => {
  it('only treats succeeded/failed as terminal', () => {
    expect(isTerminal('queued')).toBe(false);
    expect(isTerminal('running')).toBe(false);
    expect(isTerminal('succeeded')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal(undefined)).toBe(false);
    expect(isTerminal(null)).toBe(false);
  });
});

describe('normalizeClashJobStatus', () => {
  it('never lets a partial payload crash the progress UI', () => {
    const normalized = normalizeClashJobStatus({ job_id: 'j', status: 'running' });
    expect(normalized.job_id).toBe('j');
    expect(normalized.status).toBe('running');
    expect(normalized.progress).toEqual({ phase: undefined, checked: 0, total: 0 });
    expect(normalized.result).toBeNull();
    expect(normalized.error).toBeNull();
  });
});

describe('waitForClashJob', () => {
  it('polls at the documented cadence and resolves with the result', async () => {
    const snapshots = [status('running', 20, 141), status('running', 120, 141), status('succeeded', 141, 141, { result: RESULT })];
    const poll = vi.fn(async () => snapshots.shift() as ClashJobStatus);
    const sleep = vi.fn(async () => undefined);
    const onProgress = vi.fn();

    const result = await waitForClashJob('p1', 'job-1', { poll, sleep, onProgress });

    expect(result).toBe(RESULT);
    expect(poll).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    // ~500 ms between polls, as designed.
    expect(sleep).toHaveBeenCalledWith(CLASH_JOB_POLL_INTERVAL_MS, undefined);
    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress.mock.calls.map(([s]) => s.status)).toEqual([
      'running',
      'running',
      'succeeded'
    ]);
  });

  it('rejects with the server message when the job fails', async () => {
    const poll = vi.fn(async () => status('failed', 0, 0, { error: 'Clash check failed (RuntimeError).' }));
    await expect(waitForClashJob('p1', 'job-1', { poll, sleep: async () => undefined })).rejects.toBeInstanceOf(
      ClashJobFailedError
    );
    await expect(
      waitForClashJob('p1', 'job-1', { poll, sleep: async () => undefined })
    ).rejects.toThrow('Clash check failed (RuntimeError).');
  });

  it('does not claim a result when a succeeded job carries none', async () => {
    const poll = vi.fn(async () => status('succeeded', 1, 1));
    await expect(
      waitForClashJob('p1', 'job-1', { poll, sleep: async () => undefined })
    ).rejects.toThrow(/without a result/);
  });

  it('stops polling as soon as the signal is aborted', async () => {
    const controller = new AbortController();
    const poll = vi.fn(async () => {
      controller.abort();
      return status('running', 1, 10);
    });
    const sleep = vi.fn(async () => undefined);

    await expect(
      waitForClashJob('p1', 'job-1', { poll, sleep, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(poll).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('treats a 404 mid-job as endpoint unavailability so the caller can fall back once', async () => {
    const poll = vi.fn(async () => {
      throw new ClashJobUnavailableError(404);
    });
    await expect(
      waitForClashJob('p1', 'job-1', { poll, sleep: async () => undefined })
    ).rejects.toBeInstanceOf(ClashJobUnavailableError);
  });
});

describe('clash job HTTP entry points', () => {
  beforeEach(() => {
    setApiToken('test-token');
  });

  afterEach(() => {
    setApiToken(null);
    vi.unstubAllGlobals();
  });

  it('startClashJob posts the tolerance and returns the job id', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ job_id: 'abc', status: 'queued' }), {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const start = await startClashJob('p1', 0.05);

    expect(start).toEqual({ job_id: 'abc', status: 'queued' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/projects/p1/clashes/jobs');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ tolerance: 0.05, model_ids: undefined });
  });

  it('startClashJob surfaces a 409 as an ordinary error (one job per project)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: 'A clash check is already running for this project.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );

    await expect(startClashJob('p1', 0.05)).rejects.toThrow(/already running/i);
  });

  it('pollClashJob maps 404 and 405 to ClashJobUnavailableError', async () => {
    for (const code of [404, 405]) {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify({ detail: 'no' }), { status: code }))
      );
      await expect(pollClashJob('p1', 'job-1')).rejects.toMatchObject({
        name: 'ClashJobUnavailableError',
        status: code
      });
    }
  });

  it('pollClashJob normalises a live snapshot', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            job_id: 'job-1',
            status: 'running',
            progress: { phase: 'comparing', checked: 200, total: 10011 },
            result: null,
            error: null
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );

    await expect(pollClashJob('p1', 'job-1')).resolves.toMatchObject({
      status: 'running',
      progress: { phase: 'comparing', checked: 200, total: 10011 }
    });
  });
});
