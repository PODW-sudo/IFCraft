---
name: design-critic
description: >-
  Use this skill to conduct an adversarial design critique of the IFC Editor UI and UX.
  Renders the interface using browser automation, takes screenshots, inspects visual hierarchy,
  runs objective gates, and invokes the design-critic subagent to argue for rejection and demand high craft.
---

# Design Critic Skill (Adversarial CAD/BIM Review)

Use this skill when auditing screens, components, or complete user flows to detect derivative, clumsy, or AI-generated design patterns.

## Core Principle: Refuse to Critique Blind
Never write a critique from source code alone. A passing test suite or clean TypeScript build only confirms functional correctness, not aesthetic excellence or spatial ergonomics.

## Critique Execution Procedure

### Step 1: Ensure Local App is Live
Verify that the frontend Vite server is running at `http://localhost:5173` and the backend FastAPI server is listening at `http://localhost:8000`. If not running:
```powershell
# From project root
.\start.ps1
```

### Step 2: Capture Visual Renders via `/browser`
1. Navigate to `http://localhost:5173`.
2. Capture full-resolution viewport screenshots:
   - Primary Desktop: 1440x900
   - Dense Laptop: 1280x800
   - Tablet / Compact: 1024x768
3. Interact with the core controls and capture state snapshots:
   - Default resting canvas with IFC model loaded.
   - Selected element state (active 3D gizmo, open Property Inspector).
   - Active BIM tool state (Clipping section plane slider or 3D measurement active).
   - AI Copilot drawer open.

### Step 3: Run Objective Quality Gates
Execute the deterministic gate scripts:
```powershell
python scripts/gates/run_gates.py
```
Record the gate output. If any gate fails (e.g. hardcoded hex, emojis, missing danger intent), note it as objective proof.

### Step 4: Invoke the `design-critic` Subagent
Invoke the subagent with the captured screenshots and gate outputs:
```python
invoke_subagent(
    TypeName="design-critic",
    Role="CAD/BIM Design Critic",
    Prompt="Review the rendered screenshots of the IFC Editor at http://localhost:5173 alongside gate outputs. Argue for rejection based on spatial ergonomics, viewport immersion, visual hierarchy, typography precision, and clone tells."
)
```

### Step 5: Deliver Structured Verdict
Format findings into actionable rework directives:
- **Verdict**: REJECT / REWORK REQUIRED / PASS
- **Top 3 Critical Flaws** with exact file, line, or pixel evidence.
- **Specific Redesign Changes** to reach Figma/Blender-level quality.
