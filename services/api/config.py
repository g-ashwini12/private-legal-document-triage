import os
from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = DATA_DIR / "uploads"
CHROMA_DIR = DATA_DIR / "chroma"
SQLITE_PATH = DATA_DIR / "triage.db"
TEST_FIXTURES_DIR = BASE_DIR / "tests" / "fixtures"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

def get_default_ollama_model() -> str:
    env_m = os.getenv("OLLAMA_MODEL")
    if env_m:
        return env_m
    try:
        import httpx
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        r = httpx.get(f"{base_url}/api/tags", timeout=1.0)
        if r.status_code == 200:
            models = [m.get("name", "") for m in r.json().get("models", [])]
            for preferred in ["gemma3:1b", "gemma:2b", "gemma4:e4b"]:
                for m in models:
                    if preferred in m:
                        return m
            if models:
                return models[0]
    except Exception:
        pass
    return "gemma3:1b"

class Settings(BaseSettings):
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = get_default_ollama_model()
    EMBED_MODEL: str = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
    CACHE_SIMILARITY: float = float(os.getenv("CACHE_SIMILARITY", "0.92"))
    CONTEXT_TOKEN_BUDGET: int = int(os.getenv("CONTEXT_TOKEN_BUDGET", "6000"))
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "15"))
    MAX_PAGES: int = 60
    
    # Admin & security settings
    ADMIN_ENABLED: bool = os.getenv("ADMIN_ENABLED", "false").lower() in ("true", "1", "yes")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    ADMIN_COOKIE_SECRET: str = os.getenv("ADMIN_COOKIE_SECRET", "legal-triage-admin-secret-key-32chars")
    
    DATA_DIR: Path = DATA_DIR
    UPLOAD_DIR: Path = UPLOAD_DIR
    CHROMA_DIR: Path = CHROMA_DIR
    SQLITE_PATH: Path = SQLITE_PATH
    TEST_FIXTURES_DIR: Path = TEST_FIXTURES_DIR

settings = Settings()
