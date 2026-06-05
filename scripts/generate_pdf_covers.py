#!/usr/bin/env python3
"""Render the first page of each publication PDF into a cover thumbnail.

For every publication that uploads a PDF (front-matter `file: /files/<stem>.pdf`),
this writes `static/covers/<stem>.jpg` — a render of page 1. The site picks it up
automatically: `layouts/partials/func/page-image.html` falls back to
`/covers/<stem>.jpg` when a page has no `cover`/`image` set. No content files are
edited.

Selection of what to process:
  - In CI: the added/modified PDFs under static/files AND the PDFs referenced by
    added/modified publication markdown, within the push range (env BEFORE/SHA).
  - Locally: pass PDF paths and/or publication .md paths as arguments, or use
    `--all` to backfill every publication PDF that is missing a cover.

Idempotent: skips a cover that already exists unless `--force` is given.

Deps: pymupdf (PDF render), Pillow (JPEG encode).
"""

import glob
import os
import subprocess
import sys

import fitz  # PyMuPDF
import frontmatter
from PIL import Image

FILES_DIR = "static/files"
COVERS_DIR = "static/covers"
PUB_GLOBS = ["content/es/publicaciones/*.md", "content/en/publicaciones/*.md"]
MAX_WIDTH = 1000          # downscale wide renders to keep covers light
RENDER_ZOOM = 2.0         # ~144 dpi before any downscale
JPEG_QUALITY = 85


def git_changed(base, sha, *paths):
    try:
        out = subprocess.check_output(
            ["git", "diff", "--name-only", "--diff-filter=AM", base, sha, "--", *paths],
            text=True,
        )
    except subprocess.CalledProcessError:
        return []
    return [p for p in out.split("\n") if p.strip()]


def pdf_for_publication(md_path, skip_if_cover=True):
    """Return the static/files/... path of the PDF a publication references.

    Returns None when there is no PDF, or (when skip_if_cover) when the page
    already sets an explicit `cover`/`image` — in that case the rendered cover
    would never be used, so we don't create an orphan file.
    """
    try:
        meta = frontmatter.load(md_path).metadata
    except Exception:
        return None
    if skip_if_cover and (meta.get("cover") or meta.get("image")):
        return None
    ref = meta.get("file")
    if not isinstance(ref, str) or not ref.strip():
        return None
    # `file` is a site path like /files/Foo.pdf -> static/files/Foo.pdf
    rel = ref.lstrip("/")
    if not rel.startswith("files/"):
        return None
    return os.path.join("static", rel)


def cover_path_for_pdf(pdf_path):
    stem = os.path.splitext(os.path.basename(pdf_path))[0]
    return os.path.join(COVERS_DIR, f"{stem}.jpg")


def render_cover(pdf_path, force=False):
    """Render page 1 of pdf_path to static/covers/<stem>.jpg. Returns path or None."""
    if not os.path.exists(pdf_path):
        print(f"  ! PDF not found: {pdf_path}")
        return None
    out = cover_path_for_pdf(pdf_path)
    if os.path.exists(out) and not force:
        return None  # already have a cover; leave it alone
    try:
        doc = fitz.open(pdf_path)
        if doc.page_count == 0:
            print(f"  ! empty PDF: {pdf_path}")
            return None
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(RENDER_ZOOM, RENDER_ZOOM))
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        if img.width > MAX_WIDTH:
            h = round(img.height * MAX_WIDTH / img.width)
            img = img.resize((MAX_WIDTH, h), Image.LANCZOS)
        os.makedirs(COVERS_DIR, exist_ok=True)
        img.save(out, "JPEG", quality=JPEG_QUALITY)
        return out
    except Exception as exc:  # noqa: BLE001 - never break the build over one PDF
        print(f"  ! failed to render {pdf_path}: {exc}")
        return None


def all_publication_mds():
    mds = []
    for g in PUB_GLOBS:
        mds.extend(glob.glob(g))
    return mds


def mds_referencing_pdfs(pdf_stems):
    """All publication .md whose referenced PDF stem is in pdf_stems."""
    hits = []
    for md in all_publication_mds():
        p = pdf_for_publication(md, skip_if_cover=False)
        if p and os.path.splitext(os.path.basename(p))[0] in pdf_stems:
            hits.append(md)
    return hits


def collect_targets(args):
    """Resolve the set of PDF paths to render. Publication-centric: a PDF is only
    rendered when a paper references it and has no explicit cover/image."""
    force = "--force" in args
    do_all = "--all" in args
    explicit = [a for a in args if a.endswith((".pdf", ".md"))]

    # 1) Figure out which publication markdown files are in scope.
    mds = set()
    if do_all:
        mds.update(all_publication_mds())
    elif explicit:
        mds.update(a for a in explicit if a.endswith(".md"))
        pdf_stems = {
            os.path.splitext(os.path.basename(a))[0]
            for a in explicit if a.endswith(".pdf")
        }
        if pdf_stems:
            mds.update(mds_referencing_pdfs(pdf_stems))
    else:
        before = os.environ.get("BEFORE", "").strip()
        sha = os.environ.get("SHA", "").strip() or "HEAD"
        base = before if before and set(before) != {"0"} else f"{sha}~1"
        pub_dirs = sorted({g.rsplit("/", 1)[0] for g in PUB_GLOBS})
        mds.update(m for m in git_changed(base, sha, *pub_dirs) if m.endswith(".md"))
        changed_pdf_stems = {
            os.path.splitext(os.path.basename(f))[0]
            for f in git_changed(base, sha, FILES_DIR) if f.endswith(".pdf")
        }
        if changed_pdf_stems:
            mds.update(mds_referencing_pdfs(changed_pdf_stems))

    # 2) Resolve each in-scope paper to a PDF, skipping those with explicit covers.
    pdfs = set()
    for md in mds:
        if not os.path.exists(md):
            continue
        p = pdf_for_publication(md)  # skip_if_cover=True
        if p:
            pdfs.add(p)
    return pdfs, force


def main():
    pdfs, force = collect_targets(sys.argv[1:])
    made = []
    for pdf in sorted(pdfs):
        out = render_cover(pdf, force=force)
        if out:
            made.append(out)
    if made:
        print("Rendered covers:")
        for m in made:
            print(" ", m)
    else:
        print("No covers to render.")


if __name__ == "__main__":
    main()
