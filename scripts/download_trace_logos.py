#!/usr/bin/env python3
"""Download the complete Trace Logos catalog and report its size.

Usage:
  python scripts/download_trace_logos.py --output trace-logos-all
  python scripts/download_trace_logos.py --output trace-logos-all --formats svg png

The downloader is resumable: existing files are skipped after a size check.
It stores the source catalog and a manifest, and never writes to Home
Assistant's .storage directory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

CATALOG_URL = "https://trace-logos.ru/logos.json"
ALLOWED_HOST = "trace-logos.ru"
USER_AGENT = "sms-gammu-viewer-trace-logo-export/1.0"


def fetch(url: str, timeout: int = 30) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 (fixed host below)
        return response.read()


def source_urls(item: dict, formats: set[str]) -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    candidates = [("svg", item.get("svgUrl")), ("png", item.get("pngUrl"))]
    for variant in item.get("variants") or []:
        if isinstance(variant, dict):
            candidates.extend([
                ("svg", variant.get("svgUrl")),
                ("png", variant.get("pngUrl")),
            ])
    for kind, value in candidates:
        if kind not in formats or not value:
            continue
        url = urljoin(CATALOG_URL, str(value))
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.netloc != ALLOWED_HOST:
            continue
        pair = (kind, url)
        if pair not in result:
            result.append(pair)
    return result


def safe_name(item: dict, url: str, kind: str) -> str:
    slug = str(item.get("name") or "logo").strip().lower()
    slug = "".join(ch if ch.isalnum() else "_" for ch in slug).strip("_")[:64] or "logo"
    digest = hashlib.sha256(url.encode()).hexdigest()[:12]
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix not in {".svg", ".png"}:
        suffix = "." + kind
    return f"{slug}-{digest}{suffix}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("trace-logos-all"))
    parser.add_argument("--formats", nargs="+", choices=("svg", "png"), default=["svg", "png"])
    parser.add_argument("--timeout", type=int, default=30)
    args = parser.parse_args()
    formats = set(args.formats)
    args.output.mkdir(parents=True, exist_ok=True)

    try:
        catalog_bytes = fetch(CATALOG_URL, args.timeout)
        payload = json.loads(catalog_bytes)
    except (OSError, ValueError, HTTPError, URLError) as error:
        print(f"Не удалось загрузить каталог: {error}", file=sys.stderr)
        return 2

    (args.output / "logos.json").write_bytes(catalog_bytes)
    items = [item for item in payload.get("logos", []) if isinstance(item, dict) and not item.get("comingSoon")]
    entries = [(item, kind, url) for item in items for kind, url in source_urls(item, formats)]
    manifest: list[dict] = []
    downloaded = skipped = failed = 0
    total = 0
    started = time.monotonic()
    for item, kind, url in entries:
        destination = args.output / kind / safe_name(item, url, kind)
        destination.parent.mkdir(parents=True, exist_ok=True)
        try:
            if destination.is_file() and destination.stat().st_size > 0:
                body_size = destination.stat().st_size
                skipped += 1
            else:
                body = fetch(url, args.timeout)
                destination.write_bytes(body)
                body_size = len(body)
                downloaded += 1
            total += body_size
            manifest.append({"name": item.get("name"), "kind": kind, "source": url, "file": str(destination.relative_to(args.output)), "bytes": body_size})
        except (OSError, HTTPError, URLError) as error:
            failed += 1
            print(f"[{kind}] {url}: {error}", file=sys.stderr)

    (args.output / "manifest.json").write_text(json.dumps({"catalog": CATALOG_URL, "formats": sorted(formats), "files": manifest}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Брендов в каталоге: {len(items)}")
    print(f"Ссылок на скачивание: {len(entries)}")
    print(f"Скачано сейчас: {downloaded}; уже было: {skipped}; ошибок: {failed}")
    print(f"Размер файлов логотипов: {total:,} байт ({total / 1024 / 1024:.2f} MiB)")
    print(f"Время: {time.monotonic() - started:.1f} с")
    print(f"Каталог сохранён в: {args.output.resolve()}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
