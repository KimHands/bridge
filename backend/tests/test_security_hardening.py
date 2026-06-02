"""운영 보안 하드닝 — fail-safe 기본값·운영 게이팅 검증.

적대적 검증 #5: app_debug 기본 False, 운영 SQL echo 차단, CORS 와일드카드 무시.
"""
from app.core.config import Settings
from app.main import resolve_cors_origins


def _settings(**over):
    # 필수 필드는 더미로 채워 환경 비의존 단위 테스트.
    base = dict(
        database_url="postgresql+asyncpg://x:y@localhost/db",
        redis_url="redis://localhost:6379/0",
        jwt_secret_key="x",
        encryption_key="aGVsbG8=",
    )
    base.update(over)
    return Settings(**base)


def test_app_debug_defaults_to_false():
    # 보안 민감 플래그의 '코드 기본값'은 fail-safe(False)여야 한다.
    # (실제 인스턴스는 .env/환경변수로 덮일 수 있으므로 필드 default를 직접 검증)
    assert Settings.model_fields["app_debug"].default is False


def test_db_echo_off_in_production_even_if_debug_on():
    s = _settings(app_env="production", app_debug=True)
    assert s.is_production is True
    assert s.db_echo is False  # 운영에선 디버그가 켜져도 SQL echo 차단


def test_db_echo_on_only_in_dev_with_debug():
    assert _settings(app_env="development", app_debug=True).db_echo is True
    assert _settings(app_env="development", app_debug=False).db_echo is False


def test_cors_wildcard_ignored_in_production():
    assert resolve_cors_origins("*", is_production=True) == []
    assert resolve_cors_origins("https://app.bridge.app,*", is_production=True) == [
        "https://app.bridge.app"
    ]


def test_cors_wildcard_allowed_in_dev():
    assert resolve_cors_origins("*", is_production=False) == ["*"]


def test_cors_explicit_origins_preserved():
    assert resolve_cors_origins(
        "https://a.com, https://b.com", is_production=True
    ) == ["https://a.com", "https://b.com"]
