/**
 * STEP-21 / open-issue 1.3 — a refused geometry edit must be visible.
 *
 * The wire contract is honest (`409 {"detail": {"code": "unsupported_geometry", "message": …}}`)
 * but the client used to stringify the object into `[object Object]` and only log to the
 * console. These tests pin three things:
 *   1. `api.updateElementGeometry` throws an `ApiError` with the server message and code.
 *   2. `useCadDraftingMachine.handleUpdateGeometry` publishes that reason through
 *      `services/userMessages`.
 *   3. The modify dock greys out height/thickness for non-resizable types and says why,
 *      without removing the controls for walls/columns.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import {
  ApiError,
  buildApiError,
  setApiToken,
  updateElementGeometry
} from '../services/api';
import { useCadDraftingMachine } from '../hooks/useCadDraftingMachine';
import {
  dismissAllUserMessages,
  getUserMessages
} from '../services/userMessages';
import {
  NON_RESIZABLE_GEOMETRY_HINT,
  describeGeometryEditability
} from '../services/geometryEditability';
import { GlassContextualModifyDock } from '../components/cad/GlassContextualModifyDock';
import { resetSaveStatus } from '../services/saveStatus';
import type { ElementDetails, ProjectMetadata } from '../types/ifc';

const SERVER_MESSAGE = 'IfcDoor #42 does not support parametric dimension edits';
const REFUSAL_BODY = {
  detail: { code: 'unsupported_geometry', message: SERVER_MESSAGE }
};

/** Minimal `Response` stand-in: jsdom does not ship fetch, and we only read these fields. */
function jsonResponse(body: unknown, status: number, statusText: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body
  } as unknown as Response;
}

const CURRENT_PROJECT: ProjectMetadata = {
  id: 'p1',
  name: 'AutoTest-geometry-ux',
  schema_version: 'IFC4',
  file_name: 'model.ifc',
  file_size: 1024,
  element_count: 1,
  created_at: '2026-10-25T00:00:00',
  updated_at: '2026-10-25T00:00:00'
};

function detailsFor(type: string): ElementDetails {
  return {
    express_id: 42,
    global_id: 'guid-42',
    name: `${type} 42`,
    type,
    psets: [],
    quantities: {}
  };
}

function renderDock(type: string) {
  return render(
    <GlassContextualModifyDock
      expressId={42}
      elementDetails={detailsFor(type)}
      isPinned={false}
      onTogglePin={vi.fn()}
      onStartMove={vi.fn()}
      onStartRotate={vi.fn()}
      onQuickRotate={vi.fn()}
      onStartMirror={vi.fn()}
      onStartElevate={vi.fn()}
      onStartMultiply={vi.fn()}
      onOpenSpecialModal={vi.fn()}
      onCancelInteractiveTool={vi.fn()}
      onClone={vi.fn()}
      onDelete={vi.fn()}
      onUpdateGeometry={vi.fn()}
      onAssignStorey={vi.fn()}
      onAssignMaterial={vi.fn()}
      onFocus={vi.fn()}
      onOpenInspector={vi.fn()}
      onDeselect={vi.fn()}
    />
  );
}

const WIDE_VIEWPORT = 1440;

beforeEach(() => {
  resetSaveStatus();
  dismissAllUserMessages();
  setApiToken('test-api-token');
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: WIDE_VIEWPORT
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('issue 1.3 — 409 detail is turned into a readable ApiError', () => {
  it('uses detail.message instead of stringifying the object', () => {
    const error = buildApiError(REFUSAL_BODY, 409, 'Conflict', 'Failed to update geometry');
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe(SERVER_MESSAGE);
    expect(error.message).not.toContain('[object Object]');
    expect(error.code).toBe('unsupported_geometry');
    expect(error.status).toBe(409);
  });

  it('falls back to detail.code, then statusText, then the caller message', () => {
    expect(
      buildApiError({ detail: { code: 'unsupported_geometry' } }, 409, 'Conflict', 'fallback')
        .message
    ).toBe('unsupported_geometry');
    expect(buildApiError({}, 409, 'Conflict', 'fallback').message).toBe('Conflict');
    expect(buildApiError(null, 500, '', 'Failed to update geometry').message).toBe(
      'Failed to update geometry'
    );
    expect(buildApiError({ detail: { code: 'unsupported_geometry' } }, 409, 'x', 'y').code).toBe(
      'unsupported_geometry'
    );
  });

  it('surfaces the server message and code through updateElementGeometry', async () => {
    const fetchStub = vi.fn(async () => jsonResponse(REFUSAL_BODY, 409, 'Conflict'));
    vi.stubGlobal('fetch', fetchStub);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      updateElementGeometry('p1', 42, { height: 4 })
    ).rejects.toMatchObject({
      name: 'ApiError',
      message: SERVER_MESSAGE,
      code: 'unsupported_geometry',
      status: 409
    });

    // The PATCH still goes to the documented route; only the error shaping changed.
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/projects/p1/cad/elements/42/geometry');
    expect(init.method).toBe('PATCH');
  });

  it('keeps a plain string detail working (no regression for other writers)', () => {
    const error = buildApiError({ detail: 'Project model file not found.' }, 404, 'Not Found', 'x');
    expect(error.message).toBe('Project model file not found.');
    expect(error.code).toBeUndefined();
  });
});

describe('issue 1.3 — the hook tells the user', () => {
  it('publishes the refusal reason through notifyUser and keeps the console line', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(REFUSAL_BODY, 409, 'Conflict'))
    );
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useCadDraftingMachine({
        currentProject: CURRENT_PROJECT,
        selectedExpressID: 42,
        pinnedExpressIdsRef: { current: new Set<number>() },
        loadProject: vi.fn(async () => {}),
        onSelectElement: vi.fn()
      })
    );

    await act(async () => {
      await result.current.handleUpdateGeometry(42, { height: 4 });
    });

    const messages = getUserMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].tone).toBe('error');
    expect(messages[0].text).toContain('Geometry edit refused for element #42');
    expect(messages[0].text).toContain(SERVER_MESSAGE);
    expect(messages[0].text).not.toContain('[object Object]');

    // Diagnostics are still logged, just not the only signal.
    expect(consoleError).toHaveBeenCalled();
  });

  it('reports a non-refusal failure without claiming the edit was refused', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ detail: 'Project model file not found.' }, 404, 'Not Found'))
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useCadDraftingMachine({
        currentProject: CURRENT_PROJECT,
        selectedExpressID: 42,
        pinnedExpressIdsRef: { current: new Set<number>() },
        loadProject: vi.fn(async () => {}),
        onSelectElement: vi.fn()
      })
    );

    await act(async () => {
      await result.current.handleUpdateGeometry(42, { height: 4 });
    });

    const messages = getUserMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].text).toContain('Could not update geometry for element #42');
    expect(messages[0].text).toContain('Project model file not found.');
  });
});

describe('issue 1.3 — the dock flags non-resizable selections', () => {
  it('marks walls and columns editable', () => {
    for (const type of ['IfcWall', 'IfcWallStandardCase', 'IfcColumn']) {
      const state = describeGeometryEditability(type);
      expect(state.resizable, type).toBe(true);
      expect(state.canEditHeight, type).toBe(true);
      expect(state.hint, type).toBeNull();
    }
    expect(describeGeometryEditability('IfcWallStandardCase').canEditThickness).toBe(true);
  });

  it('marks slabs, doors, windows, coverings and unknown types non-resizable', () => {
    for (const type of [
      'IfcSlab',
      'IfcDoor',
      'IfcWindow',
      'IfcCovering',
      'IfcDuctSegment',
      'IfcProduct',
      ''
    ]) {
      const state = describeGeometryEditability(type);
      expect(state.resizable, type).toBe(false);
      expect(state.canEditHeight, type).toBe(false);
      expect(state.canEditThickness, type).toBe(false);
      expect(state.hint, type).toBe(NON_RESIZABLE_GEOMETRY_HINT);
    }
  });

  it('disables height and shows the hint for a door', () => {
    const { container } = renderDock('IfcDoor');
    const height = container.querySelector(
      '[data-qa="geometry-height-btn"]'
    ) as HTMLButtonElement | null;
    expect(height).not.toBeNull();
    expect(height!.disabled).toBe(true);
    expect(height!.title).toContain('walls and columns');

    const hint = container.querySelector('[data-qa="geometry-edit-hint"]');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toBe(NON_RESIZABLE_GEOMETRY_HINT);

    // The elevation (placement) edit stays available for every type.
    const elevation = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('El:')
    ) as HTMLButtonElement | undefined;
    expect(elevation).toBeDefined();
    expect(elevation!.disabled).toBe(false);
  });

  it('keeps height and thickness editable for a wall and hides the hint', () => {
    const { container } = renderDock('IfcWall');
    const height = container.querySelector(
      '[data-qa="geometry-height-btn"]'
    ) as HTMLButtonElement | null;
    const thickness = container.querySelector(
      '[data-qa="geometry-thickness-btn"]'
    ) as HTMLButtonElement | null;
    expect(height).not.toBeNull();
    expect(thickness).not.toBeNull();
    expect(height!.disabled).toBe(false);
    expect(thickness!.disabled).toBe(false);
    expect(container.querySelector('[data-qa="geometry-edit-hint"]')).toBeNull();
  });

  it('flags a slab thickness field instead of removing it', () => {
    const { container } = renderDock('IfcSlab');
    const thickness = container.querySelector(
      '[data-qa="geometry-thickness-btn"]'
    ) as HTMLButtonElement | null;
    expect(thickness).not.toBeNull();
    expect(thickness!.disabled).toBe(true);
    expect(container.querySelector('[data-qa="geometry-edit-hint"]')!.textContent).toBe(
      NON_RESIZABLE_GEOMETRY_HINT
    );
  });
});
