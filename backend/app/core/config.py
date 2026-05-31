from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    redis_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14

    encryption_key: str

    app_env: str = "development"
    app_debug: bool = True

    # CORS 허용 origin (콤마 구분). 운영에선 .env로 명시 origin 지정 권장.
    cors_origins: str = "*"


settings = Settings()
