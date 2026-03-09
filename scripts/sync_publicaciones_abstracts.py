#!/usr/bin/env python3
"""Populate publication descriptions/abstracts from SSRN RSS.

This script updates markdown files under content/es/publicaciones:
- Sets `description` and `abstract` from SSRN RSS description when available.
- Falls back to `ssrn_reference` for description when RSS abstract is missing.
"""

from __future__ import annotations

import html
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from playwright.sync_api import sync_playwright

RSS_URL = "https://api.ssrn.com/content/v1/journals/5108945/papers/rss"
PUBLICACIONES_DIR = Path("content/es/publicaciones")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)


def clean_text(value: str) -> str:
    text = html.unescape(value or "")
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def fetch_rss_abstracts() -> dict[str, str]:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=UA)
        page.goto(RSS_URL, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(5000)
        rss_payload = page.locator("pre").inner_text(timeout=10000)
        browser.close()

    rss_xml = rss_payload.strip()
    if rss_xml.startswith("&lt;"):
        rss_xml = html.unescape(rss_xml)
    root = ET.fromstring(rss_xml)
    abstracts: dict[str, str] = {}
    for item in root.findall("./channel/item"):
        link = item.findtext("link") or ""
        match = re.search(r"abstract_id=(\d+)", link)
        if not match:
            continue
        ssrn_id = match.group(1)
        description = clean_text(item.findtext("description") or "")
        if description:
            abstracts[ssrn_id] = description
    return abstracts


def split_front_matter(text: str) -> tuple[str, str] | None:
    if not text.startswith("---\n"):
        return None
    rest = text[len("---\n") :]
    marker = "\n---\n"
    idx = rest.find(marker)
    if idx == -1:
        return None
    front = rest[:idx]
    body = rest[idx + len(marker) :]
    return front, body


def normalize_string_field(value: object) -> str:
    if value is None:
        return ""
    return clean_text(str(value))


def yaml_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def get_scalar_field(front: str, key: str) -> str:
    match = re.search(rf"(?m)^{re.escape(key)}:\s*(.+?)\s*$", front)
    if not match:
        return ""
    raw = match.group(1).strip()
    if (raw.startswith('"') and raw.endswith('"')) or (
        raw.startswith("'") and raw.endswith("'")
    ):
        raw = raw[1:-1]
    return clean_text(raw)


def set_scalar_field(front: str, key: str, value: str) -> tuple[str, bool]:
    new_line = f'{key}: "{yaml_escape(value)}"'
    pattern = rf"(?m)^{re.escape(key)}:\s*.*$"
    if re.search(pattern, front):
        updated = re.sub(pattern, new_line, front, count=1)
        return updated, updated != front
    updated = f"{front.rstrip()}\n{new_line}\n"
    return updated, True


def update_publicaciones(abstracts: dict[str, str]) -> tuple[int, int]:
    updated_count = 0
    with_abstract_count = 0
    for path in sorted(PUBLICACIONES_DIR.glob("*.md")):
        if path.name == "_index.md":
            continue

        raw = path.read_text(encoding="utf-8")
        parts = split_front_matter(raw)
        if not parts:
            continue
        front, body = parts
        id_match = re.search(r'(?m)^ssrn_id:\s*"?(\d+)"?\s*$', front)
        if not id_match:
            continue
        ssrn_id = id_match.group(1)
        existing_description = get_scalar_field(front, "description")
        existing_abstract = get_scalar_field(front, "abstract")
        rss_abstract = abstracts.get(ssrn_id, "")
        changed = False

        if rss_abstract:
            with_abstract_count += 1
            if existing_description != rss_abstract:
                front, did_change = set_scalar_field(front, "description", rss_abstract)
                changed = changed or did_change
            if existing_abstract != rss_abstract:
                front, did_change = set_scalar_field(front, "abstract", rss_abstract)
                changed = changed or did_change
            abstract_source = get_scalar_field(front, "abstract_source")
            if abstract_source != "SSRN RSS":
                front, did_change = set_scalar_field(front, "abstract_source", "SSRN RSS")
                changed = changed or did_change
        elif not existing_description:
            reference_fallback = get_scalar_field(front, "ssrn_reference")
            if reference_fallback:
                front, did_change = set_scalar_field(
                    front, "description", reference_fallback
                )
                changed = changed or did_change

        if changed:
            path.write_text(f"---\n{front.rstrip()}\n---\n{body}", encoding="utf-8")
            updated_count += 1

    return updated_count, with_abstract_count


def main() -> int:
    if not PUBLICACIONES_DIR.exists():
        print(f"Directory not found: {PUBLICACIONES_DIR}", file=sys.stderr)
        return 1

    abstracts = fetch_rss_abstracts()
    updated, with_abstract = update_publicaciones(abstracts)
    print(f"RSS abstracts fetched: {len(abstracts)}")
    print(f"Files with abstract available: {with_abstract}")
    print(f"Files updated: {updated}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
