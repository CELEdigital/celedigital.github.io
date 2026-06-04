#!/usr/bin/env python3
"""Create an English stub for each newly added/modified Spanish post that has
no English twin yet.

Run from the repo root. Driven by a GitHub Action (env BEFORE / SHA give the
push range); falls back to HEAD~1..HEAD when run locally.

For each changed content/es/posts/<name>.md without content/en/posts/<name>.md,
it writes a *verbatim copy* (front matter + body preserved) with:
  - translationKey ensured (so Hugo links the ES/EN versions), and
  - draft: true (so the untranslated copy is not published).

Idempotent: never overwrites an existing English file.
"""

import os
import re
import subprocess

ES_DIR = "content/es/posts"
EN_DIR = "content/en/posts"


def changed_es_posts():
    before = os.environ.get("BEFORE", "").strip()
    sha = os.environ.get("SHA", "").strip() or "HEAD"
    # all-zeros = no previous commit (first push / new branch)
    base = before if before and set(before) != {"0"} else f"{sha}~1"
    try:
        out = subprocess.check_output(
            ["git", "diff", "--name-only", "--diff-filter=AM", base, sha, "--", ES_DIR],
            text=True,
        )
    except subprocess.CalledProcessError:
        return []
    return [p for p in out.split("\n") if p.endswith(".md")]


def ensure_front_matter(fm: str, stem: str) -> str:
    """Ensure translationKey is present and draft is true in a YAML front-matter
    block (string-level, to preserve the original formatting)."""
    lines = fm.split("\n")
    has_key = any(re.match(r"\s*translationKey\s*:", ln) for ln in lines)
    # drop any existing draft: line, we set our own
    lines = [ln for ln in lines if not re.match(r"\s*draft\s*:", ln)]
    if not has_key:
        lines.append(f"translationKey: {stem}")
    lines.append("draft: true")
    return "\n".join(lines)


def make_stub(es_path: str):
    name = os.path.basename(es_path)
    en_path = os.path.join(EN_DIR, name)
    if os.path.exists(en_path):
        return None  # never clobber an existing (possibly translated) EN file
    text = open(es_path, encoding="utf-8").read()
    m = re.match(r"^---\n(.*?)\n---(.*)$", text, re.S)
    if not m:
        return None  # no YAML front matter; skip
    fm, body = m.group(1), m.group(2)
    stem = os.path.splitext(name)[0]
    new_fm = ensure_front_matter(fm, stem)
    os.makedirs(EN_DIR, exist_ok=True)
    open(en_path, "w", encoding="utf-8").write(f"---\n{new_fm}\n---{body}")
    return en_path


def main():
    created = []
    for es in changed_es_posts():
        if not os.path.exists(es):
            continue
        en = make_stub(es)
        if en:
            created.append(en)
    if created:
        print("Created EN stubs:")
        for c in created:
            print(" ", c)
    else:
        print("No EN stubs to create.")


if __name__ == "__main__":
    main()
