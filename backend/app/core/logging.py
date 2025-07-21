"""
Logging configuration for the application
"""

import logging
import logging.config
import sys
from typing import Dict, Any

from app.core.config import settings


def setup_logging() -> None:
    """
    Configure application logging with structured format
    """
    
    log_level = "DEBUG" if settings.DEBUG else "INFO"
    
    logging_config: Dict[str, Any] = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "standard": {
                "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
            },
            "detailed": {
                "format": "%(asctime)s [%(levelname)s] %(name)s:%(lineno)d: %(message)s"
            },
        },
        "handlers": {
            "default": {
                "level": log_level,
                "formatter": "standard",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
        },
        "loggers": {
            "": {
                "handlers": ["default"],
                "level": log_level,
                "propagate": False,
            },
            "uvicorn": {
                "handlers": ["default"],
                "level": log_level,
                "propagate": False,
            },
            "fastapi": {
                "handlers": ["default"],
                "level": log_level,
                "propagate": False,
            },
        },
    }
    
    # Skip file logging for development to avoid permission issues
    
    logging.config.dictConfig(logging_config)
    
    # Set up logger for this module
    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured for environment: {settings.ENVIRONMENT}")