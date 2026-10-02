# Agent QA Harness — Established Patterns & BIM Solutions

This document catalogs proven patterns discovered when operating the Agent QA Harness on the IFC Editor. Each pattern addresses a specific testing challenge in spatial 3D WebGL, WebAssembly workers, and real-time CAD concurrency.

---

## Pattern 1 — Testing State-Dependent UI

**When you need this:** A UI component (banner, dialog, onboarding prompt, feature gate, provider API key modal) only appears when specific internal storage state is met. You cannot reach that state through normal navigation within a single session.

### The Problem
Agents can navigate URLs, click elements, and read the DOM. They cannot open DevTools panels. If the condition that shows the component is stored in a location agents cannot write to, the test is structurally blocked — the product itself is not broken, but the precondition can never be established.

| Storage | Lives in | Writable by page JS | Writable by agents |
|---|---|---|---|
| `localStorage` | Page context | Yes | Via script injection / CDP |
| `sessionStorage` | Page context | Yes | Via script injection / CDP |
| `IndexedDB` | Browser process | Via API | Via script injection |
| Server-side session / DB | Backend | No | Via API call |

### The Solution: Testability Seam via URL Parameters
Build a controlled entry point into internal state accessible through URL navigation:
1. Product reads test parameters on load (e.g. `?test_project=AutoTest-Duplex-01&test_selected_id=142`).
2. Page sets up state or selects element automatically.
3. Test executes immediately without relying on fragile multi-step manual timing.

```text
http://localhost:5173/?test_provider=openai&test_selected_id=128
```

---

## Pattern 2 — WebGL 3D Canvas Raycasting & Element Picking

**When you need this:** Validating 3D element selection, transform gizmo attachment, or measurement snapping.

### The Problem
Unlike standard 2D web applications where every interactive element is a DOM node (`<button>`, `<div>`), a Three.js 3D viewport renders thousands of building components into a single `<canvas>` element. Standard agent element finders (`page.click('button')`) cannot target an internal Three.js mesh vertex or `expressID`.

### The Solution: Global QA Bridge & Custom Event Seams
Expose a lightweight, production-safe testing bridge on `window`:

```typescript
// Exposed in App.tsx or ThreeViewport.tsx in dev/test builds:
if (import.meta.env.DEV) {
  (window as any).__IFC_QA_BRIDGE__ = {
    selectElement: (expressID: number) => {
      window.dispatchEvent(new CustomEvent('ifc-qa-select', { detail: { expressID } }));
    },
    getSelectedID: () => selectedExpressID,
    getSceneMeshCount: () => geometries.length,
    triggerTransform: (mode: 'translate' | 'rotate' | 'scale') => setTransformMode(mode),
    setMeasurementPoints: (p1: [number, number, number], p2: [number, number, number]) => { ... }
  };
}
```

This allows agents executing browser CDP sessions or Playwright/Puppeteer runs to trigger precise 3D actions deterministically (`Runtime.evaluate` with `__IFC_QA_BRIDGE__.selectElement(142)`), while human or computer vision agents can also use normalized canvas coordinate clicks.

---

## Pattern 3 — WebAssembly (`web-ifc.wasm`) Worker Asynchrony

**When you need this:** Testing model uploads and sample file loads.

### The Problem
IFC files range from megabytes to gigabytes. Parsing happens inside a dedicated Web Worker to prevent UI thread freezing. If an agent asserts DOM state immediately after clicking "Load Duplex Sample", the test fails because WASM parsing and Three.js geometry buffer allocation take 500ms–2000ms.

### The Solution: Explicit Loading State Attributes
The root container or viewport must reflect worker state through explicit DOM attributes:
- `data-qa-worker-status="idle | parsing | generating_geometry | ready | error"`
- `data-qa-progress="100"`

The agent's test step waits explicitly for `[data-qa-worker-status='ready']` before proceeding to selection or measurement assertions.

---

## Pattern 4 — WebSocket Real-Time Concurrency & Soft-Lock Verification

**When you need this:** Verifying TC-024 (Real-Time WebSocket Presence & Soft-Locking).

### The Problem
Testing multi-user collision avoidance and soft locking requires two concurrent clients connected to the same project room (`/ws/rooms/{project_id}`). Running two full browser windows can be resource-intensive on test machines.

### The Solution: Virtual Collaborator WebSocket Injection
The QA runner or agent can spawn a lightweight secondary WebSocket connection using Python or Node.js directly to the FastAPI backend:
1. Primary client is the active browser session (`http://localhost:5173`).
2. Secondary agent connects to `ws://localhost:8000/ws/rooms/{project_id}` as user "AutoTest-Collaborator-2".
3. Secondary agent sends `{"type": "select", "expressID": 105}`.
4. Browser primary client immediately receives the lock broadcast and renders the soft-lock indicator badge.

This provides 100% deterministic concurrency testing without requiring dual graphical browser processes.

---

## Pattern 5 — Non-Destructive AutoTest Teardown & SQLite Isolation

**When you need this:** Running test suites repeatedly without polluting developer projects or failing on dirty state.

### The Problem
Tests creating projects, uploading files, or modifying properties can leave orphan records in `./storage/projects.db` and `./storage/projects/{id}/`, causing subsequent runs to fail on unique constraints or project name collisions.

### The Solution: The `AutoTest-` Convention & Teardown Hook
1. Every test-generated entity MUST start with prefix `AutoTest-`.
2. The QA runner or teardown script issues cleanup requests after each run:
   ```python
   # Cleanup any AutoTest- projects
   projects = requests.get("http://localhost:8000/api/projects").json()
   for p in projects:
       if p["name"].startswith("AutoTest-"):
           requests.delete(f"http://localhost:8000/api/projects/{p['id']}")
   ```
3. SQLite project storage is preserved clean for normal user workflow.
