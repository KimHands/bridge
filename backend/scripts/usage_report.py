"""운영자용 익명 사용 지표 리포트 (M2).

기존 테이블에서 루틴 완료율·트리거 작동·자가평가 tier 분포를 집계해 출력한다.
저장·사용자 노출 없음. 개인 식별 정보를 출력하지 않는다.

실행:
    docker compose run --rm --no-deps api python -m scripts.usage_report --days 30
"""
import argparse
import asyncio
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.database import AsyncSessionLocal
from app.services.usage_metrics import (
    assessment_tier_distribution,
    routine_completion_stats,
    trigger_activity_stats,
)

_KST = ZoneInfo("Asia/Seoul")


def _fmt_daily(daily: dict) -> str:
    if not daily:
        return "    (없음)"
    return "\n".join(f"    {d.isoformat()}: {v}" for d, v in daily.items())


async def _run(days: int) -> None:
    end = datetime.now(_KST).date()
    start = end - timedelta(days=days - 1)

    async with AsyncSessionLocal() as db:
        completion = await routine_completion_stats(db, start, end)
        trigger = await trigger_activity_stats(db, start, end)
        tiers = await assessment_tier_distribution(db, start, end)

    rate = completion["approx_completion_rate"]
    rate_str = f"{rate:.3f}" if rate is not None else "N/A (활성 루틴 없음)"

    print(f"=== Bridge 사용 지표 (KST {start} ~ {end}, {days}일) ===\n")

    print("[루틴 완료]")
    print(f"  총 완료: {completion['total_completions']}")
    print(f"  완료 경험 루틴 수: {completion['distinct_completed_routines']}")
    print(f"  현재 활성 루틴: {completion['active_routines_now']}")
    print(f"  근사 완료율(총완료/(활성×일수), '현재 활성' 기준 근사): {rate_str}")
    print("  일별 완료:")
    print(_fmt_daily(completion["daily_completions"]))

    print("\n[트리거 작동]")
    print(f"  배정 source별: {trigger['assignments_by_source']}")
    print(f"  총 트리거 발동: {trigger['total_triggers']}")
    print(f"  키워드별: {trigger['triggers_by_keyword'] or '(없음)'}")
    print("  일별 발동:")
    print(_fmt_daily(trigger["daily_triggers"]))

    print("\n[자가평가 tier 분포] (모집단 분포·익명, 개인 변화 아님)")
    print(f"  tier별: {tiers['by_tier']}")
    print(f"  총 제출: {tiers['total']}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Bridge 운영자용 익명 사용 지표")
    parser.add_argument("--days", type=int, default=30, help="조회 기간(일), 기본 30")
    args = parser.parse_args()
    if args.days < 1:
        parser.error("--days 는 1 이상이어야 합니다")
    asyncio.run(_run(args.days))


if __name__ == "__main__":
    main()
