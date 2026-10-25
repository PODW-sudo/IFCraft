import React, { useEffect, useSyncExternalStore } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import {
  dismissUserMessage,
  getUserMessages,
  subscribeUserMessages
} from '../../services/userMessages';
import type { UserMessage } from '../../services/userMessages';

/**
 * STEP-10 — renders the app-wide message channel (`services/userMessages.ts`).
 *
 * A failed undo/redo must never be a `console.error`-only event (Spec 11). Because
 * `useCadDraftingMachine` cannot own JSX and `App.tsx` is owned by the App lane, the host is mounted
 * at the composition root (`main.tsx`) instead.
 *
 * Placement: bottom-centre, above the contextual dock (`top-18`) and the top-centre soft-lock
 * notification (`top-16`/`top-28`), so the three never overlap.
 * Visual treatment is @designer-owned; tokens below are the existing dock surface / HUD shadow.
 */

const AUTO_DISMISS_MS: Record<UserMessage['tone'], number> = {
  info: 6000,
  success: 5000,
  error: 12000
};

const TONE_STYLES: Record<UserMessage['tone'], { border: string; icon: React.ReactNode }> = {
  info: { border: 'border-cyan-500/40', icon: <Info size={14} className="text-cyan-400 shrink-0" /> },
  success: {
    border: 'border-emerald-500/40',
    icon: <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
  },
  error: {
    border: 'border-rose-500/50',
    icon: <AlertTriangle size={14} className="text-rose-400 shrink-0" />
  }
};

export const UserMessageHost: React.FC = () => {
  const messages = useSyncExternalStore(subscribeUserMessages, getUserMessages, getUserMessages);

  useEffect(() => {
    if (messages.length === 0) return;
    const timers = messages.map((message) =>
      setTimeout(() => dismissUserMessage(message.id), AUTO_DISMISS_MS[message.tone])
    );
    return () => timers.forEach((timer) => clearTimeout(timer));
  }, [messages]);

  if (messages.length === 0) return null;

  return (
    <div
      data-qa="user-message-stack"
      className="fixed bottom-16 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none select-none"
    >
      {messages.map((message) => {
        const tone = TONE_STYLES[message.tone];
        return (
          <div
            key={message.id}
            data-qa="user-message"
            data-qa-tone={message.tone}
            role={message.tone === 'error' ? 'alert' : 'status'}
            aria-live={message.tone === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex max-w-[min(560px,calc(100vw-32px))] items-center gap-2.5 px-4 py-2 rounded-xl bg-[var(--dock-bg)] border ${tone.border} text-[var(--text-primary)] text-xs shadow-[var(--shadow-hud)] backdrop-blur-md animate-in fade-in-50 slide-in-from-bottom-2`}
          >
            {tone.icon}
            <span className="break-words">{message.text}</span>
            <button
              type="button"
              data-qa="user-message-dismiss"
              onClick={() => dismissUserMessage(message.id)}
              className="ml-1 p-0.5 rounded text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              title="Dismiss message"
              aria-label="Dismiss message"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default UserMessageHost;
