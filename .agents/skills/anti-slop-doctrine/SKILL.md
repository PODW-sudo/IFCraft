---
name: anti-slop-doctrine
description: >-
  Use this skill to enforce strict design quality guidelines that eliminate AI-generated slop,
  derivative templates, arbitrary styling, and superficial mockups.
---

# Anti-Slop Doctrine (Engineering Standards for UI/UX)

Adapted from `plugin87/ux-ui-agent-skills`. These rules govern all UI code in this workspace.

## The 6 Non-Negotiables

### 1. ABSOLUTE: Zero Emoji Policy
- Never emit an emoji or decorative pictograph (sparkles, checkmark emoji, folder emoji, alert signs, colored dots) in generated UI, buttons, tooltips, JSON, or commit messages.
- Emojis are the #1 tell of machine-generated slop.
- Use **Lucide icons** (`import { Box, Layers, Settings } from 'lucide-react'`) or plain concise technical labels.
- Enforced objectively by `scripts/gates/check_no_emoji.py`.

### 2. Token by Intent (No Blue Delete)
- Controls must wear the variant matching their semantic purpose:
  - Destructive actions (Delete project, remove element, clear measurements) MUST use `action.danger` / `text-red-400` / `bg-red-500/10`.
  - Affirmative commits use `action.primary`.
  - Tools and neutral modes use neutral fills.
- A destructive action styled with primary blue or purple is a bug.
- Enforced objectively by `scripts/gates/lint_intent.py`.

### 3. Geometric Hierarchy (No Single-Radius)
- Slop UI applies `rounded-lg` or `rounded-md` to every single element (buttons, modals, inputs, badges, cards) indiscriminately.
- Professional CAD UI employs geometric hierarchy:
  - Outer floating windows/modals: `rounded-xl` (12px)
  - Toolbars / floating pills: `rounded-full` or `rounded-lg` (8px)
  - Micro-buttons, inputs, and tabs: `rounded` (4–6px)
  - Status badges: `rounded-sm` (2px)

### 4. Intentional Focal Points (No "Four Equal Cards")
- Never present three or four identical cards of equal size with no visual hierarchy.
- In CAD/BIM, the 3D model is ALWAYS the primary focal point.
- Secondary focal points are active element details or live numerical measurements. Everything else stays muted.

### 5. Display Typography vs Body Typography
- Headings are NOT just bold body text (`text-sm font-bold`).
- Display hierarchy uses intentional contrast:
  - Viewport HUD values: 18–24px tabular numbers (`font-mono tracking-tight font-semibold`).
  - Section headers: 11px uppercase tracked (`tracking-wider text-slate-400 font-semibold`).
  - Data labels: 11–12px regular.
  - Coordinate readouts: Monospaced numbers with fixed column widths.

### 6. Never Claim a Number You Did Not Measure
- Do not assert "100% WCAG pass", "great contrast", or "perfect responsiveness" without running the measurement scripts.
- Run the gates: `python scripts/gates/run_gates.py`.
