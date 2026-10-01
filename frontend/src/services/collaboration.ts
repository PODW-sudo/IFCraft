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

  constructor(projectId: string, callbacks: CollaborationCallbacks) {
    this.projectId = projectId;
    this.callbacks = callbacks;
    this.userProfile = getOrCreateUserProfile();
  }

  public get connected(): boolean {
    return this.isConnected;
  }

  public get profile(): { userId: string; userName: string; userColor: string } {
    return this.userProfile;
  }

  public connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/rooms/${this.projectId}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.send({
        action: 'JOIN',
        user_id: this.userProfile.userId,
        user_name: this.userProfile.userName,
        user_color: this.userProfile.userColor
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'ROOM_STATE':
            if (this.callbacks.onRoomState) this.callbacks.onRoomState(msg.users, msg.locks);
            break;
          case 'USER_JOINED':
            if (this.callbacks.onUserJoined) this.callbacks.onUserJoined(msg.user);
            break;
          case 'USER_LEFT':
            if (this.callbacks.onUserLeft) this.callbacks.onUserLeft(msg.user_id);
            break;
          case 'ELEMENT_LOCKED':
            if (this.callbacks.onElementLocked) this.callbacks.onElementLocked(msg.express_id, msg.lock);
            break;
          case 'ELEMENT_UNLOCKED':
            if (this.callbacks.onElementUnlocked) this.callbacks.onElementUnlocked(msg.express_id);
            break;
          case 'LOCK_REJECTED':
            if (this.callbacks.onLockRejected) this.callbacks.onLockRejected(msg.express_id, msg.held_by);
            break;
          case 'REMOTE_TRANSFORM_STREAM':
            if (this.callbacks.onRemoteTransformStream)
              this.callbacks.onRemoteTransformStream(msg.express_id, msg.matrix);
            break;
          case 'REMOTE_TRANSFORM_COMMITTED':
            if (this.callbacks.onRemoteTransformCommitted)
              this.callbacks.onRemoteTransformCommitted(msg.express_id, msg.matrix);
            break;
          case 'REMOTE_PROPERTY_UPDATED':
            if (this.callbacks.onRemotePropertyUpdated)
              this.callbacks.onRemotePropertyUpdated(
                msg.express_id,
                msg.pset_name,
                msg.property_name,
                msg.value
              );
            break;
        }
      } catch (err) {
        console.error('Failed to parse WS incoming message:', err);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
    };
  }

  public selectElement(expressId: number) {
    this.send({
      action: 'SELECT_ELEMENT',
      user_id: this.userProfile.userId,
      express_id: expressId
    });
  }

  public deselectElement(expressId: number) {
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

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(data: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}
