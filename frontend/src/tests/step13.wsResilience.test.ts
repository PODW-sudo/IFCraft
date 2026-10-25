import { describe, it, expect, vi } from 'vitest';
import {
  nextReconnectDelay,
  shouldReconnect,
  Outbox,
  dispatchServerMessage
} from '../services/wsResilience';

const noJitter = () => 0.5; // (0.8 + 0.4 * 0.5) === 1.0 → exact exponential values

describe('STEP-13 reconnect policy', () => {
  it('backs off exponentially and caps at 30 s', () => {
    const delays = [0, 1, 2, 3, 4, 10].map((n) => nextReconnectDelay(n, noJitter));
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 30000]);
  });

  it('never reconnects after a clean close or a replaced session', () => {
    expect(shouldReconnect(1000)).toBe(false);
    expect(shouldReconnect(4001)).toBe(false);
    expect(shouldReconnect(1006)).toBe(true);
    expect(shouldReconnect(1011)).toBe(true);
  });
});

describe('STEP-13 outbox', () => {
  it('queues while closed and flushes in FIFO order', () => {
    const outbox = new Outbox({ maxSize: 10 });
    outbox.push({ action: 'SELECT_ELEMENT', express_id: 1 });
    outbox.push({ action: 'TRANSFORM_COMMIT', express_id: 1 });
    expect(outbox.size).toBe(2);

    const sent: unknown[] = [];
    const flushed = outbox.flush((m) => sent.push(m));

    expect(flushed).toBe(2);
    expect(outbox.size).toBe(0);
    expect(sent.map((m) => (m as { action: string }).action)).toEqual([
      'SELECT_ELEMENT',
      'TRANSFORM_COMMIT'
    ]);
  });

  it('drops the oldest stream frame on overflow but never a commit', () => {
    const outbox = new Outbox({ maxSize: 3 });
    outbox.push({ action: 'TRANSFORM_STREAM', express_id: 1, matrix: [1] });
    outbox.push({ action: 'TRANSFORM_STREAM', express_id: 1, matrix: [2] });
    outbox.push({ action: 'TRANSFORM_COMMIT', express_id: 1, matrix: [3] });
    outbox.push({ action: 'TRANSFORM_STREAM', express_id: 1, matrix: [4] }); // overflow

    const kept: string[] = [];
    outbox.flush((m) => kept.push(JSON.stringify(m)));

    expect(outbox.size).toBe(0);
    expect(kept.join('|')).toContain('"matrix":[3]');   // commit survived
    expect(kept.join('|')).not.toContain('"matrix":[1]'); // oldest stream dropped
  });
});

describe('STEP-13 server message dispatch', () => {
  it('routes COMMIT_REJECTED to the client callback', () => {
    const onCommitRejected = vi.fn();
    const handled = dispatchServerMessage(
      { type: 'COMMIT_REJECTED', express_id: 205, reason: 'Element locked by user u2' },
      { onCommitRejected }
    );

    expect(handled).toBe('COMMIT_REJECTED');
    expect(onCommitRejected).toHaveBeenCalledWith(205, 'Element locked by user u2');
  });

  it('keeps the existing message types working', () => {
    const onElementUnlocked = vi.fn();
    expect(dispatchServerMessage({ type: 'ELEMENT_UNLOCKED', express_id: 7 }, { onElementUnlocked }))
      .toBe('ELEMENT_UNLOCKED');
    expect(onElementUnlocked).toHaveBeenCalledWith(7);
  });

  it('returns UNKNOWN for unrecognised or malformed messages without throwing', () => {
    expect(dispatchServerMessage({ type: 'SOMETHING_NEW' }, {})).toBe('UNKNOWN');
    expect(dispatchServerMessage(null, {})).toBe('UNKNOWN');
    expect(dispatchServerMessage({}, {})).toBe('UNKNOWN');
  });
});
