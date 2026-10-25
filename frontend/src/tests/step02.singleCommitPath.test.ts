/**
 * STEP-02 — one commit path per transform (F-002 duplicate half, F-018).
 *
 * Canonical upstream test: `docs/audit-2026-10/tests/backend/test_step02_single_commit_path.py`.
 * Its first assertion parses `handleTransformEnd` textually, so the same contract is ported here
 * against the real module. The behavioural cases then cover what the source scan cannot:
 * exactly one destination per drag, and a rollback + visible error when the write is refused.
 *
 * Pre-implementation record (2026-10-25, before the hook was changed):
 *   FAIL: on a connected session a drag release issues 1 WebSocket commit AND 1 HTTP POST (2 writes)
 *   FAIL: a refused POST leaves the mesh at the dragged matrix and only console.errors
 *   FAIL: ThreeViewport never records a pre-drag matrix, so nothing can be restored
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGizmoTransform } from '../hooks/useGizmoTransform';
import { getSaveSnapshot, resetSaveStatus } from '../services/saveStatus';
import { dismissAllUserMessages, getUserMessages } from '../services/userMessages';
import {
  capturePreDragMatrix,
  registerSceneMatrixHandle,
  resetMeshMatrixBridge
} from '../services/meshMatrixBridge';
import type { CollaborationClient } from '../services/collaboration';
import type { ProjectMetadata } from '../types/ifc';

/** `?raw` keeps the contract checks free of node typings (the app tsconfig has no @types/node). */
const SOURCES = import.meta.glob('../{hooks/useGizmoTransform.ts,components/viewer/ThreeViewport.tsx}', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

const HOOK_SRC = SOURCES['../hooks/useGizmoTransform.ts'];
const VIEWPORT_SRC = SOURCES['../components/viewer/ThreeViewport.tsx'];

const PROJECT = { id: 'p1', name: 'STEP-02 project' } as unknown as ProjectMetadata;

const PRE_DRAG = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const DRAGGED = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2.5, 0, 1.75, 1];

/** The smallest thing the hook may call: the WS commit. */
function fakeCollab() {
  const commitTransform = vi.fn();
  return { commitTransform, client: { commitTransform } as unknown as CollaborationClient, commitTransformSpy: commitTransform };
}

function refTo(client: CollaborationClient | null) {
  return { current: client } as unknown as React.RefObject<CollaborationClient | null>;
}

/** A stand-in for ThreeViewport's mesh map: one mesh whose matrix the bridge can read and write. */
function installFakeScene(initial: number[]) {
  const mesh = { matrix: initial.slice() };
  registerSceneMatrixHandle({
    read: () => mesh.matrix.slice(),
    write: (_expressID: number, matrix: number[]) => {
      mesh.matrix = matrix.slice();
      return true;
    }
  });
  return mesh;
}

function restResponse(init: { ok: boolean; status?: number; body?: unknown }) {
  return {
    ok: init.ok,
    status: init.status ?? (init.ok ? 200 : 500),
    statusText: init.ok ? 'OK' : 'Conflict',
    json: async () => init.body ?? {}
  } as unknown as Response;
}

const handleSource = () => {
  const start = HOOK_SRC.indexOf('handleTransformEnd = useCallback(');
  expect(start, 'could not locate handleTransformEnd in useGizmoTransform.ts').toBeGreaterThan(-1);
  const end = HOOK_SRC.indexOf('\n  );', start);
  expect(end, 'could not delimit handleTransformEnd').toBeGreaterThan(start);
  return HOOK_SRC.slice(start, end);
};

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetMeshMatrixBridge();
  resetSaveStatus();
  dismissAllUserMessages();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  resetMeshMatrixBridge();
});

describe('STEP-02 single commit path — source contract', () => {
  it('handleTransformEnd performs exactly one persistence call', () => {
    const body = handleSource();

    const wsCommits = (body.match(/commitTransform\s*\(/g) ?? []).length;
    const httpPosts = (body.match(/fetch\s*\(/g) ?? []).length;

    expect(
      wsCommits + httpPosts,
      `handleTransformEnd performs ${wsCommits} WebSocket commit(s) and ${httpPosts} HTTP post(s). ` +
        'Both rewrite the whole model file, so a drag release writes it twice, concurrently, with no lock.'
    ).toBe(1);
  });

  it('keeps the WebSocket path, because it is the one that carries the lock and the audit row', () => {
    const body = handleSource();
    expect(body).toContain('commitTransform');
    // The REST route performs no lock check and writes no edit_history row client-side.
    expect(body).not.toMatch(/fetch\s*\(/);
  });

  it('routes the single-user fallback through one named helper instead of an inline second path', () => {
    expect(HOOK_SRC).toContain('persistPlacementViaRest(');
    // The helper, not the callback body, owns the request.
    expect(handleSource()).not.toMatch(/method:\s*'POST'/);
  });

  it('never console.errors a persistence failure and leaves it at that', () => {
    expect(handleSource()).not.toContain('console.error');
    expect(handleSource()).toMatch(/restoreSceneMatrix\s*\(/);
    expect(handleSource()).toMatch(/notifyUser\s*\(/);
  });

  it('the viewport records the pre-drag matrix and registers the matrix handle', () => {
    expect(VIEWPORT_SRC, 'ThreeViewport source not found').toBeTruthy();
    expect(VIEWPORT_SRC).toContain('registerSceneMatrixHandle(');
    expect(VIEWPORT_SRC).toContain('capturePreDragMatrix(');
  });
});

describe('STEP-02 single commit path — one destination per drag', () => {
  it('collaborating: one WebSocket commit and no HTTP request', async () => {
    const collab = fakeCollab();
    const mesh = installFakeScene(DRAGGED);
    fetchSpy.mockResolvedValue(restResponse({ ok: true }));

    const { result } = renderHook(() =>
      useGizmoTransform({ currentProject: PROJECT, collabClientRef: refTo(collab.client) })
    );

    await act(async () => {
      await result.current.handleTransformEnd(205, DRAGGED);
    });

    expect(collab.commitTransform).toHaveBeenCalledTimes(1);
    expect(collab.commitTransform).toHaveBeenCalledWith(205, DRAGGED);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mesh.matrix).toEqual(DRAGGED);
    expect(getSaveSnapshot().status).toBe('saved');
  });

  it('a client whose socket is down still commits over WS (it is buffered, not lost)', async () => {
    // Choosing REST here would write the file twice: once now, once when the outbox flushes.
    const collab = fakeCollab();
    Object.defineProperty(collab.client, 'connected', { value: false });
    fetchSpy.mockResolvedValue(restResponse({ ok: true }));

    const { result } = renderHook(() =>
      useGizmoTransform({ currentProject: PROJECT, collabClientRef: refTo(collab.client) })
    );

    await act(async () => {
      await result.current.handleTransformEnd(205, DRAGGED);
    });

    expect(collab.commitTransform).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('single-user: one REST placement POST to the documented route', async () => {
    installFakeScene(DRAGGED);
    fetchSpy.mockResolvedValue(restResponse({ ok: true }));

    const { result } = renderHook(() =>
      useGizmoTransform({ currentProject: PROJECT, collabClientRef: refTo(null) })
    );

    await act(async () => {
      await result.current.handleTransformEnd(205, DRAGGED);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/projects/p1/elements/205/placement');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ matrix: DRAGGED });
    expect(getSaveSnapshot().status).toBe('saved');
  });

  it('does nothing without an open project', async () => {
    const collab = fakeCollab();
    const { result } = renderHook(() =>
      useGizmoTransform({ currentProject: null, collabClientRef: refTo(collab.client) })
    );

    await act(async () => {
      await result.current.handleTransformEnd(205, DRAGGED);
    });

    expect(collab.commitTransform).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('STEP-02 single commit path — failure restores the mesh', () => {
  it('a 409 from the REST route puts the element back and shows the reason', async () => {
    const mesh = installFakeScene(DRAGGED); // the gizmo already moved it on screen
    capturePreDragMatrix(205, PRE_DRAG); // ...and the viewport remembered where it started
    fetchSpy.mockResolvedValue(
      restResponse({ ok: false, status: 409, body: { detail: 'Element is locked by another user.' } })
    );

    const { result } = renderHook(() =>
      useGizmoTransform({ currentProject: PROJECT, collabClientRef: refTo(null) })
    );

    await act(async () => {
      await result.current.handleTransformEnd(205, DRAGGED);
    });

    expect(mesh.matrix).toEqual(PRE_DRAG);

    const messages = getUserMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].tone).toBe('error');
    expect(messages[0].text).toContain('Element is locked by another user.');
    expect(messages[0].text.toLowerCase()).toContain('put back');

    expect(getSaveSnapshot().status).toBe('error');
    expect(getSaveSnapshot().error).toContain('Element is locked by another user.');
  });

  it('a network error also rolls back instead of leaving a phantom move', async () => {
    const mesh = installFakeScene(DRAGGED);
    capturePreDragMatrix(205, PRE_DRAG);
    fetchSpy.mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() =>
      useGizmoTransform({ currentProject: PROJECT, collabClientRef: refTo(null) })
    );

    await act(async () => {
      await result.current.handleTransformEnd(205, DRAGGED);
    });

    expect(mesh.matrix).toEqual(PRE_DRAG);
    expect(getUserMessages()[0].tone).toBe('error');
    expect(getUserMessages()[0].text).toContain('Failed to fetch');
  });

  it('a throwing commitTransform (e.g. session torn down mid-drag) also rolls back', async () => {
    const mesh = installFakeScene(DRAGGED);
    capturePreDragMatrix(205, PRE_DRAG);
    const commitTransform = vi.fn(() => {
      throw new Error('socket closed');
    });

    const { result } = renderHook(() =>
      useGizmoTransform({
        currentProject: PROJECT,
        collabClientRef: refTo({ commitTransform } as unknown as CollaborationClient)
      })
    );

    await act(async () => {
      await result.current.handleTransformEnd(205, DRAGGED);
    });

    expect(commitTransform).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mesh.matrix).toEqual(PRE_DRAG);
    expect(getUserMessages()[0].text).toContain('socket closed');
  });

  it('keeps the moved mesh when the write succeeds, so a rollback is never cosmetic noise', async () => {
    const mesh = installFakeScene(DRAGGED);
    capturePreDragMatrix(205, PRE_DRAG);
    fetchSpy.mockResolvedValue(restResponse({ ok: true }));

    const { result } = renderHook(() =>
      useGizmoTransform({ currentProject: PROJECT, collabClientRef: refTo(null) })
    );

    await act(async () => {
      await result.current.handleTransformEnd(205, DRAGGED);
    });

    expect(mesh.matrix).toEqual(DRAGGED);
    expect(getUserMessages()).toHaveLength(0);
  });

  it('rolls back only the element that failed', async () => {
    const mesh = installFakeScene(DRAGGED);
    capturePreDragMatrix(205, PRE_DRAG);
    const other = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 9, 9, 9, 1];
    capturePreDragMatrix(300, other);
    fetchSpy.mockResolvedValue(restResponse({ ok: false, status: 500, body: { detail: 'boom' } }));

    const { result } = renderHook(() =>
      useGizmoTransform({ currentProject: PROJECT, collabClientRef: refTo(null) })
    );

    await act(async () => {
      await result.current.handleTransformEnd(205, DRAGGED);
    });

    expect(mesh.matrix).toEqual(PRE_DRAG);
    // The other element's captured matrix is untouched by this commit.
    const { readPreDragMatrix } = await import('../services/meshMatrixBridge');
    expect(readPreDragMatrix(300)).toEqual(other);
  });
});
