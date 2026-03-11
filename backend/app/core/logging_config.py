"""
Structured logging configuration for the SaaS platform.

- Production: JSON format with tenant_id, user_id, request_id
- Development: Human-readable colored format

Usage:
    from app.core.logging_config import setup_logging
    setup_logging()  # Call once at app startup (in lifespan)
"""
import logging
import json
import sys
from datetime import datetime, timezone

from app.core.config import settings


class JSONFormatter(logging.Formatter):
    """
    JSON log formatter for production.
    Outputs one JSON object per line — compatible with CloudWatch, ELK, Datadog.
    """

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Add exception info if present
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)

        # Add extra context fields (tenant_id, user_id, request_id, etc.)
        for key in ("tenant_id", "user_id", "request_id", "method", "path", "status_code", "duration_ms"):
            value = getattr(record, key, None)
            if value is not None:
                log_entry[key] = value

        return json.dumps(log_entry, default=str)


class DevFormatter(logging.Formatter):
    """
    Human-readable formatter for local development.
    Format: LEVEL    logger  message  [extra context]
    """

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[41m",  # Red background
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "")
        level = f"{color}{record.levelname:<8}{self.RESET}"

        # Shorten logger name (app.platform.routes.auth → routes.auth)
        name = record.name
        if name.startswith("app."):
            parts = name.split(".")
            name = ".".join(parts[-2:]) if len(parts) > 2 else parts[-1]

        msg = f"{level} {name:<20} {record.getMessage()}"

        # Append context if present
        extras = []
        for key in ("tenant_id", "user_id", "request_id"):
            value = getattr(record, key, None)
            if value:
                extras.append(f"{key}={value}")
        if extras:
            msg += f"  [{', '.join(extras)}]"

        if record.exc_info and record.exc_info[0] is not None:
            msg += "\n" + self.formatException(record.exc_info)

        return msg


def setup_logging() -> None:
    """
    Configure logging based on environment.
    Call this once during app startup (in FastAPI lifespan).
    """
    is_production = settings.ENVIRONMENT == "production"
    log_level = logging.WARNING if is_production else logging.DEBUG

    # Root logger config
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers (prevents duplicates on reload)
    root_logger.handlers.clear()

    # Create handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    if is_production:
        handler.setFormatter(JSONFormatter())
    else:
        handler.setFormatter(DevFormatter())

    root_logger.addHandler(handler)

    # Quiet noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    # App loggers at INFO level even in prod
    logging.getLogger("app").setLevel(logging.INFO)

    logger = logging.getLogger(__name__)
    logger.info(
        "Logging configured: env=%s level=%s format=%s",
        settings.ENVIRONMENT,
        logging.getLevelName(log_level),
        "json" if is_production else "dev",
    )
