from __future__ import annotations

import re

from memoryloom import frontend


def _index() -> str:
    return (frontend._STATIC_DIRECTORY / "index.html").read_text(encoding="utf-8")


def test_frontend_declares_the_memoryloom_brand_assets() -> None:
    index = _index()

    assert 'href="./mark.svg"' in index
    assert 'type="image/svg+xml"' in index
    assert 'name="theme-color"' in index
    assert "#f6f8fc" in index
    # The reskin dropped the previous raster icon set on purpose.
    assert "favicon-32.png" not in index
    assert "anime-" not in index


def test_mark_is_a_self_contained_vector_without_external_references() -> None:
    mark = (frontend._STATIC_DIRECTORY / "mark.svg").read_text(encoding="utf-8")

    assert mark.lstrip().startswith("<svg")
    assert 'role="img"' in mark
    assert 'aria-label="MemoryLoom"' in mark
    # The registry namespace is required; external fetches are not.
    assert "xmlns=" in mark
    assert "<image" not in mark
    assert "xlink:href" not in mark
    assert 'href="http' not in mark
    assert "<script" not in mark


def test_built_styles_use_the_shared_design_tokens() -> None:
    css_files = [path for path in frontend._STATIC_DIRECTORY.glob("assets/*.css")]
    assert css_files, "the build must emit at least one stylesheet"

    bundle = "\n".join(path.read_text(encoding="utf-8") for path in css_files)

    for token in ("--brand:#3659e3", "--ink:#0a1b2e", "--bg:#f6f8fc", "--sh-lg:"):
        assert token in bundle.replace(" ", ""), f"missing design token {token}"
    # Retro anime illustrations belonged to the previous console and must not ship.
    assert not re.search(r"anime-[a-z-]+\.png", bundle)
