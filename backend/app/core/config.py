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
    # 보안 민감 플래그는 fail-safe 기본값(False). 운영에서 .env 누락/오타 시에도 디버그가 켜지지 않는다.
    app_debug: bool = False

    # CORS 허용 origin (콤마 구분). 운영에선 .env로 명시 origin 지정 권장.
    cors_origins: str = "*"

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def db_echo(self) -> bool:
        """SQL 로그(echo)는 디버그가 켜져 있고 운영이 아닐 때만. 운영에선 항상 차단."""
        return self.app_debug and not self.is_production

    # 챗봇(마인드로직 게이트웨이) 설정
    mindlogic_api_key: str = ""
    mindlogic_base_url: str = "https://factchat-cloud.mindlogic.ai/v1/gateway"
    chat_model: str = "claude-sonnet-4-6"
    chat_session_ttl: int = 3600
    chat_memory_max: int = 20

    # 이메일 발송 백엔드 — 현재는 "console"(로그 출력)만 구현. 운영 전환 시 "smtp" 추가 예정.
    email_backend: str = "console"


settings = Settings()
