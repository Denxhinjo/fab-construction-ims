from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/fab_construction_ims"
    # No default on purpose -- a missing SECRET_KEY should fail startup loudly
    # rather than silently sign JWTs with a value anyone can read in this file.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    MEDIA_DIR: str = "media"
    MAX_FILE_SIZE_MB: int = 10
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    ALERT_EMAIL: str = ""
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


settings = Settings()
