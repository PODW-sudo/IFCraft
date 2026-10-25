/**
 * STEP-10 — user-facing message channel.
 *
 * Small dependency-free store so non-React code (hooks, services) can raise a message that the
 * app renders somewhere visible. `UserMessageHost` (mounted in `main.tsx`) subscribes to it.
 *
 * This exists because `useCadDraftingMachine` must surface a failed undo/redo (Spec 11) without
 * owning JSX. Callers that prefer their own UI can inject `onUserMessage` instead.
 */

export type UserMessageTone = 'info' | 'success' | 'error';

export interface UserMessage {
  id: string;
  text: string;
  tone: UserMessageTone;
}

export interface UserMessageInput {
  text: string;
  tone?: UserMessageTone;
}

/** More than three simultaneous messages is noise; the oldest is dropped. */
const MAX_VISIBLE = 3;

let messages: UserMessage[] = [];
let sequence = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

/** Publish a message. Returns the id so the caller can dismiss it early. */
export function notifyUser(input: string | UserMessageInput): string {
  const rawText = typeof input === 'string' ? input : input?.text ?? '';
  const text = rawText.trim();
  const tone: UserMessageTone = typeof input === 'string' ? 'info' : input.tone ?? 'info';
  if (!text) return '';

  sequence += 1;
  const message: UserMessage = { id: `msg-${sequence}`, text, tone };
  messages = [...messages, message].slice(-MAX_VISIBLE);
  emit();
  return message.id;
}

export function dismissUserMessage(id: string): void {
  const next = messages.filter((message) => message.id !== id);
  if (next.length === messages.length) return;
  messages = next;
  emit();
}

export function dismissAllUserMessages(): void {
  if (messages.length === 0) return;
  messages = [];
  emit();
}

export function getUserMessages(): UserMessage[] {
  return messages;
}

export function subscribeUserMessages(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
