---
name: design-tokens
description: >-
  Use this skill to create, validate, and extend Design Tokens Community Group (DTCG) tokens
  for the IFC Editor, ensuring unified styling across light/dark themes, floating HUDs,
  and high-density CAD panels.
---

# Design Tokens Skill (DTCG Standard for BIM Editor)

This skill governs the single source of truth for color, typography, spacing, elevations, and semantic intent across the IFC Editor.

## Token Architecture

Tokens follow a 3-tier hierarchy:
```
1. Primitives (Raw values)
   └── tokens.color.slate[900] (#0d0f12), tokens.color.cyan[400] (#22d3ee)
2. Semantics (Intent-based abstractions)
   └── tokens.surface.canvas, tokens.action.primary, tokens.action.danger
3. Component (Component-scoped bindings)
   └── tokens.component.dock.bg, tokens.component.hud.border
```

## Token Directory & Compilation
- Source file: `frontend/src/tokens/tokens.json`
- Compiled CSS custom properties: `frontend/src/tokens/tokens.css`
- Imported into: `frontend/src/index.css`

## Semantic Intent Rules (Non-Negotiable)
1. **Destructive Actions**: Delete, Remove, Discard, and Clear MUST bind to `action.danger` (hue ~0–15deg, red). Using primary blue/cyan for a destructive action fails `lint_intent.py`.
2. **Affirmative Actions**: Primary commits (Save, Create, Export) bind to `action.primary`.
3. **Neutral / Tool Actions**: Mode switches (Pan, Orbit, Gizmo, Wireframe) bind to `surface.control` with neutral hover states.
4. **CAD Entity Highlights**:
   - `IfcWall`: Architectural Slate / Steel
   - `IfcSlab`: Concrete Warm Gray
   - `IfcColumn`: Structural Amber
   - `IfcWindow` / `IfcDoor`: Cyan Glass / Bronze

## Contrast Mandate
Every text-on-surface and icon-on-surface token pairing must achieve:
- Standard body text (< 18pt): **>= 4.5:1** contrast ratio (WCAG 2.2 AA).
- Large text / graphical components: **>= 3.0:1** contrast ratio.
- Verified by: `python scripts/gates/verify_contrast.py`.
