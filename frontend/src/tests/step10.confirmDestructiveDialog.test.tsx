import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDestructiveDialog } from '../components/common/ConfirmDestructiveDialog';
import { DestructiveActionHost } from '../components/common/DestructiveActionHost';
import {
  getPendingDestructiveRequest,
  requestDestructiveConfirmation,
  resolveDestructiveConfirmation
} from '../services/destructiveConfirmation';
import {
  buildDeleteElementRequest,
  runDestructiveAction
} from '../services/destructiveActions';

/**
 * STEP-10 — the dialog half of the destructive gate. The spec deferred this file to STEP-27
 * (jsdom + @testing-library/react); that infrastructure has landed, so the a11y contract is
 * asserted here rather than left to a manual check.
 */

afterEach(() => {
  // Leave no dangling prompt behind for the next test.
  if (getPendingDestructiveRequest()) resolveDestructiveConfirmation(false);
});

describe('STEP-10 ConfirmDestructiveDialog', () => {
  it('is an alertdialog that names the element and starts focused on Cancel', async () => {
    const request = buildDeleteElementRequest(205, 'Basic Wall:Party Wall');

    render(<ConfirmDestructiveDialog request={request} onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('data-qa', 'confirm-destructive');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Delete element?');
    expect(screen.getByText(/Basic Wall:Party Wall/)).toBeInTheDocument();
    expect(screen.getByText(/205/)).toBeInTheDocument();

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(document.activeElement).toBe(cancel));
  });

  it('cancels on Escape without confirming', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDestructiveDialog
        request={buildDeleteElementRequest(11, 'IfcColumn')}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();

    render(
      <ConfirmDestructiveDialog
        request={buildDeleteElementRequest(11, 'IfcColumn')}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const ok = screen.getByRole('button', { name: 'Delete' });

    await waitFor(() => expect(document.activeElement).toBe(cancel));
    await user.tab();
    expect(document.activeElement).toBe(ok);
    await user.tab();
    expect(document.activeElement).toBe(cancel);
  });
});

describe('STEP-10 destructive gate end to end', () => {
  it('does not run the action when the user cancels through the mounted host', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => 'deleted');

    render(<DestructiveActionHost />);

    const outcome = runDestructiveAction(
      buildDeleteElementRequest(205, 'Basic Wall'),
      requestDestructiveConfirmation,
      action
    );

    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await expect(outcome).resolves.toEqual({ applied: false });
    expect(action).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('runs the action exactly once when the user confirms', async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => 'deleted');

    render(<DestructiveActionHost />);

    const outcome = runDestructiveAction(
      buildDeleteElementRequest(205, 'Basic Wall'),
      requestDestructiveConfirmation,
      action
    );

    await screen.findByRole('alertdialog');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await expect(outcome).resolves.toEqual({ applied: true, result: 'deleted' });
    expect(action).toHaveBeenCalledTimes(1);
  });
});
