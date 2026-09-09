#!/usr/bin/env python3
"""Synchronize the bundled Trace Logos SVG catalog.

With --source, imports an existing export created from logos.json and its
manifest. Without --source, downloads the current public catalog and SVGs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sys
import time
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "custom_components" / "sms_gammu_viewer" / "frontend" / "brand_assets"
CATALOG_URL = "https://trace-logos.ru/logos.json"
STATIC_PREFIX = "/sms-viewer/frontend/brand_assets/"
# A few detailed logos (for example Google Maps) are several MiB. Keep a
# generous per-file limit while still rejecting accidental HTML/archives.
MAX_SVG_BYTES = 16 * 1024 * 1024


def fetch(url: str) -> bytes:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "sms-gammu-viewer-logo-sync/1.0"})
            with urlopen(request, timeout=45) as response:  # noqa: S310 - host checked by caller
                return response.read()
        except Exception as error:  # network failures are transient during the monthly job
            last_error = error
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"failed to download {url}: {last_error}") from last_error


def valid_url(value: object) -> str:
    if not value:
        return ""
    url = urljoin(CATALOG_URL, str(value))
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != "trace-logos.ru":
        return ""
    if not parsed.path.startswith("/assets/logos/") or not parsed.path.lower().endswith(".svg"):
        return ""
    # Trace Logos occasionally publishes filenames containing spaces or brackets.
    # Quote only the path so the host and query remain unchanged and safe to check.
    safe_path = quote(parsed.path, safe="/%:@-._~!$&'()*+,;=")
    return urlunparse(parsed._replace(path=safe_path))


def validate_svg(data: bytes, source: str) -> None:
    if not data or len(data) > MAX_SVG_BYTES:
        raise ValueError(f"invalid SVG size for {source}: {len(data)}")
    lowered = data.lower()
    forbidden = (b"<!doctype", b"<!entity", b"<script", b"javascript:", b"file://")
    if any(token in lowered for token in forbidden):
        raise ValueError(f"unsafe SVG content in {source}")
    if re.search(rb"(?:href|src)\s*=\s*['\"]\s*https?://", lowered):
        raise ValueError(f"external reference in {source}")
    ElementTree.fromstring(data)


def filename_for(url: str) -> str:
    stem = Path(urlparse(url).path).stem
    stem = re.sub(r"[^a-zA-Z0-9._()-]+", "-", stem).strip("-.")[:100] or "logo"
    return f"svg/{stem}-{hashlib.sha256(url.encode()).hexdigest()[:12]}.svg"


def load_source(source: Path | None) -> tuple[dict, dict[str, Path]]:
    if source:
        payload = json.loads((source / "logos.json").read_text(encoding="utf-8"))
        export = json.loads((source / "manifest.json").read_text(encoding="utf-8"))
        paths = {
            str(item["source"]): source / str(item["file"])
            for item in export.get("files", [])
            if item.get("kind") == "svg" and item.get("source") and item.get("file")
        }
        return payload, paths
    return json.loads(fetch(CATALOG_URL)), {}


def old_catalog() -> dict:
    path = OUTPUT / "catalog.json"
    if not path.exists():
        return {"logos": []}
    return json.loads(path.read_text(encoding="utf-8"))


def sync(source: Path | None) -> tuple[list[str], list[str]]:
    payload, source_paths = load_source(source)
    previous = old_catalog()
    previous_names = {str(item.get("name")) for item in previous.get("logos", [])}
    previous_hashes = {
        str(item.get("sourceUrl")): str(item.get("sha256"))
        for item in previous.get("assets", [])
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    assets: dict[str, dict] = {}

    def materialize(value: object) -> tuple[str, str]:
        url = valid_url(value)
        if not url:
            return "", ""
        relative = filename_for(url)
        destination = OUTPUT / relative
        if url in source_paths:
            data = source_paths[url].read_bytes()
        elif destination.exists():
            data = destination.read_bytes()
        else:
            data = fetch(url)
        validate_svg(data, url)
        digest = hashlib.sha256(data).hexdigest()
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or destination.read_bytes() != data:
            destination.write_bytes(data)
        assets[url] = {"sourceUrl": url, "file": relative, "sha256": digest, "bytes": len(data)}
        return STATIC_PREFIX + relative, relative

    logos = []
    for raw in payload.get("logos", []):
        if not isinstance(raw, dict) or raw.get("comingSoon"):
            continue
        local_url, local_file = materialize(raw.get("svgUrl"))
        if not local_url:
            continue
        item = {key: raw.get(key) for key in ("name", "name_en", "tags", "categorySlug", "ecosystem", "dateAdded", "svgUrl") if raw.get(key) is not None}
        item.update({"localUrl": local_url, "localFile": local_file})
        variants = []
        for raw_variant in raw.get("variants") or []:
            if not isinstance(raw_variant, dict):
                continue
            variant_url, variant_file = materialize(raw_variant.get("svgUrl"))
            if variant_url:
                variants.append({
                    "label": raw_variant.get("label", ""),
                    "svgUrl": raw_variant.get("svgUrl"),
                    "localUrl": variant_url,
                    "localFile": variant_file,
                    "wide": bool(raw_variant.get("wide")),
                })
        if variants:
            item["variants"] = variants
        logos.append(item)

    # The export may contain SVG variants that the flattened catalog does not
    # reference directly. Keep every downloaded SVG in the bundle so the
    # embedded database remains a complete copy of the supplied export.
    for url, source_path in source_paths.items():
        normalized = valid_url(url)
        if not normalized or normalized in assets:
            continue
        data = source_path.read_bytes()
        validate_svg(data, normalized)
        relative = filename_for(normalized)
        destination = OUTPUT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or destination.read_bytes() != data:
            destination.write_bytes(data)
        assets[normalized] = {"sourceUrl": normalized, "file": relative, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}

    result = {
        "source": CATALOG_URL,
        "updated": payload.get("updated", ""),
        "logos": logos,
        "assets": sorted(assets.values(), key=lambda item: item["sourceUrl"]),
    }
    (OUTPUT / "catalog.json").write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    added = sorted({str(item.get("name")) for item in logos} - previous_names)
    changed = sorted(
        Path(item["file"]).name
        for item in assets.values()
        if previous_hashes.get(item["sourceUrl"]) not in (None, item["sha256"])
    )
    return added, changed


def bump_minor() -> str:
    path = ROOT / "custom_components" / "sms_gammu_viewer" / "manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)(?:b\d+)?", str(manifest["version"]))
    if not match:
        raise ValueError(f"unsupported version: {manifest['version']}")
    version = f"{match.group(1)}.{int(match.group(2)) + 1}.0"
    manifest["version"] = version
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return version


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path)
    parser.add_argument("--notes-file", type=Path)
    parser.add_argument("--bump-minor", action="store_true")
    args = parser.parse_args()
    added, changed = sync(args.source)
    version = bump_minor() if args.bump_minor and (added or changed) else ""
    if args.notes_file:
        lines = ["## Обновление встроенной базы Trace Logos", ""]
        if added:
            lines += ["Добавлены логотипы:", "", *[f"- {name}" for name in added], ""]
        if changed:
            lines += [f"Обновлены SVG-файлы: {len(changed)}.", ""]
        args.notes_file.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"added": added, "changed": changed, "version": version}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
