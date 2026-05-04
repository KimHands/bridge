# Bridge DB ERD (Live Snapshot)

> **생성일**: 2026-05-05
> **도구**: [mermerd](https://github.com/KarnerTh/mermerd) v0.13.0
> **소스**: 로컬 Docker Compose `bridge-db-1` (PostgreSQL 16)
> **갱신 방법**: 스키마 변경 후 아래 명령 재실행
>
> ```bash
> mermerd -c "postgresql://bridge:bridge_secret@localhost:5432/bridge?sslmode=disable" \
>         -s public --useAllTables --showAllConstraints \
>         -o docs/diagram/bridge_erd_live.md
> # 생성 후 첫 줄 `erDiagram`을 ```mermaid 코드 펜스로 다시 감쌀 것
> ```

```mermaid
erDiagram
    alembic_version {
        character_varying version_num PK 
    }

    assessments {
        timestamp_with_time_zone created_at 
        text encrypted_result 
        uuid id PK 
        smallint phq_tier 
        timestamp_with_time_zone updated_at 
        uuid user_id FK 
    }

    diary_emotion_keywords {
        uuid diary_id PK,FK 
        integer keyword_id PK,FK 
    }

    diary_entries {
        timestamp_with_time_zone created_at 
        text encrypted_memo 
        uuid id PK 
        smallint mood_score 
        date recorded_date UK 
        timestamp_with_time_zone updated_at 
        uuid user_id FK,UK 
    }

    emotion_keywords {
        character_varying description 
        integer id PK 
        character_varying name UK 
    }

    mission_points {
        timestamp_with_time_zone created_at 
        smallint diary_score 
        uuid id PK 
        smallint routine_score 
        smallint total_score 
        timestamp_with_time_zone updated_at 
        uuid user_id FK,UK 
        date week_start UK 
    }

    routine_logs {
        date completed_date 
        timestamp_with_time_zone created_at 
        uuid id PK 
        uuid user_routine_id FK 
    }

    routines {
        text description 
        integer id PK 
        smallint phq_tier_max 
        smallint phq_tier_min 
        ARRAY target_keywords 
        character_varying title 
    }

    situation_keywords {
        character_varying answer_text 
        timestamp_with_time_zone created_at 
        uuid diary_id FK 
        uuid id PK 
        integer keyword_id FK 
        timestamp_with_time_zone updated_at 
    }

    trigger_logs {
        timestamp_with_time_zone cooldown_until 
        timestamp_with_time_zone created_at 
        uuid id PK 
        integer routine_id FK 
        character_varying triggered_keyword 
        timestamp_with_time_zone updated_at 
        uuid user_id FK 
    }

    user_routines {
        timestamp_with_time_zone assigned_at 
        timestamp_with_time_zone created_at 
        uuid id PK 
        boolean is_active 
        integer routine_id FK 
        character_varying source 
        timestamp_with_time_zone updated_at 
        uuid user_id FK 
    }

    users {
        timestamp_with_time_zone created_at 
        character_varying email_hash UK 
        uuid id PK 
        boolean is_active 
        character_varying nickname 
        character_varying password_hash 
        timestamp_with_time_zone updated_at 
    }

    assessments }o--|| users : "user_id"
    diary_emotion_keywords }o--|| diary_entries : "diary_id"
    diary_emotion_keywords }o--|| emotion_keywords : "keyword_id"
    diary_entries }o--|| users : "user_id"
    situation_keywords }o--|| diary_entries : "diary_id"
    situation_keywords }o--|| emotion_keywords : "keyword_id"
    mission_points }o--|| users : "user_id"
    routine_logs }o--|| user_routines : "user_routine_id"
    trigger_logs }o--|| routines : "routine_id"
    user_routines }o--|| routines : "routine_id"
    trigger_logs }o--|| users : "user_id"
    user_routines }o--|| users : "user_id"
```
