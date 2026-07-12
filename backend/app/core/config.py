import os
import sys

# Ensure backend directory is in the python path for absolute imports to resolve
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "ComplianceIntel AI"
    API_V1_STR: str = "/api"
    
    # Defaults; will be populated from .env if present
    DATABASE_URL: str = "sqlite+aiosqlite:///./compliance.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    QDRANT_URL: str = "http://localhost:6333"
    OLLAMA_HOST: str = "http://localhost:11434"

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
