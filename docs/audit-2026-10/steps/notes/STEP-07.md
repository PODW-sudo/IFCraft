## 2026-10-25 - Copilot building generator: 2x2 column grid and honest claims (STEP-07)

- **Type:** Bug
- **Platform:** http://localhost:8000 (backend) — surfaced through the copilot drawer at http://localhost:5173
- **Related tests:** TC-083, TC-062 · `backend/tests/test_step07_column_count.py`, `backend/tests/test_phase6.py`
- **Severity:** P1
- **Observed:** `pytest backend/tests` was red because `test_phase6.py` expected 8 columns for a 2-storey 12 × 8 m building and got 4 — a UI-layout commit (`580724b`) had cut the generated grid from 4 columns per storey to 1–2, with no test pinning the rule. The copilot chat text always claimed "structural columns" even for a 4 × 4 m building that receives none.
- **Expected:** The column layout is a documented, deterministic pure function of the floor plate; the summary and the chat text state only the columns that were actually placed; the reported `element_count` equals the entities in the file.
- **Evidence:** `test_step07_column_count.py` before: 2 failed / 2 passed ("the chat message claims columns but the building has none…"; "the column grid is not expressed as a named, documented rule"). After: 4 passed. `test_phase6.py`: "Expected 8 columns, found 4" → passes. Full backend suite: 44 passed.
- **Suggested fix (applied):** Decision taken — **4 columns per storey on a 2×2 interior grid for any building that qualifies (2 storeys ⇒ 8 columns)**, matching the recommended option in the step and the contract `test_phase6.py` already encoded. Added `MIN_BUILDING_FOR_COLUMNS_M = (6.0, 5.0)`, `COLUMN_GRID_FRACTIONS = (0.35, 0.65)` and `column_grid(length, width, col_size=0.35)` in `ai_service.py`; the storey loop and the local chat-intent text both derive from it; the result summary is built from the placed counts (column clause omitted when zero) and `element_count` is counted from the written model.
- **Status:** Ready for review
