"""
Scheduled jobs — APScheduler con AsyncIO + Redis job store.

Corre dentro del lifespan de FastAPI. Los jobs sobreviven reinicios
gracias a la persistencia en Redis (DB 1, separado de rate limiting).
"""
import logging
from typing import Optional
from urllib.parse import urlparse

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.redis import RedisJobStore
from apscheduler.executors.asyncio import AsyncIOExecutor

from app.core.config import settings

logger = logging.getLogger(__name__)

scheduler: Optional[AsyncIOScheduler] = None


def _create_scheduler() -> AsyncIOScheduler:
    """Create and configure the APScheduler instance."""
    parsed = urlparse(settings.REDIS_URL)

    jobstores = {
        "default": RedisJobStore(
            host=parsed.hostname or "localhost",
            port=parsed.port or 6379,
            password=parsed.password,
            db=1,  # DB 1 = scheduler (DB 0 = rate limiting)
            jobs_key="alfredo:scheduler:jobs",
            run_times_key="alfredo:scheduler:run_times",
        )
    }
    executors = {
        "default": AsyncIOExecutor(),
    }
    job_defaults = {
        "coalesce": True,            # Si se perdieron N ejecuciones, correr solo 1
        "max_instances": 1,          # Nunca correr el mismo job en paralelo
        "misfire_grace_time": 3600,  # Aceptar hasta 1 hora de retraso
    }

    return AsyncIOScheduler(
        jobstores=jobstores,
        executors=executors,
        job_defaults=job_defaults,
        timezone="America/Argentina/Buenos_Aires",
    )


async def start_scheduler():
    """Start the scheduler and register all jobs. Called from lifespan."""
    global scheduler

    if not settings.SCHEDULER_ENABLED:
        logger.info("Scheduler disabled (SCHEDULER_ENABLED=false)")
        return

    scheduler = _create_scheduler()

    # Import job functions
    from app.jobs.trial_expiring import job_trial_expiring
    from app.jobs.stock_inmovilizado import job_stock_inmovilizado
    from app.jobs.cheques_por_vencer import job_cheques_por_vencer
    from app.jobs.documentacion import job_documentacion_digest

    # Registrar jobs — replace_existing=True los hace idempotentes en restarts
    scheduler.add_job(
        job_trial_expiring,
        "cron",
        hour=9, minute=0,
        id="trial_expiring",
        name="Trial expiring check",
        replace_existing=True,
    )

    scheduler.add_job(
        job_stock_inmovilizado,
        "cron",
        hour=8, minute=0,
        id="stock_inmovilizado",
        name="Stock inmovilizado daily digest",
        replace_existing=True,
    )

    scheduler.add_job(
        job_cheques_por_vencer,
        "cron",
        hour=8, minute=30,
        id="cheques_por_vencer",
        name="Cheques por vencer daily check",
        replace_existing=True,
    )

    scheduler.add_job(
        job_documentacion_digest,
        "cron",
        day_of_week="mon",
        hour=9, minute=0,
        id="documentacion_digest",
        name="Documentacion/VTV weekly digest",
        replace_existing=True,
    )

    scheduler.start()
    logger.info(
        "Scheduler started with %d jobs: %s",
        len(scheduler.get_jobs()),
        [j.id for j in scheduler.get_jobs()],
    )


async def shutdown_scheduler():
    """Gracefully shut down the scheduler. Called from lifespan."""
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")
        scheduler = None
