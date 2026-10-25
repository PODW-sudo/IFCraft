/**
 * STEP-13 — WebSocket resilience primitives.
 *
 * Pure module: no DOM, no `WebSocket` global, no timers at module scope, no React. That keeps
 * the reconnect policy, the offline outbox and the server-message dispatch testable in node and
 * lets `services/collaboration.ts` stay a thin transport around it.
 *
 * Spec 6 — `dispatchServerMessage`
 * Spec 7 — `nextReconnectDelay`
 * Spec 8 — `shouldReconnect`
 * Spec 9 — `Outbox`
 */

import type { CollaborationCallbacks } from './collaboration';

export const MAX_RECONNECT_DELAY_MS = 30000;
export const BASE_RECONNECT_DELAY_MS = 500;

/** Close code the backend uses when the same `user_id` joins from a newer socket (Spec 5). */
export const SESSION_REPLACED_CLOSE_CODE = 4001;
/** Normal closure - the client asked for it (project switch, unmount). */
export const CLEAN_CLOSE_CODE = 1000;
/**
 * Issue 3.5 - policy violation: the handshake or a frame was refused (a WS `JOIN` without a
 * valid session token, or a foreign Origin). Retrying with the same credentials cannot help.
 */
export const POLICY_VIOLATION_CLOSE_CODE = 1008;

/**
 * Spec 7 — `min(30 s, 500 ms * 2**attempt)` with ±20 % jitter. Monotonic in `attempt` up to the
 * cap, so a long outage cannot turn into a reconnect storm.
 */
export function nextReconnectDelay(attempt: number, random: () => number = Math.random): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  const exponential = BASE_RECONNECT_DELAY_MS * 2 ** safeAttempt;
  const capped = Math.min(MAX_RECONNECT_DELAY_MS, exponential);
  const jitter = 0.8 + 0.4 * random();
  return capped * jitter;
}

/** Spec 8 — do not retry a clean close (1000), a replaced session (4001) or a policy refusal. */
export function shouldReconnect(closeCode: number | undefined | null): boolean {
  if (closeCode === CLEAN_CLOSE_CODE || closeCode === SESSION_REPLACED_CLOSE_CODE) return false;
  if (closeCode === POLICY_VIOLATION_CLOSE_CODE) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------------------------

export interface OutboxMessage {
  action?: string;
  [key: string]: unknown;
}

export interface OutboxOptions {
  /** Spec 9 — bounded buffer while the socket is not open. */
  maxSize?: number;
}

/**
 * Messages that must never be dropped on overflow: losing a commit silently desynchronises the
 * server (F-018), losing a selection loses the soft lock.
 */
const PROTECTED_ACTIONS = new Set(['TRANSFORM_COMMIT', 'SELECT_ELEMENT', 'DESELECT_ELEMENT']);
/** The only frame type that may be evicted: the next stream frame for the same drag supersedes it. */
const COALESCABLE_ACTION = 'TRANSFORM_STREAM';

/** Spec 9 — bounded FIFO buffer; on overflow the oldest stream frame goes first. */
export class Outbox {
  private queue: OutboxMessage[] = [];
  private readonly maxSize: number;
  private droppedCount = 0;

  constructor(options: OutboxOptions = {}) {
    const requested = options.maxSize ?? 50;
    this.maxSize = Number.isFinite(requested) ? Math.max(1, Math.floor(requested)) : 50;
  }

  public get size(): number {
    return this.queue.length;
  }

  public get capacity(): number {
    return this.maxSize;
  }

  /** Number of messages discarded so far - surfaced for diagnostics, never silently swallowed. */
  public get dropped(): number {
    return this.droppedCount;
  }

  public push(message: OutboxMessage): void {
    if (this.queue.length >= this.maxSize && !this.evictOldestCoalescable()) {
      // Nothing evictable: a protected frame is never dropped, so refuse the incoming message
      // unless it is protected itself (in which case the buffer may briefly exceed the cap).
      if (!PROTECTED_ACTIONS.has(message?.action ?? '')) {
        this.droppedCount += 1;
        return;
      }
    }
    this.queue.push(message);
  }

  /** Spec 9 — FIFO delivery; returns how many messages were handed to `send`. */
  public flush(send: (message: OutboxMessage) => void): number {
    let sent = 0;
    while (this.queue.length > 0) {
      const next = this.queue[0];
      // A throwing `send` keeps the remaining messages queued instead of losing them.
      send(next);
      this.queue.shift();
      sent += 1;
    }
    return sent;
  }

  public clear(): void {
    this.queue = [];
  }

  public peek(): OutboxMessage[] {
    return [...this.queue];
  }

  private evictOldestCoalescable(): boolean {
    const index = this.queue.findIndex((message) => message?.action === COALESCABLE_ACTION);
    if (index === -1) return false;
    this.queue.splice(index, 1);
    this.droppedCount += 1;
    return true;
  }
}

// ---------------------------------------------------------------------------------------------
// Server message dispatch
// ---------------------------------------------------------------------------------------------

export type ServerMessageType =
  | 'ROOM_STATE'
  | 'USER_JOINED'
  | 'USER_LEFT'
  | 'ELEMENT_LOCKED'
  | 'ELEMENT_UNLOCKED'
  | 'LOCK_REJECTED'
  | 'REMOTE_TRANSFORM_STREAM'
  | 'REMOTE_TRANSFORM_COMMITTED'
  | 'REMOTE_PROPERTY_UPDATED'
  | 'COMMIT_REJECTED'
  | 'SESSION_REPLACED'
  | 'PING'
  | 'PONG'
  | 'ERROR';

export type HandledServerMessageType = ServerMessageType | 'UNKNOWN';

/**
 * Issue 3.3 — how a handled `PING` gets answered. Only `send` is needed: the heartbeat has no
 * UI surface and no application callback, so this is transport, not a collaboration event.
 */
export interface ServerMessageTransport {
  send: (message: Record<string, unknown>) => void;
}

function toExpressId(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.trunc(numeric);
}

function toMatrix(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const matrix = value.map((entry) => Number(entry));
  if (matrix.length !== 16 || matrix.some((entry) => !Number.isFinite(entry))) return null;
  return matrix;
}

/**
 * Spec 6 — single entry point for inbound frames: returns the type it handled so the caller can
 * log unknowns, invokes exactly one callback, and never throws on an unrecognised type or a
 * malformed payload.
 *
 * Issue 3.3 — a `PING` is answered with `PONG` through `transport` (no callback, no UI); a
 * `PONG` is liveness only and intentionally has no effect at all.
 */
export function dispatchServerMessage(
  message: unknown,
  callbacks: Partial<CollaborationCallbacks>,
  transport?: ServerMessageTransport
): HandledServerMessageType {
  if (!message || typeof message !== 'object') return 'UNKNOWN';

  const msg = message as Record<string, unknown>;
  const type = typeof msg.type === 'string' ? (msg.type as ServerMessageType) : null;
  if (!type) return 'UNKNOWN';

  const cb = callbacks ?? {};

  switch (type) {
    case 'ROOM_STATE': {
      const users = Array.isArray(msg.users) ? msg.users : [];
      const locks = msg.locks && typeof msg.locks === 'object' ? msg.locks : {};
      cb.onRoomState?.(
        users as Parameters<NonNullable<CollaborationCallbacks['onRoomState']>>[0],
        locks as Parameters<NonNullable<CollaborationCallbacks['onRoomState']>>[1]
      );
      return type;
    }
    case 'USER_JOINED': {
      const user = msg.user;
      if (!user || typeof user !== 'object') return 'UNKNOWN';
      cb.onUserJoined?.(user as Parameters<NonNullable<CollaborationCallbacks['onUserJoined']>>[0]);
      return type;
    }
    case 'USER_LEFT': {
      const userId = typeof msg.user_id === 'string' ? msg.user_id : null;
      if (!userId) return 'UNKNOWN';
      cb.onUserLeft?.(userId);
      return type;
    }
    case 'ELEMENT_LOCKED': {
      const expressId = toExpressId(msg.express_id);
      const lock = msg.lock;
      if (expressId === null || !lock || typeof lock !== 'object') return 'UNKNOWN';
      cb.onElementLocked?.(
        expressId,
        lock as Parameters<NonNullable<CollaborationCallbacks['onElementLocked']>>[1]
      );
      return type;
    }
    case 'ELEMENT_UNLOCKED': {
      const expressId = toExpressId(msg.express_id);
      if (expressId === null) return 'UNKNOWN';
      cb.onElementUnlocked?.(expressId);
      return type;
    }
    case 'LOCK_REJECTED': {
      const expressId = toExpressId(msg.express_id);
      if (expressId === null) return 'UNKNOWN';
      cb.onLockRejected?.(
        expressId,
        msg.held_by as Parameters<NonNullable<CollaborationCallbacks['onLockRejected']>>[1]
      );
      return type;
    }
    case 'REMOTE_TRANSFORM_STREAM': {
      const expressId = toExpressId(msg.express_id);
      const matrix = toMatrix(msg.matrix);
      if (expressId === null || matrix === null) return 'UNKNOWN';
      cb.onRemoteTransformStream?.(expressId, matrix);
      return type;
    }
    case 'REMOTE_TRANSFORM_COMMITTED': {
      const expressId = toExpressId(msg.express_id);
      const matrix = toMatrix(msg.matrix);
      if (expressId === null || matrix === null) return 'UNKNOWN';
      cb.onRemoteTransformCommitted?.(expressId, matrix);
      return type;
    }
    case 'REMOTE_PROPERTY_UPDATED': {
      const expressId = toExpressId(msg.express_id);
      const pset = typeof msg.pset_name === 'string' ? msg.pset_name : null;
      const property = typeof msg.property_name === 'string' ? msg.property_name : null;
      if (expressId === null || !pset || !property) return 'UNKNOWN';
      cb.onRemotePropertyUpdated?.(expressId, pset, property, msg.value);
      return type;
    }
    case 'COMMIT_REJECTED': {
      // F-018: the server refused the commit because another session holds the soft lock.
      const expressId = toExpressId(msg.express_id);
      if (expressId === null) return 'UNKNOWN';
      const reason = typeof msg.reason === 'string' && msg.reason ? msg.reason : 'Commit rejected';
      cb.onCommitRejected?.(expressId, reason);
      return type;
    }
    case 'SESSION_REPLACED': {
      cb.onSessionReplaced?.();
      return type;
    }
    case 'PING': {
      // Issue 3.3: answer immediately so the server's idle watchdog sees an inbound frame.
      // A missing transport (a unit test dispatching a frame in isolation) is not an error.
      transport?.send({ type: 'PONG', ts: Date.now() });
      return type;
    }
    case 'PONG': {
      // The server only answers PINGs with nothing; a PONG arriving here is a stray and is
      // deliberately ignored.
      return type;
    }
    case 'ERROR': {
      const reason = typeof msg.reason === 'string' && msg.reason ? msg.reason : 'Unknown server error';
      cb.onServerError?.(reason);
      return type;
    }
    default:
      return 'UNKNOWN';
  }
}
