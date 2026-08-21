"""Browser coverage for the Vue console.

These tests describe behaviour, not markup details: they navigate through the
router by role and by visible text so a restyle does not invalidate them.
Chromium is optional in this repository; the module skips cleanly when the
browser binary is unavailable.
"""

from __future__ import annotations

import shutil
import socket
import time
from collections.abc import Iterator
from dataclasses import dataclass
from functools import partial
from pathlib import Path
from threading import Thread
from uuid import uuid4

import httpx
import pytest
import uvicorn
from playwright.sync_api import Browser, Error, Page, expect, sync_playwright

from memoryloom import frontend
from memoryloom.api.app import create_app
from memoryloom.config import Settings

pytestmark = pytest.mark.browser

_AXE_SOURCE = Path(__file__).parents[1] / "node_modules" / "axe-core" / "axe.min.js"


@dataclass(frozen=True, slots=True)
class Console:
    frontend_url: str
    api_url: str


class QuietFrontendRequestHandler(frontend.FrontendRequestHandler):
    def log_message(self, _format: str, *args: object) -> None:
        del args


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def _wait_for(url: str, timeout: float = 8.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            httpx.get(url, timeout=0.4).raise_for_status()
            return
        except (httpx.HTTPError, OSError):
            time.sleep(0.05)
    raise RuntimeError(f"service did not become ready at {url}")


@pytest.fixture(scope="session")
def console(tmp_path_factory: pytest.TempPathFactory) -> Iterator[Console]:
    static_directory = tmp_path_factory.mktemp("frontend-e2e")
    shutil.copytree(frontend._STATIC_DIRECTORY, static_directory, dirs_exist_ok=True)

    api_port = _free_port()
    frontend_port = _free_port()
    api_url = f"http://127.0.0.1:{api_port}"
    frontend_url = f"http://127.0.0.1:{frontend_port}"

    settings = Settings(
        environment="test",
        port=api_port,
        store="memory",
        public_api_url=api_url,
        cors_origins=(frontend_url,),
    )
    application = create_app(settings=settings)
    config = uvicorn.Config(application, host="127.0.0.1", port=api_port, log_level="warning")
    server = uvicorn.Server(config)
    api_thread = Thread(target=server.run, daemon=True)
    api_thread.start()

    handler = partial(
        QuietFrontendRequestHandler,
        directory=str(static_directory),
        public_api_url=api_url,
    )
    http_server = frontend.ThreadingHTTPServer(("127.0.0.1", frontend_port), handler)
    frontend_thread = Thread(target=http_server.serve_forever, daemon=True)
    frontend_thread.start()

    _wait_for(f"{api_url}/health")
    _wait_for(f"{frontend_url}/")

    yield Console(frontend_url=frontend_url, api_url=api_url)

    http_server.shutdown()
    http_server.server_close()
    server.should_exit = True
    api_thread.join(timeout=5)


@pytest.fixture(scope="session")
def browser() -> Iterator[Browser]:
    with sync_playwright() as playwright:
        try:
            instance = playwright.chromium.launch()
        except Error as error:  # pragma: no cover - depends on the host image
            pytest.skip(f"Chromium is unavailable: {error}")
        yield instance
        instance.close()


@pytest.fixture()
def page(browser: Browser, console: Console) -> Iterator[Page]:
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, bypass_csp=True)
    context.add_init_script("localStorage.setItem('memoryloom.tour.v1', 'done')")
    page = context.new_page()
    page.goto(f"{console.frontend_url}/", wait_until="networkidle")
    page.evaluate("localStorage.clear()")
    page.evaluate("localStorage.setItem('memoryloom.tour.v1', 'done')")
    page.goto(f"{console.frontend_url}/#/overview", wait_until="networkidle")
    yield page
    context.close()


def _set_scope(page: Page, console: Console, tenant: str, subject: str) -> None:
    page.evaluate(
        """([tenant, subject]) => localStorage.setItem(
          'memoryloom.scope.v1',
          JSON.stringify({ tenant_id: tenant, subject_id: subject }),
        )""",
        [tenant, subject],
    )
    page.goto(f"{console.frontend_url}/#/overview", wait_until="networkidle")
    page.reload(wait_until="networkidle")


def test_overview_renders_the_four_step_journey(page: Page) -> None:
    expect(page.get_by_role("heading", name="记忆工作台", level=1)).to_be_visible()
    for label in ("工作台", "召回", "记忆", "写入", "架构"):
        expect(page.get_by_role("link", name=label, exact=True)).to_be_visible()
    expect(page.get_by_text("四步走完一次记忆")).to_be_visible()
    expect(page.get_by_role("button", name="载入演示数据")).to_be_visible()


def test_capture_recalls_and_outcome_complete_the_loop(page: Page, console: Console) -> None:
    tenant = f"e2e-{uuid4().hex[:8]}"
    _set_scope(page, console, tenant, "alice")

    page.goto(f"{console.frontend_url}/#/capture?example=1", wait_until="networkidle")
    expect(page.get_by_label("记忆键")).to_have_value("drink.preference")
    page.get_by_role("button", name="保存为记忆").click()
    expect(page.get_by_text("记忆已保存")).to_be_visible()

    page.get_by_role("link", name="记忆", exact=True).click()
    expect(page.get_by_text("drink.preference")).to_be_visible()
    expect(page.get_by_text("decaf coffee")).to_be_visible()

    page.get_by_role("link", name="召回", exact=True).click()
    page.get_by_label("要召回什么").fill("晚上应该准备什么饮料")
    page.get_by_role("button", name="开始召回").click()

    expect(page.get_by_text("1 条结果")).to_be_visible()
    page.get_by_role("button", name="有帮助").first.click()
    expect(page.get_by_text("上下文效用已更新为")).to_be_visible()


def test_scope_switch_clears_previous_results(page: Page, console: Console) -> None:
    tenant = f"e2e-{uuid4().hex[:8]}"
    _set_scope(page, console, tenant, "alice")

    page.goto(f"{console.frontend_url}/#/capture?example=1", wait_until="networkidle")
    page.get_by_role("button", name="保存为记忆").click()
    expect(page.get_by_text("记忆已保存")).to_be_visible()

    page.get_by_role("link", name="记忆", exact=True).click()
    expect(page.get_by_text("drink.preference")).to_be_visible()

    _set_scope(page, console, f"{tenant}-other", "alice")
    page.get_by_role("link", name="记忆", exact=True).click()
    expect(page.get_by_text("当前作用域还没有记忆")).to_be_visible()


def test_architecture_view_explains_the_five_planes(page: Page, console: Console) -> None:
    page.goto(f"{console.frontend_url}/#/architecture", wait_until="networkidle")
    expect(page.get_by_role("heading", name="系统架构", level=1)).to_be_visible()
    for plane in ("Evidence", "Belief", "Experience", "Projection", "Evolution"):
        expect(page.get_by_text(plane, exact=True)).to_be_visible()


def test_visible_states_pass_the_accessibility_audit(page: Page) -> None:
    if not _AXE_SOURCE.is_file():  # pragma: no cover - npm asset is optional locally
        pytest.skip("axe-core is not installed")
    page.add_script_tag(path=str(_AXE_SOURCE))
    violations = page.evaluate(
        """
        async () => {
          const report = await axe.run(document, {
            // Headless Chromium cannot reproduce the platform font rendering
            // used by the design review, so contrast is checked there instead.
            rules: { 'color-contrast': { enabled: false } },
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
          });
          return report.violations.map((violation) => violation.id);
        }
        """
    )
    assert violations == []
