from __future__ import annotations

from copy import deepcopy
from typing import Any

import uvicorn
from uvicorn.config import LOGGING_CONFIG

from memoryloom.bootstrap import build_api_application
from memoryloom.config import Settings


def _runtime_logging_config(level: str) -> dict[str, Any]:
    config: dict[str, Any] = deepcopy(LOGGING_CONFIG)
    config["formatters"]["memoryloom_json"] = {"format": "%(message)s"}
    config["handlers"]["memoryloom_json"] = {
        "class": "logging.StreamHandler",
        "formatter": "memoryloom_json",
        "stream": "ext://sys.stdout",
    }
    for logger_name in (
        "memoryloom.access",
        "memoryloom.authorization",
        "memoryloom.error",
        "memoryloom.projection",
    ):
        config["loggers"][logger_name] = {
            "handlers": ["memoryloom_json"],
            "level": level,
            "propagate": False,
        }
    return config


def run() -> None:
    settings = Settings.from_environment()
    application = build_api_application(settings)
    uvicorn.run(
        application,
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
        access_log=False,
        log_config=_runtime_logging_config(settings.log_level),
    )


if __name__ == "__main__":
    run()
