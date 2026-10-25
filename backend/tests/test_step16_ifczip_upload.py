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
