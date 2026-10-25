import {
  Outbox,
  dispatchServerMessage,
  nextReconnectDelay,
  shouldReconnect
} from './wsResilience';
import type { OutboxMessage } from './wsResilience';
import { notifyUser } from './userMessages';

export interface Collaborator {
  user_id: string;
  user_name: string;
  user_color: string;
  selected_express_id: number | null;
  joined_at: string;
}

export interface ElementLock {
  user_id: string;
  user_name: string;
  user_color: string;
  acquired_at: string;
}

/** STEP-13 Spec 11 — the three transport states the header status dot consumes. */
export type ConnectionState = 'connecting' | 'open' | 'closed';

export interface CollaborationCallbacks {
  onRoomState?: (users: Collaborator[], locks: Record<number, ElementLock>) => void;
  onUserJoined?: (user: Collaborator) => void;
  onUserLeft?: (userId: string) => void;
  onElementLocked?: (expressId: number, lock: ElementLock) => void;
  onElementUnlocked?: (expressId: number) => void;
  onLockRejected?: (expressId: number, heldBy: ElementLock) => void;
  onRemoteTransformStream?: (expressId: number, matrix: number[]) => void;
  onRemoteTransformCommitted?: (expressId: number, matrix: number[]) => void;
  onRemotePropertyUpdated?: (expressId: number, pset: string, prop: string, val: unknown) => void;
  /** STEP-13 Spec 6 / F-018 — the server refused this session's commit (soft lock held elsewhere). */
  onCommitRejected?: (expressId: number, reason: string) => void;
  /** STEP-13 Spec 11 — transport state changes, for the presence indicator. */
  onConnectionState?: (state: ConnectionState) => void;
  /** STEP-13 Spec 5 — another socket with the same `user_id` took over this session. */
  onSessionReplaced?: () => void;
  /** STEP-13 Spec 5 — the server rejected a malformed frame. */
  onServerError?: (reason: string) => void;
}

// User Profile Manager
const USER_COLORS = [
  '#38bdf8', // sky
  '#f59e0b', // amber
  '#10b981', // emerald
  '#a855f7', // purple
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#ec4899'  // pink
];

/** STEP-13 Spec 9 — bounded write buffer while the socket is not open. */
const OUTBOX_MAX_SIZE = 50;

export function getOrCreateUserProfile(): { userId: string; userName: string; userColor: string } {
  let userId = localStorage.getItem('ifc_editor_user_id');
  let userName = localStorage.getItem('ifc_editor_user_name');
  let userColor = localStorage.getItem('ifc_editor_user_color');

  if (!userId) {
    userId = `user-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('ifc_editor_user_id', userId);
  }
  if (!userName) {
    const randomAdjectives = ['Nordic', 'Swiss', 'Minimal', 'Modern', 'Bauhaus', 'Parametric', 'Linear'];
    const randomRole = ['Architect', 'Engineer', 'Planner', 'Modeller', 'Draftsman'];
    const adj = randomAdjectives[Math.floor(Math.random() * randomAdjectives.length)];
    const role = randomRole[Math.floor(Math.random() * randomRole.length)];
    userName = `${adj} ${role}`;
    localStorage.setItem('ifc_editor_user_name', userName);
  }
  if (!userColor) {
    userColor = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
    localStorage.setItem('ifc_editor_user_color', userColor);
  }

  return { userId, userName, userColor };
}

export class CollaborationClient {
  private ws: WebSocket | null = null;
  private projectId: string;
  private userProfile: { userId: string; userName: string; userColor: string };
  private callbacks: CollaborationCallbacks;
  private isConnected = false;
  private state: ConnectionState = 'closed';

  // STEP-13 resilience state
  private readonly outbox = new Outbox({ maxSize: OUTBOX_MAX_SIZE });
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private manualClose = false;
  /** Spec 10 — re-sent on every reconnect so the server-side lock set converges. */
  private lastSelectedExpressId: number | null = null;

  constructor(projectId: string, callbacks: CollaborationCallbacks) {
    this.projectId = projectId;
    this.userProfile = getOrCreateUserProfile();

    /**
     * F-018 / STEP-13 acceptance: a rejected commit, a replaced session and a server-side error must
     * never be silent. When the host app has not wired a callback (App.tsx wiring is deferred to the
     * App lane), fall back to the app-wide message channel so the user still learns what happened.
     */
    this.callbacks = {
      ...callbacks,
      onCommitRejected: (expressId: number, reason: string) => {
        console.warn(`[collab] commit rejected for element #${expressId}: ${reason}`);
        if (callbacks.onCommitRejected) {
          callbacks.onCommitRejected(expressId, reason);
          return;
        }
        notifyUser({
          text: `Change to element #${expressId} was rejected: ${reason}`,
          tone: 'error'
        });
      },
      onSessionReplaced: () => {
        if (callbacks.onSessionReplaced) {
          callbacks.onSessionReplaced();
          return;
        }
        notifyUser({
          text: 'This project was opened in another tab — live collaboration stopped here.',
          tone: 'info'
        });
      },
      onServerError: (reason: string) => {
        if (callbacks.onServerError) {
          callbacks.onServerError(reason);
          return;
        }
        notifyUser({ text: `Collaboration error: ${reason}`, tone: 'error' });
      }
    };
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  /** STEP-13 Spec 11. */
  public get connectionState(): ConnectionState {
    return this.state;
  }

  public get profile(): { userId: string; userName: string; userColor: string } {
    return this.userProfile;
  }

  public connect(): void {
    if (typeof WebSocket === 'undefined') {
      console.warn('[collab] WebSocket is unavailable - collaboration disabled');
      return;
    }

    this.manualClose = false;
    this.clearReconnectTimer();
    this.setState('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/rooms/${this.projectId}`;

    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      this.isConnected = true;
      this.reconnectAttempt = 0;
      this.setState('open');

      // Re-announce identity, then re-assert the current selection (Spec 10), then drain the
      // outbox so edits made while disconnected are not lost.
      this.sendNow({
        action: 'JOIN',
        user_id: this.userProfile.userId,
        user_name: this.userProfile.userName,
        user_color: this.userProfile.userColor
      });

      if (this.lastSelectedExpressId !== null) {
        this.sendNow({
          action: 'SELECT_ELEMENT',
          user_id: this.userProfile.userId,
          express_id: this.lastSelectedExpressId
        });
      }

      const flushed = this.outbox.flush((message) => this.sendNow(message));
      if (flushed > 0) {
        console.debug(`[collab] delivered ${flushed} queued message(s) after reconnect`);
      }
    };

    ws.onerror = (event) => {
      console.warn('[collab] socket error', event);
    };

    ws.onmessage = (event) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data as string);
      } catch (err) {
        console.error('[collab] failed to parse incoming frame:', err);
        return;
      }

      const handled = dispatchServerMessage(parsed, this.callbacks);
      if (handled === 'UNKNOWN') {
        console.debug('[collab] ignored unrecognised server message', parsed);
      }
    };

    ws.onclose = (event) => {
      // A superseded socket (project switch, replaced session) must not clobber the live one.
      if (this.ws !== ws) return;
      this.ws = null;
      this.isConnected = false;
      this.setState('closed');

      if (this.manualClose) return;
      if (shouldReconnect(event.code)) {
        this.scheduleReconnect();
      } else {
        console.debug(`[collab] not reconnecting after close code ${event.code}`);
      }
    };
  }

  public selectElement(expressId: number) {
    this.lastSelectedExpressId = expressId;
    this.send({
      action: 'SELECT_ELEMENT',
      user_id: this.userProfile.userId,
      express_id: expressId
    });
  }

  public deselectElement(expressId: number) {
    if (this.lastSelectedExpressId === expressId) {
      this.lastSelectedExpressId = null;
    }
    this.send({
      action: 'DESELECT_ELEMENT',
      user_id: this.userProfile.userId,
      express_id: expressId
    });
  }

  public streamTransform(expressId: number, matrix: number[]) {
    this.send({
      action: 'TRANSFORM_STREAM',
      user_id: this.userProfile.userId,
      express_id: expressId,
      matrix
    });
  }

  public commitTransform(expressId: number, matrix: number[]) {
    this.send({
      action: 'TRANSFORM_COMMIT',
      user_id: this.userProfile.userId,
      user_name: this.userProfile.userName,
      express_id: expressId,
      matrix
    });
  }

  public broadcastProperty(expressId: number, psetName: string, propName: string, value: unknown) {
    this.send({
      action: 'PROPERTY_UPDATE',
      user_id: this.userProfile.userId,
      express_id: expressId,
      pset_name: psetName,
      property_name: propName,
      value
    });
  }

  /**
   * Intentional teardown (project switch, unmount): stops the reconnect loop, drops the queue and
   * closes with a clean code so `shouldReconnect` never fires afterwards.
   */
  public disconnect(): void {
    this.manualClose = true;
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    this.outbox.clear();

    const ws = this.ws;
    this.ws = null;
    this.isConnected = false;

    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close(1000, 'client disconnect');
      } catch {
        // already closing/closed - nothing to do
      }
    }

    this.setState('closed');
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.callbacks.onConnectionState?.(next);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const attempt = this.reconnectAttempt;
    this.reconnectAttempt += 1;
    const delay = nextReconnectDelay(attempt, Math.random);
    console.warn(
      `[collab] connection lost - retrying in ${Math.round(delay)} ms (attempt ${attempt + 1})`
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /** Queue writes while the socket is not open instead of dropping them (Spec 9). */
  private send(data: OutboxMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendNow(data);
      return;
    }
    this.outbox.push(data);
  }

  /** Direct write, used only when the socket is known-open (onopen drain path). */
  private sendNow(data: OutboxMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.outbox.push(data);
      return;
    }
    try {
      this.ws.send(JSON.stringify(data));
    } catch (err) {
      // Never lose the frame silently: requeue it for the next successful open.
      console.warn('[collab] failed to send frame - requeued', err);
      this.outbox.push(data);
    }
  }
}
