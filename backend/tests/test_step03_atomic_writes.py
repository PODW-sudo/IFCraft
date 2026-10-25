"""
STEP-03 — Writes to a project model must be atomic and serialised.

Finding: F-002 (the race half)
Code under test:
  backend/app/services/ifc_service.py:237-284   (IFCService.update_element_placement)
  backend/app/services/project_service.py:156-158 (ProjectService.get_project_file_path)
  backend/app/api/projects.py:260-290            (POST /elements/{id}/placement)

TODAY:
  * `model.write(str(file_path))` writes in place — a crash or a concurrent write leaves a
    truncated model.ifc.
  * There is no per-project lock, so two concurrent mutations each write their own snapshot and
    the later one silently discards the earlier edit.

HOW TO RUN
    Copy this file into backend/tests/ then:
    .\\backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_step03_atomic_writes.py -v
"""

import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient


def _repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "backend" / "app" / "main.py").exists():
            return parent
    raise RuntimeError("Could not locate repository root")


ROOT = _repo_root()
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.main import app  # noqa: E402
from backend.app.services.project_service import ProjectService  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def project(client):
    """A small project to mutate concurrently."""
    res = client.post("/api/projects/samples/office_pavilion/load")
    assert res.status_code == 201, f"sample load failed: {res.text}"
    data = res.json()
    yield data["id"]
    client.delete(f"/api/projects/{data['id']}")


def _element_ids(client, project_id, limit=6):
    tree = client.get(f"/api/projects/{project_id}/spatial-tree")
    assert tree.status_code == 200, tree.text
    ids = []

    def walk(node):
        if node.get("type") in ("IfcWall", "IfcColumn", "IfcSlab", "IfcDoor", "IfcWindow"):
            ids.append(node["express_id"])
        for child in node.get("children") or []:
            walk(child)

    walk(tree.json())
    return ids[:limit]


def _identity_matrix():
    return [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        0.0, 0.0, 0.0, 1.0,
    ]


def _translated_matrix(dx, dy, dz):
    return [
        1.0, 0.0, 0.0, 0.0,
        0.0, 1.0, 0.0, 0.0,
        0.0, 0.0, 1.0, 0.0,
        dx, dy, dz, 1.0,
    ]


def test_concurrent_placement_updates_all_land(client, project):
    """Concurrent mutations to the same project must not lose writes.

    Today two concurrent requests each open the whole model, mutate their own snapshot and
    write it back — so the second write silently discards the first one's edit.
    """
    import ifcopenshell

    element_ids = _element_ids(client, project, limit=6)
    assert len(element_ids) >= 2, "need at least two elements for a concurrency test"

    file_path = ProjectService.get_project_file_path(project)

    import concurrent.futures

    def move(index, express_id):
        matrix = _translated_matrix(float(index + 1), 0.0, 0.0)
        return client.post(
            f"/api/projects/{project}/elements/{express_id}/placement",
            json={"matrix": matrix},
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(element_ids)) as pool:
        futures = [pool.submit(move, i, eid) for i, eid in enumerate(element_ids)]
        responses = [f.result() for f in futures]

    for resp in responses:
        assert resp.status_code == 200, f"placement failed: {resp.status_code} {resp.text}"

    # The model must still be readable and must contain every requested change.
    model = ifcopenshell.open(str(file_path))
    assert model is not None, "model.ifc is corrupt after concurrent writes"

    moved = []
    for index, express_id in enumerate(element_ids):
        entity = model.by_id(express_id)
        assert entity is not None, f"element #{express_id} vanished"
        matrix = entity.ObjectPlacement.RelativePlacement.Location.Coordinates
        moved.append(round(float(matrix[0]), 3))

    expected = sorted(round(float(i + 1), 3) for i in range(len(element_ids)))
    assert sorted(moved) == expected, (
        f"Concurrent writes were lost. Expected translations {expected}, found {moved}. "
        "A per-project write lock is required so mutations serialise."
    )


def test_model_write_is_atomic(client, project):
    """The model file must be written to a temporary file and renamed into place.

    `model.write(path)` writes in place; a crash or a second writer leaves a truncated file.
    The model is the contractual deliverable, so a half-written model is unacceptable.
    """
    import ifcopenshell

    file_path = ProjectService.get_project_file_path(project)
    assert file_path.exists()

    # No stray temp artefacts may be left behind next to the live model.
    siblings = [p.name for p in file_path.parent.iterdir()]
    assert not any(n.endswith((".tmp", ".partial")) for n in siblings), (
        f"temporary write artefacts left behind: {siblings}"
    )

    # The written file must be complete: a STEP file ends with END-ISO-10303-21.
    tail = file_path.read_bytes()[-32:]
    assert b"END-ISO-10303-21" in tail, (
        "model.ifc does not end with the STEP terminator — the file may be truncated"
    )


def test_project_file_path_is_contained_within_the_projects_directory():
    """`get_project_file_path` must not be able to escape the storage directory.

    project_id is currently an unconstrained path segment (F-026). The filename is fixed today,
    so this is not yet exploitable, but it is a latent write primitive.

    NOTE (STEP-03 implementation): the accepted fix is to reject a non-UUID outright, which is
    stricter than "resolve to a contained path" but cannot be satisfied by returning a path for
    `".."`. Both outcomes are therefore accepted here: a `ValueError`, or a path that resolves
    inside the storage root.
    """
    from backend.app.core.config import settings

    resolved_root = settings.PROJECTS_DIR.resolve()

    for hostile_id in ("..", "../../etc", "..\\..\\windows"):
        try:
            path = ProjectService.get_project_file_path(hostile_id).resolve()
        except ValueError:
            # Rejected before any filesystem access: the strongest form of containment.
            continue
        assert path.is_relative_to(resolved_root), (
            f"project_id {hostile_id!r} resolved outside the projects directory: {path}"
        )


# ---------------------------------------------------------------------------
# Additional coverage added by the STEP-03 implementation (acceptance criteria 3, 4, 6).
# ---------------------------------------------------------------------------
import hashlib  # noqa: E402


class _ExplodingModel:
    """A model whose serialisation fails *after* writing partial bytes to the temp file."""

    def __init__(self) -> None:
        self.calls = 0

    def write(self, path: str) -> None:
        self.calls += 1
        with open(path, "wb") as handle:
            handle.write(b"ISO-10303-21;\n/* truncated mid-serialise */")
        raise RuntimeError("simulated crash during model.write")


def test_failed_write_leaves_the_previous_model_byte_identical(tmp_path):
    """Spec 7: an exception between open and write must not touch the live model."""
    from backend.app.services.atomic_store import atomic_write_model

    target = tmp_path / "model.ifc"
    target.write_bytes(b"ISO-10303-21;\n...\nEND-ISO-10303-21;\n")
    before = hashlib.sha256(target.read_bytes()).hexdigest()

    exploding = _ExplodingModel()
    with pytest.raises(RuntimeError):
        atomic_write_model(exploding, target)

    assert exploding.calls == 1
    assert hashlib.sha256(target.read_bytes()).hexdigest() == before, (
        "a failed write modified model.ifc"
    )
    leftovers = [p.name for p in tmp_path.iterdir() if p.name != "model.ifc"]
    assert leftovers == [], f"temporary write artefacts left behind: {leftovers}"


def test_lock_registry_stays_bounded():
    """Spec 2: the per-project lock registry is bounded (128 entries)."""
    from backend.app.services import atomic_store

    for index in range(atomic_store.LOCK_REGISTRY_MAX + 40):
        atomic_store.project_lock(f"00000000-0000-0000-0000-{index:012d}")

    assert atomic_store.lock_registry_size() <= atomic_store.LOCK_REGISTRY_MAX, (
        f"lock registry grew to {atomic_store.lock_registry_size()} entries"
    )


def test_different_projects_do_not_block_each_other():
    """Spec 4: the lock is per project, so two projects can be written concurrently."""
    import asyncio

    from backend.app.services.atomic_store import project_write_lock

    order: list[str] = []

    async def hold(project_id: str, tag: str) -> None:
        async with project_write_lock(project_id):
            order.append(f"start-{tag}")
            await asyncio.sleep(0.15)
            order.append(f"end-{tag}")

    async def main() -> None:
        await asyncio.gather(
            hold("00000000-0000-0000-0000-00000000aaaa", "a"),
            hold("00000000-0000-0000-0000-00000000bbbb", "b"),
        )

    asyncio.run(main())

    assert order[:2] == ["start-a", "start-b"], f"projects serialised needlessly: {order}"


def test_same_project_writes_do_serialise():
    """Spec 4, the other half: two writers on one project must not overlap."""
    import asyncio

    from backend.app.services.atomic_store import project_write_lock

    project_id = "00000000-0000-0000-0000-00000000cccc"
    order: list[str] = []

    async def hold(tag: str) -> None:
        async with project_write_lock(project_id):
            order.append(f"start-{tag}")
            await asyncio.sleep(0.05)
            order.append(f"end-{tag}")

    async def main() -> None:
        await asyncio.gather(hold("a"), hold("b"))

    asyncio.run(main())

    assert order in (
        ["start-a", "end-a", "start-b", "end-b"],
        ["start-b", "end-b", "start-a", "end-a"],
    ), f"same-project writes overlapped: {order}"
