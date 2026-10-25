import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectMetadata } from '../types/ifc';
import { SpatialContextMenu } from '../components/viewer/SpatialContextMenu';
import { DestructiveActionHost } from '../components/common/DestructiveActionHost';
import { useCadDraftingMachine } from '../hooks/useCadDraftingMachine';
import {
  getPendingDestructiveRequest,
  resolveDestructiveConfirmation
} from '../services/destructiveConfirmation';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  deleteElement: vi.fn(async () => ({ success: true, express_id: 205, message: 'Element deleted' })),
  fetchCadHistory: vi.fn(async () => ({ history: [], can_undo: false, can_redo: false })),
  undoCad: vi.fn(),
  redoCad: vi.fn()
}));

/**
 * STEP-10 Spec 10 — every delete trigger goes through `runDestructiveAction`: cancelling leaves the
 * model untouched, confirming performs exactly one delete. These are the *real* call sites, not a
 * copy of the gate.
 */

const project = {
  id: 'proj-step10',
  name: 'AutoTest-Step10',
  schema_version: 'IFC4',
  file_name: 'model.ifc',
  file_size: 1024,
  element_count: 3,
  created_at: '2026-10-25T00:00:00',
  updated_at: '2026-10-25T00:00:00'
} as ProjectMetadata;

afterEach(() => {
  if (getPendingDestructiveRequest()) resolveDestructiveConfirmation(false);
  vi.mocked(api.deleteElement).mockClear();
});

describe('STEP-10 viewport context menu delete', () => {
  it('asks for confirmation and never deletes on cancel', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClose = vi.fn();

    render(<DestructiveActionHost />);
    render(
      <SpatialContextMenu
        position={{ x: 120, y: 120 }}
        expressId={205}
        elementLabel="Basic Wall:Party Wall:1234"
        onClose={onClose}
        onFocus={vi.fn()}
        onClone={vi.fn()}
        onDelete={onDelete}
        onOpenInspector={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Delete Element/i }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Basic Wall:Party Wall:1234');
    expect(dialog).toHaveTextContent('205');
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('deletes once after confirmation', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(<DestructiveActionHost />);
    render(
      <SpatialContextMenu
        position={{ x: 120, y: 120 }}
        expressId={205}
        onClose={vi.fn()}
        onFocus={vi.fn()}
        onClone={vi.fn()}
        onDelete={onDelete}
        onOpenInspector={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Delete Element/i }));
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(onDelete).toHaveBeenCalledWith(205);
  });
});

describe('STEP-10 useCadDraftingMachine delete', () => {
  const renderMachine = () => {
    const loadProject = vi.fn(async () => undefined);
    const onSelectElement = vi.fn();
    const hook = renderHook(() =>
      useCadDraftingMachine({
        currentProject: project,
        selectedExpressID: 205,
        pinnedExpressIdsRef: { current: new Set<number>() },
        loadProject,
        onSelectElement
      })
    );
    return { ...hook, loadProject, onSelectElement };
  };

  it('exposes a pure executor that does not prompt and surfaces failures', async () => {
    const { result } = renderMachine();

    // No dialog host mounted and no prompt requested: the executor just runs.
    const outcome = await result.current.handleDeleteElement(205);

    expect(outcome).toEqual({ ok: true });
    expect(api.deleteElement).toHaveBeenCalledTimes(1);
  });

  it('requestDeleteElement gates the executor behind the confirmation dialog', async () => {
    const user = userEvent.setup();
    const { result } = renderMachine();

    render(<DestructiveActionHost />);

    const pending = result.current.requestDeleteElement(205, 'Basic Wall');

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Basic Wall');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await expect(pending).resolves.toEqual({ applied: false });
    expect(api.deleteElement).not.toHaveBeenCalled();

    vi.mocked(api.deleteElement).mockClear();

    const confirmed = result.current.requestDeleteElement(205, 'Basic Wall');
    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await expect(confirmed).resolves.toEqual({ applied: true, result: { ok: true } });
    expect(api.deleteElement).toHaveBeenCalledTimes(1);
  });

  it('reports a rejected delete instead of swallowing it', async () => {
    vi.mocked(api.deleteElement).mockRejectedValueOnce(new Error('element is pinned'));
    // The executor logs the failure as well as surfacing it; keep the suite output clean.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderMachine();

    const outcome = await result.current.handleDeleteElement(205);

    expect(outcome).toEqual({ ok: false, error: 'element is pinned' });
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
