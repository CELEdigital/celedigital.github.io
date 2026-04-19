#!/usr/bin/env python3
"""
update_yaml_placements.py
Adds `issues` and `placements` to CELE content markdown files.

Rules:
  - Processes es/posts and es/publicaciones
  - Skips files that already have placements (unless --force)
  - Adds issues if missing (inferred from title + description + body)
  - Adds placements based on programs + content_type + featured

Usage:
  python3 update_yaml_placements.py --dry-run   # preview changes
  python3 update_yaml_placements.py             # apply changes
  python3 update_yaml_placements.py --force     # overwrite existing placements too
"""

import os
import re
import sys
import yaml
import copy
import argparse
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────────────────────

BASE = Path("/Users/ramiroalvarezugarte/Documents/CELEdigital/content/es")
DIRS = ["posts", "publicaciones"]

# Issue detection: {canonical_name: [keywords]}
ISSUE_KEYWORDS = {
    "Inteligencia Artificial": [
        "inteligencia artificial", "artificial intelligence", "ai governance",
        "machine learning", "algoritmo", "language model", "llm",
        "sistemas de ia", "regulación de ia", "regulacion de ia",
        "ai regulation", "gobernanza de ia", "riesgo de ia",
        "riesgos de ia", "ai risk",
    ],
    "Privacidad y vigilancia": [
        "privacidad", "privacy", "vigilancia", "surveillance",
        "datos personales", "personal data", "osint", "ciberpatrullaje",
        "data protection", "protección de datos", "proteccion de datos",
        "confidencialidad", "secret", "encriptación", "encryption",
    ],
    "LDE": [
        "libertad de expresión", "libertad de expresion",
        "freedom of expression", "free speech", "freedom of speech",
        "libres de expresar", "expresión digital", "expresion digital",
        "discurso libre", "libre expresión",
    ],
    "DDHH": [
        "derechos humanos", "human rights", " ddhh",
        "rights-based", "marco de derechos", "derechos fundamentales",
        "fundamental rights", "inter-american", "interamericano",
        "cidh", "iachr", "onu", "united nations",
    ],
    "Gobernanza de Internet": [
        "gobernanza de internet", "internet governance",
        "igf ", "icann", "regulación de plataformas",
        "platform regulation", "platform governance",
        "digital services act", "dsa ", "ley de servicios digitales",
        "intermediarios de internet", "internet intermediar",
        "net neutrality", "neutralidad de red",
        "multistakeholder", "multi-stakeholder",
    ],
    "Amenazas a la LDE": [
        "desinformación", "desinformacion", "disinformation",
        "hate speech", "discurso de odio",
        "fake news", "noticias falsas",
        "censura", "censorship",
        "moderación de contenido", "content moderation",
        "criminalización", "criminalization",
        "amenaza", "threats to", "blocking", "bloqueo",
        "takedown", "remoción de contenido",
    ],
}

# content_type → block(s) within the hub
CONTENT_TYPE_BLOCKS = {
    "blog":      ["ultimas_noticias_analisis", "blog"],
    "opinion":   ["ultimas_noticias_analisis", "blog"],
    "research":  ["publicaciones"],
    "policy":    ["documentos_de_posicion"],
    "documento_de_posicion": ["documentos_de_posicion"],
    "institutional": ["sala_de_prensa"],
    "press":     ["sala_de_prensa"],
    "evento":    ["eventos"],
    "event":     ["eventos"],
}

# ── Helpers ────────────────────────────────────────────────────────────────────

FRONT_MATTER_RE = re.compile(r'^---\s*\n(.*?)\n---\s*\n', re.DOTALL)


def parse_file(path: Path):
    """Return (front_matter_dict, body_str, raw_yaml_str) or None."""
    text = path.read_text(encoding="utf-8")
    m = FRONT_MATTER_RE.match(text)
    if not m:
        return None
    raw_yaml = m.group(1)
    body = text[m.end():]
    try:
        fm = yaml.safe_load(raw_yaml)
    except yaml.YAMLError as e:
        print(f"  [WARN] YAML parse error in {path.name}: {e}")
        return None
    if not isinstance(fm, dict):
        return None
    return fm, body, raw_yaml, text


def to_list(val):
    """Normalise scalar/list → list."""
    if val is None:
        return []
    if isinstance(val, list):
        return val
    return [val]


def detect_issues(fm, body):
    """Return sorted list of issue tags inferred from content."""
    title = str(fm.get("title", ""))
    description = str(fm.get("description", ""))
    tags = " ".join(str(t) for t in to_list(fm.get("tags", [])))
    text = f"{title} {description} {tags} {body[:3000]}".lower()

    found = []
    for issue, keywords in ISSUE_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            found.append(issue)
    return found


def determine_placements(fm):
    """Return list of placement dicts based on programs + content_type + featured."""
    programs = to_list(fm.get("programs", []))
    content_types = to_list(fm.get("content_type", []))
    featured = bool(fm.get("featured", False))

    placements = []
    hubs = [p for p in programs if p in ("policy", "publicaciones")]

    if not hubs:
        return placements

    weight_counter = [1]

    def add(hub, block):
        placements.append({"hub": hub, "block": block, "weight": weight_counter[0]})
        weight_counter[0] += 1

    for hub in hubs:
        # NOTE: 'destacado' is left to manual curation — 'featured: true' is
        # set on almost every post as a WP migration default, so we do NOT
        # auto-assign it here.

        for ct in content_types:
            ct_lower = str(ct).lower()
            blocks = CONTENT_TYPE_BLOCKS.get(ct_lower, [])
            for block in blocks:
                add(hub, block)

        # Fallback: if no content_type matched any known block, use blog
        matched_any = any(
            str(ct).lower() in CONTENT_TYPE_BLOCKS for ct in content_types
        )
        if not matched_any and content_types:
            add(hub, "blog")

    return placements


def serialize_yaml_block(fm):
    """Serialize front matter dict to YAML string (no document markers)."""
    return yaml.dump(
        fm,
        allow_unicode=True,
        default_flow_style=False,
        sort_keys=False,
        width=120,
    )


def rebuild_file(original_text, new_fm):
    """Replace front matter in file text, preserving body."""
    m = FRONT_MATTER_RE.match(original_text)
    body = original_text[m.end():]
    new_yaml = serialize_yaml_block(new_fm)
    return f"---\n{new_yaml}---\n{body}"


# ── Main ───────────────────────────────────────────────────────────────────────

def process_file(path: Path, dry_run: bool, force: bool, stats: dict):
    result = parse_file(path)
    if result is None:
        stats["skipped"] += 1
        return

    fm, body, raw_yaml, original_text = result
    changed = False
    new_fm = copy.deepcopy(fm)

    # ── Issues ──────────────────────────────────────────────────────────────
    existing_issues = to_list(fm.get("issues"))
    if not existing_issues:
        inferred = detect_issues(fm, body)
        if inferred:
            new_fm["issues"] = inferred
            changed = True
            if dry_run:
                print(f"  + issues: {inferred}")

    # ── Placements ──────────────────────────────────────────────────────────
    existing_placements = fm.get("placements")
    if existing_placements and not force:
        # Already has placements, skip unless --force
        pass
    else:
        new_placements = determine_placements(new_fm)
        if new_placements:
            if existing_placements != new_placements:
                new_fm["placements"] = new_placements
                changed = True
                if dry_run:
                    for p in new_placements:
                        print(f"  + placement: hub={p['hub']} block={p['block']}")

    if not changed:
        stats["unchanged"] += 1
        return

    if not dry_run:
        new_text = rebuild_file(original_text, new_fm)
        path.write_text(new_text, encoding="utf-8")
        stats["updated"] += 1
    else:
        stats["would_update"] += 1


def main():
    parser = argparse.ArgumentParser(description="Update CELE YAML placements")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--force", action="store_true", help="Overwrite existing placements")
    args = parser.parse_args()

    dry_run = args.dry_run
    force = args.force

    if dry_run:
        print("=== DRY RUN — no files will be modified ===\n")

    stats = {"updated": 0, "would_update": 0, "unchanged": 0, "skipped": 0}

    for dir_name in DIRS:
        dir_path = BASE / dir_name
        md_files = sorted(dir_path.glob("*.md"))
        md_files = [f for f in md_files if f.name != "_index.md"]

        print(f"\n{'─'*60}")
        print(f"Directory: {dir_name}  ({len(md_files)} files)")
        print(f"{'─'*60}")

        for path in md_files:
            if dry_run:
                print(f"\n{path.name}")
            process_file(path, dry_run=dry_run, force=force, stats=stats)

    print(f"\n{'═'*60}")
    if dry_run:
        print(f"Would update : {stats['would_update']}")
    else:
        print(f"Updated      : {stats['updated']}")
    print(f"Unchanged    : {stats['unchanged']}")
    print(f"Skipped      : {stats['skipped']}")
    print(f"{'═'*60}")


if __name__ == "__main__":
    main()
