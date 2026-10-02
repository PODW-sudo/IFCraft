import aiosqlite
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from .config import settings

logger = logging.getLogger("ifc_editor.database")

async def init_db() -> None:
    """Initialize SQLite database tables and indexes."""
    db_path = str(settings.DATABASE_PATH)
    logger.info("Initializing SQLite database at %s", db_path)
    
    async with aiosqlite.connect(db_path) as db:
        await db.execute("PRAGMA foreign_keys = ON;")
        await db.execute("PRAGMA journal_mode = WAL;")
        
        # Projects table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                schema_version TEXT NOT NULL DEFAULT 'IFC4',
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                element_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        
        # Collaborative active sessions
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                user_color TEXT NOT NULL,
                last_active TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
            );
        """)
        
        # Edit history / Audit log
        await db.execute("""
            CREATE TABLE IF NOT EXISTS edit_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                action_type TEXT NOT NULL,
                express_id INTEGER,
                entity_type TEXT,
                payload TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
            );
        """)

        # Federated Sub-Models table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS project_models (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                discipline TEXT NOT NULL DEFAULT 'ARCH',
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL DEFAULT 0,
                element_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
            );
        """)
        
        # CAD Transaction History & Undo/Redo table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS cad_transactions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                action_type TEXT NOT NULL,
                express_id INTEGER NOT NULL,
                entity_type TEXT NOT NULL,
                parameters TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ACTIVE',
                created_at TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
            );
        """)

        # Indexes for fast lookup
        await db.execute("CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions (project_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_edit_history_project ON edit_history (project_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_project_models_project ON project_models (project_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_cad_trans_project ON cad_transactions (project_id, created_at);")
        
        await db.commit()
    logger.info("Database schema initialized successfully.")

@asynccontextmanager
async def get_db_connection() -> AsyncGenerator[aiosqlite.Connection, None]:
    """Provide an async context manager for database operations."""
    async with aiosqlite.connect(str(settings.DATABASE_PATH), timeout=30.0) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys = ON;")
        yield db
