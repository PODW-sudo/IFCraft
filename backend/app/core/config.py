import os
from pathlib import Path
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "IFC Editor API"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Base paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent.parent
    STORAGE_DIR: Path = BASE_DIR / "storage"
    PROJECTS_DIR: Path = STORAGE_DIR / "projects"
    DATABASE_PATH: Path = STORAGE_DIR / "projects.db"
    
    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Server host & port
    HOST: str = "127.0.0.1"
    PORT: int = 8000

settings = Settings()

# Ensure directories exist
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
settings.PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
