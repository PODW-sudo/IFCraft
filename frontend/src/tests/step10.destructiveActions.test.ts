import { describe, it, expect, vi } from 'vitest';
import {
  buildDeleteElementRequest,
  runDestructiveAction
} from '../services/destructiveActions';

describe('STEP-10 destructive-action gate', () => {
  it('does not perform the action when the user cancels', async () => {
    const action = vi.fn(async () => 'done');
    const confirm = vi.fn(() => false);

    const outcome = await runDestructiveAction(buildDeleteElementRequest(205, 'Basic Wall:Party Wall'), confirm, action);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();
    expect(outcome).toEqual({ applied: false });
  });

  it('performs the action exactly once when confirmed', async () => {
    const action = vi.fn(async () => 'done');
    const confirm = vi.fn(() => true);

    const outcome = await runDestructiveAction(buildDeleteElementRequest(205, 'Basic Wall'), confirm, action);

    expect(action).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ applied: true, result: 'done' });
  });

  it('propagates a failing action instead of reporting success', async () => {
    const action = vi.fn(async () => {
      throw new Error('500 from backend');
    });

    await expect(
      runDestructiveAction(buildDeleteElementRequest(205, 'Basic Wall'), () => true, action)
    ).rejects.toThrow('500 from backend');
  });

  it('names the element in the request so the prompt is never anonymous', () => {
    const req = buildDeleteElementRequest(205, 'Basic Wall:Party Wall:1234');

    expect(req.message).toContain('Basic Wall:Party Wall:1234');
    expect(req.message).toContain('205');
    expect(req.confirmLabel).toBe('Delete');
    expect(req.kind).toBe('delete-element');
  });
});
