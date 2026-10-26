from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/fab_construction_ims"
    # No default on purpose -- a missing SECRET_KEY should fail startup loudly
    # rather than silently sign JWTs with a value anyone can read in this file.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    # Invoice reading. TESSERACT_CMD is only needed when the binary isn't on
    # PATH (e.g. C:\Program Files\Tesseract-OCR\tesseract.exe on Windows).
    TESSERACT_CMD: str = ""
    OCR_LANGUAGES: str = "sqi+eng"
    MAX_INVOICE_FILE_MB: int = 15
    APP_ENV: str = "production"
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    ADMIN_EMAIL: str = "admin@fabconstruction.com"
    ADMIN_PASSWORD: str = "Admin@123"
    ADMIN_FULL_NAME: str = "System Administrator"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True
        # Older .env files still carry settings of removed features (MEDIA_DIR, ...).
        extra = "ignore"


settings = Settings()
