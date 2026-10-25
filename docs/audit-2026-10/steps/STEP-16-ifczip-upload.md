# STEP-16 — Support `.ifczip` uploads

**Status:** not started · **Wave:** C · **Effort:** 1 d
**Findings:** F-012 · **Depends on:** — · **Blocks:** STEP-20

## Problem

The upload dialog offers `.ifczip` (`frontend/src/components/modals/UploadModal.tsx:40`, `:124`; `frontend/src/components/federation/FederatedModelManager.tsx:257`) and the backend accepts the extension — then always rejects the file with a 422. A colleague's `.ifczip` — the format most Revit exports arrive in — cannot be opened at all. The user sees "Failed to parse and import IFC file: Error : Unable to parse IFC SPF header", which describes the server's mistake as if it were their file's.

## Evidence

- `backend/app/api/projects.py:114-119` — `.ifczip` passes the extension gate.
- `backend/app/api/projects.py:141-147` — the `ISO-10303-21` magic-header check runs **only** when the filename ends in `.ifc`, so a `.ifczip` skips it and is never unpacked.
- `backend/app/services/project_service.py:77-85` — `import_project_from_bytes` writes the raw upload bytes to `model.ifc` and calls `IFCService.validate_ifc` on them.
- `backend/app/services/ifc_service.py:23` — `ifcopenshell.open(str(file_path))` selects its reader by **extension/content**, and a ZIP stored as `model.ifc` fails.
- `backend/app/api/federation.py:50-51`, `:61-70` — the identical defect on the federation path: `.ifczip` accepted, written verbatim as `{submodel_id}_{name}`, then `validate_ifc` fails and the file is unlinked → 422.
- Measured (this audit tree, `ifcopenshell` 0.9.0):
  ```
  $ python -c "... zipfile.writestr(..., office_pavilion.ifc) ... shutil.copy to 'model.ifc' ... ifcopenshell.open('model.ifc')"
  FAILED: Error : Unable to parse IFC SPF header
  IFCService.validate_ifc FAILED: Error : Unable to parse IFC SPF header
  ```
  The same archive named `m.ifczip` opens fine (`schema IFC4`), which proves the failure is the missing extraction step, not the archive.

## Scope

**Change:**

- `backend/app/services/project_service.py:1-14` — add `io`, `zipfile` imports and four module constants: `IFCZIP_MAGIC = b"PK\x03\x04"`, `MAX_IFCZIP_MEMBERS = 32`, `MAX_IFCZIP_MEMBER_BYTES = 512 * 1024 * 1024`, `MAX_IFCZIP_COMPRESSION_RATIO = 200`.
- `backend/app/services/project_service.py` — add `class UploadTooLarge(ValueError)` and module function `extract_ifc_from_ifczip(content: bytes) -> bytes` (new, above `class ProjectService`).
- `backend/app/services/project_service.py:64-88` — `import_project_from_bytes`: if `content.startswith(IFCZIP_MAGIC)`, replace `content` with `extract_ifc_from_ifczip(content)` **before** the write at `:81` and before `file_size = len(content)` at `:88`.
- `backend/app/api/projects.py:141-147` — run the `ISO-10303-21` header check when the filename ends in `.ifc` **and** the content is not a ZIP; a ZIP payload skips it (it is validated after extraction).
- `backend/app/api/projects.py:159-163` — catch `UploadTooLarge` **before** the blanket `except Exception` and return `413` with a message that does not name the server path.
- `backend/app/api/federation.py:56-74` — extract first, store the STEP under `f"{submodel_id}_{Path(safe_filename).stem}.ifc"`, and set `file_size = len(step_bytes)`.

**Do not change:**

- `backend/app/services/ifc_service.py` — no parser changes; the fix is unpacking, not opening.
- `frontend/src/components/modals/UploadModal.tsx` — it already accepts `.ifczip`.
- The 250 MB `MAX_UPLOAD_SIZE` cap at `backend/app/api/projects.py:105`.

**Non-goals:**

- The **request-body** cap for the federation endpoint and general upload hardening (F-027) — that is STEP-20. This step only bounds *extraction*, because unbounded extraction did not exist before this step and must not be introduced here.
- Supporting `.zip` / `.bcfzip` / multi-model archives. `.ifczip` with exactly one `.ifc` member is the contract.

## Spec

1. A `POST /api/projects/upload` body whose content starts with `PK\x03\x04` is treated as a `.ifczip` regardless of the declared filename extension.
2. The stored `storage/projects/{id}/model.ifc` for such an upload is the **uncompressed STEP text** and begins with `ISO-10303-21;`.
3. `ProjectResponse.file_name` is `"model.ifc"` and `schema_version` / `element_count` describe the extracted model (not the archive).
4. An archive with **zero** `.ifc` members, or more than one, is rejected with `422` and a message naming the reason (`no .ifc file`, `more than one .ifc file`).
5. An archive with more than `MAX_IFCZIP_MEMBERS` entries is rejected with `422`.
6. A member whose declared uncompressed `file_size` exceeds `MAX_IFCZIP_MEMBER_BYTES`, or whose declared `file_size / compress_size` exceeds `MAX_IFCZIP_COMPRESSION_RATIO`, is rejected with `413`.
7. Reading a member stops at `MAX_IFCZIP_MEMBER_BYTES + 1` bytes even if the header lied about `file_size` (defence against a forged central directory).
8. Rejected uploads leave **no** project row and **no** project directory behind.
9. `POST /api/projects/{id}/models` with a `.ifczip` stores an extracted `*.ifc` sub-model, returns `201`, and the stored file parses with `ifcopenshell.open`.
10. `POST /api/projects/samples/{sample_id}/load` still works — the samples path passes raw STEP bytes through `import_project_from_bytes` and must be unaffected.

## TDD

### 1. Add the failing test

**File:** `backend/tests/test_step16_ifczip_upload.py`
**Command:** `.\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step16_ifczip_upload.py -v`

<details>
```python
import io
import sys
import zipfile
from pathlib import Path

import pytest
from starlette.testclient import TestClient

root_dir = str(Path(__file__).resolve().parent.parent.parent)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

from backend.app.main import app
from backend.app.services import project_service
import ifcopenshell

SAMPLE = Path(root_dir) / "backend" / "app" / "samples" / "office_pavilion.ifc"
PROJECTS_DIR = Path(root_dir) / "storage" / "projects"


def _ifczip(members: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in members.items():
            z.writestr(name, data)
    return buf.getvalue()


def _sample_ifczip() -> bytes:
    return _ifczip({"office_pavilion.ifc": SAMPLE.read_bytes()})


def _project_ids(client: TestClient) -> set[str]:
    return {p["id"] for p in client.get("/api/projects").json()}


def test_ifczip_upload_is_unpacked_and_imported():
    """Spec 1-3: a .ifczip upload yields a STEP model.ifc and a normal project response."""
    with TestClient(app) as client:
        before = _project_ids(client)
        project_id = None
        try:
            res = client.post(
                "/api/projects/upload",
                files={
                    "file": (
                        "AutoTest-pavilion.ifczip",
                        _sample_ifczip(),
                        "application/zip",
                    )
                },
                data={"name": "AutoTest-ifczip-project"},
            )
            assert res.status_code == 201, res.text
            project = res.json()
            project_id = project["id"]

            assert project["name"] == "AutoTest-ifczip-project"
            assert project["file_name"] == "model.ifc"
            assert project["schema_version"].startswith("IFC4")
            assert project["element_count"] > 0

            stored = PROJECTS_DIR / project_id / "model.ifc"
            assert stored.exists(), "extracted model.ifc was not written"
            head = stored.read_bytes()[:64]
            assert head.startswith(b"ISO-10303-21;"), f"stored file is not STEP: {head!r}"

            model = ifcopenshell.open(str(stored))
            assert model.schema.startswith("IFC4")
            assert len(model.by_type("IfcProduct")) == project["element_count"]
        finally:
            if project_id:
                client.delete(f"/api/projects/{project_id}")
            assert _project_ids(client) == before


@pytest.mark.parametrize(
    "members, expected_status, needle",
    [
        ({"readme.txt": b"not a model"}, 422, ".ifc"),
        ({"a.ifc": SAMPLE.read_bytes(), "b.ifc": SAMPLE.read_bytes()}, 422, "one"),
    ],
)
def test_ifczip_rejections_leave_no_project_behind(members, expected_status, needle):
    """Spec 4 and 8: bad archives are rejected with a reason and leave no orphan directory."""
    with TestClient(app) as client:
        before = _project_ids(client)
        res = client.post(
            "/api/projects/upload",
            files={"file": ("AutoTest-bad.ifczip", _ifczip(members), "application/zip")},
            data={"name": "AutoTest-ifczip-rejected"},
        )
        assert res.status_code == expected_status, res.text
        assert needle in res.json()["detail"].lower()
        assert _project_ids(client) == before
        assert not any(
            p.name not in before and "AutoTest-ifczip-rejected" in p.name
            for p in PROJECTS_DIR.iterdir()
            if p.is_dir()
        )


def test_ifczip_extraction_is_bounded(monkeypatch):
    """Spec 6: a member larger than the extraction cap is refused with 413, not imported."""
    monkeypatch.setattr(project_service, "MAX_IFCZIP_MEMBER_BYTES", 1024)
    with TestClient(app) as client:
        before = _project_ids(client)
        res = client.post(
            "/api/projects/upload",
            files={"file": ("AutoTest-huge.ifczip", _sample_ifczip(), "application/zip")},
            data={"name": "AutoTest-ifczip-huge"},
        )
        assert res.status_code == 413, res.text
        assert _project_ids(client) == before


def test_federated_ifczip_submodel_is_unpacked():
    """Spec 9: the federation upload path has the same contract."""
    with TestClient(app) as client:
        project_id = None
        try:
            load = client.post("/api/projects/samples/office_pavilion/load")
            assert load.status_code == 201, load.text
            project_id = load.json()["id"]

            res = client.post(
                f"/api/projects/{project_id}/models",
                files={
                    "file": ("AutoTest-struct.ifczip", _sample_ifczip(), "application/zip")
                },
                data={"discipline": "STRUCT", "name": "AutoTest-ifczip-submodel"},
            )
            assert res.status_code == 201, res.text
            sub = res.json()
            assert sub["file_name"].endswith(".ifc"), sub["file_name"]
            assert sub["element_count"] > 0

            stored = PROJECTS_DIR / project_id / "models" / sub["file_name"]
            assert stored.read_bytes()[:32].startswith(b"ISO-10303-21;")
            assert ifcopenshell.open(str(stored)).schema.startswith("IFC4")
        finally:
            if project_id:
                client.delete(f"/api/projects/{project_id}")


def test_sample_load_still_bypasses_extraction():
    """Spec 10: raw STEP bytes must not be routed through the zip path."""
    with TestClient(app) as client:
        project_id = None
        try:
            res = client.post("/api/projects/samples/duplex_residential/load")
            assert res.status_code == 201, res.text
            project_id = res.json()["id"]
            assert res.json()["element_count"] > 0
        finally:
            if project_id:
                client.delete(f"/api/projects/{project_id}")
```
</details>

### 2. Watch it fail

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step16_ifczip_upload.py -v
FAILED backend/tests/test_step16_ifczip_upload.py::test_ifczip_upload_is_unpacked_and_imported
  assert 422 == 201
  E   AssertionError: {"detail":"Failed to parse and import IFC file: Error : Unable to parse IFC SPF header"}
FAILED backend/tests/test_step16_ifczip_upload.py::test_ifczip_rejections_leave_no_project_behind[members0-422-.ifc]
  assert 422 == 422  ->  detail is "Failed to parse and import IFC file: Error : Unable to parse IFC SPF header"
  E   AssertionError: 'no .ifc' not found in 'failed to parse and import ifc file: error : unable to parse ifc spf header'
FAILED backend/tests/test_step16_ifczip_upload.py::test_ifczip_extraction_is_bounded
  E   assert 422 == 413
FAILED backend/tests/test_step16_ifczip_upload.py::test_federated_ifczip_submodel_is_unpacked
  assert 422 == 201
PASSED backend/tests/test_step16_ifczip_upload.py::test_sample_load_still_bypasses_extraction
```

The point of the failure is that **`test_ifczip_upload_is_unpacked_and_imported` fails on a 201-vs-422 assertion**, not on a missing symbol: the endpoint exists, the extension gate already accepts it, and the only missing behaviour is extraction.

### 3. Implement

1. `backend/app/services/project_service.py` — new imports and constants at the top of the module:
   ```python
   import io
   import zipfile

   IFCZIP_MAGIC = b"PK\x03\x04"
   MAX_IFCZIP_MEMBERS = 32
   MAX_IFCZIP_MEMBER_BYTES = 512 * 1024 * 1024
   MAX_IFCZIP_COMPRESSION_RATIO = 200


   class UploadTooLarge(ValueError):
       """Raised when an upload or its expanded contents exceed the configured limits."""
   ```
2. `backend/app/services/project_service.py` — add `extract_ifc_from_ifczip(content: bytes) -> bytes` before `class ProjectService`. Contract:
   - `zipfile.ZipFile(io.BytesIO(content))`; `BadZipFile` → `ValueError("invalid .ifczip archive: ...")`.
   - `files = [i for i in zf.infolist() if not i.is_dir()]`; `len(files) > MAX_IFCZIP_MEMBERS` → `ValueError`.
   - `ifcs = [i for i in files if i.filename.lower().endswith(".ifc")]`;
     `not ifcs` → `ValueError("ifczip archive contains no .ifc file")`;
     `len(ifcs) > 1` → `ValueError("ifczip archive contains more than one .ifc file")`.
   - `member = ifcs[0]`; `member.file_size > MAX_IFCZIP_MEMBER_BYTES` → `UploadTooLarge(...)`.
   - `member.compress_size and member.file_size / member.compress_size > MAX_IFCZIP_COMPRESSION_RATIO` → `UploadTooLarge(...)`.
   - Read in 1 MB chunks from `zf.open(member)`, aborting with `UploadTooLarge` once the running total exceeds `MAX_IFCZIP_MEMBER_BYTES` (spec 7: do not trust `file_size`).
   - `if b"ISO-10303-21" not in data[:512]` → `ValueError("extracted .ifc file is not a STEP file")`.
   - Return `data`.
3. `backend/app/services/project_service.py:64` — first statement of `import_project_from_bytes`, before `project_id` is generated and **before** `project_dir.mkdir()` at `:75`:
   ```python
   if content.startswith(IFCZIP_MAGIC):
       content = extract_ifc_from_ifczip(content)
   ```
   This ordering is what satisfies spec 8 (no orphan directory on rejection).
4. `backend/app/api/projects.py:141-147` — change the guard to
   ```python
   if safe_filename.lower().endswith(".ifc") and not content.startswith(_IFCZIP_MAGIC):
   ```
   importing the constant from `..services.project_service`.
5. `backend/app/api/projects.py:159` — add `except UploadTooLarge as e: raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))` **before** `except Exception`.
6. `backend/app/api/federation.py:56-74` — before computing `stored_filename`, if `content.startswith(IFCZIP_MAGIC)` then `content = extract_ifc_from_ifczip(content)` and `safe_filename = f"{Path(safe_filename).stem}.ifc"`. Keep the existing unlink-on-failure block; extend it to also catch `UploadTooLarge` and return `413`.

### 4. Watch it pass

```
$ .\backend\venv\Scripts\python.exe -m pytest backend/tests/test_step16_ifczip_upload.py -v
PASSED backend/tests/test_step16_ifczip_upload.py::test_ifczip_upload_is_unpacked_and_imported
PASSED backend/tests/test_step16_ifczip_upload.py::test_ifczip_rejections_leave_no_project_behind[members0-422-.ifc]
PASSED backend/tests/test_step16_ifczip_upload.py::test_ifczip_rejections_leave_no_project_behind[members1-422-one]
PASSED backend/tests/test_step16_ifczip_upload.py::test_ifczip_extraction_is_bounded
PASSED backend/tests/test_step16_ifczip_upload.py::test_federated_ifczip_submodel_is_unpacked
PASSED backend/tests/test_step16_ifczip_upload.py::test_sample_load_still_bypasses_extraction
6 passed
```

### 5. Regression guard

```
.\backend\venv\Scripts\python.exe -m pytest backend/tests/ -q
cd frontend; pnpm exec tsc -b --noEmit
.\scripts\ui_pipeline.ps1 -Tier quick
```

`backend/tests/test_schema_compliance.py` (sample round-trip) and `backend/tests/test_phase1.py` (project CRUD) are the two suites that would break if extraction were wired in the wrong place. F-011 makes `test_phase6.py` red on master — that failure is pre-existing and out of scope here.

## Acceptance criteria

- [ ] A `.ifczip` upload returns `201`; the stored `model.ifc` starts with `ISO-10303-21;` and opens with `ifcopenshell.open`.
- [ ] A `.ifczip` named `something.ifc` is still detected as an archive (magic-first detection, not extension-first).
- [ ] Zero-member and two-member archives return `422` with `no .ifc file` / `more than one .ifc file`.
- [ ] A member over `MAX_IFCZIP_MEMBER_BYTES` returns `413`, not `422`.
- [ ] A rejected archive creates no row in `projects` and no directory under `storage/projects/`.
- [ ] `POST /api/projects/{id}/models` with `.ifczip` returns `201` and stores a `*.ifc`.
- [ ] Sample loading (`POST /api/projects/samples/{id}/load`) still returns `201`.
- [ ] No new failure in `pytest backend/tests` beyond the pre-existing F-011 failure.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| Zip-bomb introduced by adding extraction | Three independent bounds (member count, uncompressed size, compression ratio) plus a hard read cap that ignores the declared size | Revert `extract_ifc_from_ifczip` and the two call sites; the endpoint reverts to rejecting `.ifczip` |
| A `.ifczip` whose single member is not the model (e.g. a nested folder) is rejected with a confusing message | Message names the reason and the offending member count; `modelsfortests/` contains no such archive, so add one if a real user reports it | N/A |
| Extraction moves 250 MB of archive into 1 GB of RAM | `MAX_IFCZIP_MEMBER_BYTES` caps the expanded buffer at 512 MB; STEP-20 adds the streaming body cap | Lower the constant |
| Federation sub-model filename change confuses a client that stored the old name | `file_name` is only used for the download route, which re-reads it from the DB | N/A |

## Notes

- **Behaviour change worth announcing:** `import_project_from_bytes` now has a content-dependent side effect (extraction). Any future caller must pass raw upload bytes, not a pre-opened model. It is the single write path for `model.ifc`, which is why the fix belongs there.
- **Overlap with STEP-20:** this step bounds *expansion*; STEP-20 bounds the *request body* on `POST /api/projects/{id}/models` (F-027). Do not add a body cap here — the federation endpoint's `await file.read()` at `backend/app/api/federation.py:61` stays as-is until STEP-20.
- **Not verified:** F-012 is marked `[L]` in `FINDINGS.md`; the audit did not upload an archive. The 422 behaviour was reproduced here directly against `IFCService.validate_ifc`, not through HTTP.
- `ifcopenshell` 0.9.0 *can* open a file whose path ends in `.ifczip`. Extraction is still required because `model.ifc` is the fixed storage name (`backend/app/services/project_service.py:158`) and the whole application assumes that path.

### Implementation notes — 2026-10-25

- **Status:** done. Test copied verbatim from the TDD block to `backend/tests/test_step16_ifczip_upload.py`; it went `5 failed, 1 passed` → `6 passed` with no edits to the test itself.
- **Where the fix landed:** `extract_ifc_from_ifczip()` is called as the *first* statement of `import_project_from_bytes`, before `project_id` is generated and before `project_dir.mkdir()`, which is the mechanism behind spec 8. On the federation side extraction happens before `models_dir.mkdir()` and before `stored_filename` is computed, so an extraction rejection writes neither a file nor a directory and needs no unlink; the pre-existing unlink-on-`validate_ifc`-failure block is untouched.
- **One addition beyond the letter of the spec:** the 1 MB read loop is wrapped in `try/except zipfile.BadZipFile → ValueError("invalid .ifczip archive: ...")`. The step only required that conversion for `ZipFile(...)` construction, but a forged central directory (declared `file_size` smaller than the real payload, or a corrupted member) raises `BadZipFile` from the *read*, and without this the raw `Bad CRC-32` text would reach the user through the blanket 422 handler. Verified by patching the central-directory size field of a real archive: now `ValueError: invalid .ifczip archive: Bad CRC-32 for file 'm.ifc'`, previously an uncaught `BadZipFile`.
- **Verified by hand** (throwaway scripts, not committed): nested-directory member and uppercase `.IFC` member both extract; a directory-only archive gives `no .ifc file`; a corrupt body gives `invalid .ifczip archive`; a text member gives `not a STEP file`; member count over the cap gives the counted `too many members` message; declared size and compression-ratio violations give `UploadTooLarge`. End-to-end through `TestClient`: an archive uploaded under the name `AutoTest-masq.ifc` returns 201 with `model.ifc` starting `ISO-10303-21;` (magic-first detection), and both federation rejections leave `storage/projects/{id}/models/` empty.
- **Cosmetic wart, not fixed:** the size message is rendered from `MAX_IFCZIP_MEMBER_BYTES // (1024 * 1024)`, so a monkeypatched cap below 1 MB reads "0 MB" (the bounded-extraction test lowers it to 1024 bytes). Real deployments use 512 MB, so the message is correct where it matters.
- **Regression state:** `pytest backend/tests -q` → 49 passed, 1 failed (`test_step01_ai_transform_units.py::test_zero_delta_transform_does_not_move_the_element`, `FOREIGN KEY constraint failed`). That run overlapped another lane executing `pytest backend/tests` against the same `storage/projects.db` and `storage/projects/`; `test_step01` passes 4/4 in isolation, so the failure is shared-state contention between concurrent agents, not STEP-16. Not touched: `ifc_service.py`, `ai_service.py`, `clash_service.py`, `cad_service.py`, `schemas.py`, all frontend files, and the 250 MB `MAX_UPLOAD_SIZE` cap.
