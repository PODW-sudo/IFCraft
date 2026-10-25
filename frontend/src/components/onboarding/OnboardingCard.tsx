import React, { useState } from 'react';
import { ArrowRight, FolderOpen, Sparkles, Upload, X } from 'lucide-react';

import { completeOnboarding } from '../../services/onboarding';
import { SHORTCUTS, formatShortcut } from '../../services/shortcuts';

/**
 * STEP-28 / F-051 - the first-run card.
 *
 * One dismissible card, not a tour: three actions (upload / open a sample / dismiss) and a
 * single line that names the two discovery chords. It is rendered *next to* the existing
 * "Spatial Canvas Ready" empty state, which stays - that one explains an empty project,
 * this one explains the product.
 *
 * Visibility is the caller's decision (`!hasCompletedOnboarding() && geometries.length === 0`);
 * dismissal persists the flag and hides the card in the same tick.
 */

interface OnboardingCardProps {
  onUpload: () => void;
  onOpenSample: () => void;
  /** Optional hook so the parent can also react (e.g. focus the tree). */
  onDismiss?: () => void;
}

function chord(id: string): string {
  const shortcut = SHORTCUTS.find((entry) => entry.id === id);
  if (!shortcut) return '';
  return formatShortcut(shortcut);
}

export const OnboardingCard: React.FC<OnboardingCardProps> = ({ onUpload, onOpenSample, onDismiss }) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const dismiss = () => {
    completeOnboarding();
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      data-qa="onboarding-card"
      role="region"
      aria-label="Getting started"
      className="p-6 rounded-2xl bg-[var(--dock-translucent)] border border-[var(--border-subtle)] text-center max-w-md pointer-events-auto backdrop-blur-2xl shadow-[var(--shadow-hud)] animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-left">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <p className="text-sm font-semibold text-[var(--text-primary)]">Welcome to IFC Editor</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          data-qa="onboarding-dismiss"
          aria-label="Dismiss getting started card"
          className="p-1.5 min-h-11 min-w-11 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <p className="text-xs text-[var(--text-secondary)] text-left mb-4">
        Open an IFC model to inspect its spatial hierarchy, properties and coordinates. CAD authoring
        tools are one <span className="text-[var(--text-primary)] font-medium">profile switch</span> away in
        the header.
      </p>

      <div className="flex items-center justify-center gap-2 mb-3">
        <button
          type="button"
          onClick={onUpload}
          data-qa="onboarding-upload"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-colors shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" aria-hidden="true" />
          Upload IFC
        </button>
        <button
          type="button"
          onClick={onOpenSample}
          data-qa="onboarding-sample"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--control-bg)] hover:bg-[var(--control-hover)] text-[var(--text-primary)] transition-colors border border-[var(--border-subtle)]"
        >
          <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
          Open sample
        </button>
        <button
          type="button"
          onClick={dismiss}
          data-qa="onboarding-skip"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          Dismiss
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      <p className="text-[10px] text-[var(--text-secondary)] font-mono">
        {chord('omnibar.open')} command palette · {chord('help.shortcuts')} all shortcuts
      </p>
    </div>
  );
};

export default OnboardingCard;
