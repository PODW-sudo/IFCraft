import os
import secrets
from pathlib import Path
from pydantic import BaseModel

from dotenv import load_dotenv

# Load .env from project root or backend dir if present
load_dotenv()
_backend_env = Path(__file__).resolve().parent.parent.parent / ".env"
if _backend_env.exists():
    load_dotenv(_backend_env)

class Settings(BaseModel):
    PROJECT_NAME: str = "IFC Editor API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Base paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage"
    PROJECTS_DIR: Path = STORAGE_DIR / "projects"
    DATABASE_PATH: Path = STORAGE_DIR / "projects.db"
    
    # AI Keys (Loaded from .env or environment)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    
    # CORS (STEP-05 / F-003)
    #
    # No wildcard: with `"*"` Starlette mirrors the caller's Origin and the browser happily
    # hands any website the user visits read/write access to every local project. Only the
    # local dev origins are allowed, and cross-origin credentials stay off (see main.py).
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",     # vite dev server
        "http://127.0.0.1:5173",
        "http://localhost:4173",     # vite preview (default port)
        "http://127.0.0.1:4173",
        "http://localhost:3000",     # alternate dev port kept for existing setups
        "http://127.0.0.1:3000",
    ]

    # STEP-05 / F-003: process-lifetime bearer token. Filled in below from
    # `storage/.api_token` (or the API_TOKEN environment variable when one is supplied).
    API_TOKEN: str = os.getenv("API_TOKEN", "")

    # Signed session identity (open issue 3.5).
    #
    # The WS `user_id` used to be whatever the client sent, so presence and soft locks were
    # advisory: any local page that got past the Origin check could claim another architect's
    # id. A browser now has to present an HMAC-signed session token bound to that id, issued by
    # `POST /api/bootstrap/session`. 12 h outlives a working day and a reconnect.
    SESSION_TOKEN_TTL_SECONDS: int = 12 * 3600
    MAX_SESSION_USER_ID_LENGTH: int = 128

    # WebSocket heartbeat (open issue 3.3). The server pings every 25 s and closes a socket
    # that has sent nothing at all for 60 s (two missed pings), so a half-open connection
    # (laptop lid closed, VPN drop) releases its session and soft locks instead of waiting for
    # TCP to notice — which can take minutes.
    WS_PING_INTERVAL_SECONDS: float = 25.0
    WS_IDLE_TIMEOUT_SECONDS: float = 60.0
    
    # AI rate limit (open issue 3.1 / F-019 quota half)
    #
    # STEP-05 gives the installation one shared token, so there is no per-user identity to
    # meter. What we can bound is spend: the provider-calling copilot routes admit 30
    # requests per caller per minute, in memory (see core/rate_limit.py). 30/min is far above
    # a person typing in the copilot (a chat turn is one request) and far below a script
    # draining a paid key. Set AI_RATE_LIMIT_ENABLED=false for a benchmark or a load test.
    AI_RATE_LIMIT_REQUESTS: int = 30
    AI_RATE_LIMIT_WINDOW_SECONDS: float = 60.0
    AI_RATE_LIMIT_ENABLED: bool = True

    # Single-writer guard (open issue 3.4 / STEP-03 follow-up)
    #
    # The per-project write lock in services/atomic_store.py is an asyncio lock: it serialises
    # writers inside one process and does nothing between two uvicorn processes. Two backends
    # (a stray `uvicorn --reload` parent/child pair, or a second worker) would interleave model
    # writes. The lifespan now takes an exclusive OS lock on `storage/.server.lock` and refuses
    # to start when another live process holds it (see core/server_lock.py).
    ENFORCE_SINGLE_WRITER: bool = True

    # Server host & port
    HOST: str = "127.0.0.1"
    PORT: int = 8000

    # Federation upload cap (STEP-20 / F-027)
    #
    # The sub-model upload used to `await file.read()` with no bound, so a single request
    # could exhaust the host's memory. Same 250 MB ceiling as the project upload.
    MAX_SUBMODEL_BYTES: int = 250 * 1024 * 1024

    # Cloud AI endpoints (STEP-20 / F-019)
    #
    # Fixed, server-side base URLs. `openai` and `openrouter` used to honour the
    # caller-supplied `base_url`, which let any caller aim a paid cloud key at an
    # arbitrary host; a caller that needs a different endpoint uses `custom`.
    AI_CLOUD_HOSTS: dict[str, str] = {
        "openai": "https://api.openai.com/v1",
        "openrouter": "https://openrouter.ai/api/v1",
    }

settings = Settings()

# Ensure directories exist
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
settings.PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


def default_token_path() -> Path:
    """Location of the persisted API token: `storage/.api_token` (STEP-05 spec 2)."""
    return settings.STORAGE_DIR / ".api_token"


def load_or_create_token(token_file: Path | None = None) -> str:
    """Return the persisted API token, generating and storing one on first start.

    The token lives next to the projects, so it is per-install and survives restarts. It is
    chmod 0600 on POSIX; on Windows the file inherits the directory ACL, and `chmod` only
    toggles the read-only bit, so the failure is deliberately swallowed.
    """
    path = token_file or default_token_path()
    try:
        existing = path.read_text(encoding="utf-8").strip()
    except (FileNotFoundError, NotADirectoryError):
        existing = ""
    except OSError:
        existing = ""
    if existing:
        return existing

    token = secrets.token_urlsafe(32)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(token, encoding="utf-8")
    try:
        path.chmod(0o600)
    except OSError:
        pass  # Windows: inherit the directory ACL
    return token


# Resolved at import time so every process (API, tests, harness) sees the same token without
# an extra call. An explicitly configured API_TOKEN (env / .env) wins and is not overwritten.
settings.API_TOKEN = settings.API_TOKEN or load_or_create_token()
