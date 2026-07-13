"""스케줄러 전용 프로세스 진입점.

웹 워커(uvicorn --workers N) 안에서 scheduler.start()를 호출하면 워커 수만큼
스케줄러가 중복 기동되어 푸시 알림이 N번 발송된다(H2). 스케줄러는 반드시 이
전용 단일 프로세스에서만 돌린다.
"""
import asyncio
import logging
import signal

from app.scheduler import scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def main() -> None:
    scheduler.start()
    logger.info("Scheduler started (jobs: %s)", [j.id for j in scheduler.get_jobs()])

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:  # 일부 플랫폼 미지원
            pass

    try:
        await stop.wait()
    finally:
        scheduler.shutdown()
        logger.info("Scheduler stopped")


if __name__ == "__main__":
    asyncio.run(main())
