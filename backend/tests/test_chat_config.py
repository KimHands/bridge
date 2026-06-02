from app.core.config import settings


def test_chat_settings_have_defaults():
    assert settings.mindlogic_base_url.startswith("https://")
    assert settings.chat_model == "claude-sonnet-4-6"
    assert settings.chat_session_ttl == 3600
    assert settings.chat_memory_max == 20
