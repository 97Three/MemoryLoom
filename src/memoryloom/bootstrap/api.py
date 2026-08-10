"""API process composition."""

from fastapi import FastAPI

from memoryloom.api.app import create_app
from memoryloom.config import Settings


def build_api_application(settings: Settings) -> FastAPI:
    """Build one owned API application from validated runtime settings."""
    return create_app(settings=settings)
