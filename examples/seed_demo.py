"""Seed a representative demo dataset into a local MemoryLoom instance.

Mirrors `frontend/src/demo/seed.ts`; both use the literal idempotency key
``memoryloom:demo:<slug>`` so seeding from the CLI and from the console (in that
order, or repeatedly) never duplicates a record.

Usage:
    uv run python examples/seed_demo.py
    uv run python examples/seed_demo.py --tenant demo --subject bob --base-url http://127.0.0.1:38089
"""

from __future__ import annotations

import argparse
import json
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

DEMO_MEMORIES: tuple[dict[str, Any], ...] = (
    {
        "slug": "morning-coffee",
        "key": "drink.preference",
        "value": "燕麦拿铁",
        "context": {"time_of_day": "morning"},
        "evidence_text": "早上我一般一杯燕麦拿铁，不加糖",
        "confidence": 0.88,
        "source": "conversation",
    },
    {
        "slug": "evening-decaf",
        "key": "drink.preference",
        "value": "低因咖啡",
        "context": {"time_of_day": "evening"},
        "evidence_text": "晚上我只喝低因咖啡",
        "confidence": 0.92,
        "source": "conversation",
    },
    {
        # Same key + context as the record above: appends a superseding revision.
        "slug": "evening-tea",
        "key": "drink.preference",
        "value": "花草茶",
        "context": {"time_of_day": "evening"},
        "evidence_text": "晚上还是算了，改喝花草茶",
        "confidence": 0.9,
        "source": "user_feedback",
    },
    {
        "slug": "dinner-spice",
        "key": "food.spice",
        "value": "微辣",
        "context": {"meal": "dinner"},
        "evidence_text": "晚饭微辣就行，太辣我吃不下",
        "confidence": 0.8,
        "source": "conversation",
    },
    {
        "slug": "focus-window",
        "key": "work.focus_window",
        "value": "上午 9-11 点",
        "context": {"day": "workday"},
        "evidence_text": "我上午思路最清楚，重活尽量排上午",
        "confidence": 0.75,
        "source": "conversation",
    },
    {
        "slug": "commute-route",
        "key": "commute.route",
        "value": "地铁 6 号线",
        "context": {"day": "workday"},
        "evidence_text": "上班一般坐 6 号线，换乘少",
        "confidence": 0.7,
        "source": "conversation",
    },
    {
        "slug": "notify-channel",
        "key": "notification.channel",
        "value": "企业微信",
        "context": {"urgency": "normal"},
        "evidence_text": "不急的事发我企业微信，别发邮件",
        "confidence": 0.85,
        "source": "conversation",
    },
    {
        "slug": "reading-format",
        "key": "reading.format",
        "value": "打印出来看",
        "context": {"task": "review"},
        "evidence_text": "长文档我打印出来看，屏幕上看不进去",
        "confidence": 0.65,
        "source": "conversation",
    },
)


def _post(base_url: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        f"{base_url.rstrip('/')}{path}",
        data=body,
        method="POST",
        headers={"content-type": "application/json"},
    )
    with urlopen(request, timeout=10) as response:
        parsed: object = json.loads(response.read())
    if not isinstance(parsed, dict):
        raise RuntimeError("API returned an unexpected JSON value")
    return parsed


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo memories into MemoryLoom")
    parser.add_argument("--base-url", default="http://127.0.0.1:38089")
    parser.add_argument("--tenant", default="demo")
    parser.add_argument("--subject", default="alice")
    arguments = parser.parse_args()

    created = 0
    replayed = 0
    failed = 0
    for item in DEMO_MEMORIES:
        payload = {
            "tenant_id": arguments.tenant,
            "subject_id": arguments.subject,
            "source": item["source"],
            "idempotency_key": f"memoryloom:demo:{item['slug']}",
            "key": item["key"],
            "value": item["value"],
            "context": item["context"],
            "evidence_text": item["evidence_text"],
            "confidence": item["confidence"],
        }
        try:
            result = _post(arguments.base_url, "/v1/preferences", payload)
        except HTTPError as error:
            failed += 1
            detail = error.read().decode("utf-8", errors="replace")
            print(f"  ! {item['slug']}: HTTP {error.code} {detail[:120]}")
            continue
        if result.get("idempotent_replay"):
            replayed += 1
        else:
            created += 1
            print(f"  + {item['key']} = {item['value']} (#{result['sequence']})")

    print(
        f"\nscope {arguments.tenant}/{arguments.subject}: "
        f"{created} created, {replayed} already present, {failed} failed"
    )
    print(f"open {arguments.base_url} to inspect, or the console at http://127.0.0.1:33009")


if __name__ == "__main__":
    main()
