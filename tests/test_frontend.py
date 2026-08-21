from __future__ import annotations

import re
from functools import partial
from threading import Thread

import httpx
import pytest

from memoryloom import frontend

_ASSET_REFERENCE = re.compile(r'(?:src|href)="\./([^"]+)"')


def _get(reference: str) -> httpx.Response:
    """Serve one request with the production handler."""
    handler = partial(
        frontend.FrontendRequestHandler,
        directory=str(frontend._STATIC_DIRECTORY),
    )
    server = frontend.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.handle_request)
    thread.start()
    try:
        host, port = server.server_address
        return httpx.get(f"http://{host}:{port}{reference}", timeout=2)
    finally:
        thread.join(timeout=2)
        server.server_close()


def _index() -> str:
    return (frontend._STATIC_DIRECTORY / "index.html").read_text(encoding="utf-8")


def test_frontend_serves_the_built_console_without_cache(
    capsys: pytest.CaptureFixture[str],
) -> None:
    handler = partial(
        frontend.FrontendRequestHandler,
        directory=str(frontend._STATIC_DIRECTORY),
    )
    server = frontend.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.handle_request)
    thread.start()
    try:
        host, port = server.server_address
        response = httpx.get(
            f"http://{host}:{port}/?raw-evidence=must-not-appear",
            timeout=2,
        )
    finally:
        thread.join(timeout=2)
        server.server_close()

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert "default-src 'self'" in response.headers["content-security-policy"]
    assert "script-src 'self'" in response.headers["content-security-policy"]
    assert response.headers["cross-origin-resource-policy"] == "same-origin"
    assert response.headers["permissions-policy"] == "camera=(), microphone=(), geolocation=()"
    assert response.headers["referrer-policy"] == "no-referrer"
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"

    frontend_log = capsys.readouterr().err
    assert "frontend_request method=GET status=200" in frontend_log
    assert "raw-evidence" not in frontend_log


def test_index_is_a_csp_compatible_spa_shell() -> None:
    index = _index()

    assert "<title>MemoryLoom" in index
    assert '<div id="app"></div>' in index
    assert '<script src="./runtime-config.js" defer></script>' in index
    # One module entry point, no inline script: the static host ships
    # `script-src 'self'`, so an inline bootstrap would be blocked at runtime.
    assert index.count('type="module"') == 1
    assert not re.search(r"<script(?![^>]*\bsrc=)[^>]*>", index)
    assert 'rel="stylesheet"' in index
    assert 'name="api-port"' not in index


def test_every_referenced_asset_ships_with_the_build() -> None:
    references = [
        reference
        for reference in _ASSET_REFERENCE.findall(_index())
        if reference != "runtime-config.js"
    ]

    assert references, "the built index must reference its hashed assets"
    for reference in references:
        asset = frontend._STATIC_DIRECTORY / reference
        assert asset.is_file(), f"missing build asset: {reference}"
        assert asset.stat().st_size > 0, f"empty build asset: {reference}"


def test_runtime_config_is_generated_not_bundled() -> None:
    handler = partial(
        frontend.FrontendRequestHandler,
        directory=str(frontend._STATIC_DIRECTORY),
        public_api_url="http://api.example.test:9000",
    )
    server = frontend.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = Thread(target=server.handle_request)
    thread.start()
    try:
        host, port = server.server_address
        response = httpx.get(f"http://{host}:{port}/runtime-config.js", timeout=2)
    finally:
        thread.join(timeout=2)
        server.server_close()

    assert response.status_code == 200
    assert "application/javascript" in response.headers["content-type"]
    assert (
        'globalThis.MEMORYLOOM_RUNTIME_CONFIG = {"apiBaseUrl":"http://api.example.test:9000"}'
    ) in response.text
    assert (frontend._STATIC_DIRECTORY / "runtime-config.js").exists() is False


def test_hashed_assets_are_served_with_an_executable_content_type() -> None:
    index = _index()
    script = re.search(r'src="\./(assets/[^"]+\.js)"', index)
    stylesheet = re.search(r'href="\./(assets/[^"]+\.css)"', index)

    assert script is not None
    assert stylesheet is not None

    script_response = _get(f"/{script.group(1)}")
    style_response = _get(f"/{stylesheet.group(1)}")

    assert script_response.status_code == 200
    assert "javascript" in script_response.headers["content-type"]
    assert style_response.status_code == 200
    assert "css" in style_response.headers["content-type"]


def test_unknown_paths_stay_not_found() -> None:
    response = _get("/assets/missing-chunk.js")

    assert response.status_code == 404
