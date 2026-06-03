import random
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import frontmatter

LOGO_CELE = Path(__file__).resolve().parent.parent / "static/logos/cele_blanco.png"
LOGO_UP   = Path(__file__).resolve().parent.parent / "static/logos/logo_up.png"
LOGO_GAP  = 40   # pixels between the two logos
LOGO_PAD  = 80   # pixels from image edges


def add_logos(img, cfg):
    height = max(160, int(min(img.width, img.height) * 0.10))
    logos = []
    for path in (LOGO_CELE, LOGO_UP):
        src = Image.open(path).convert("RGBA")
        w, h = src.size
        new_w = max(1, int(w * height / h))
        logos.append(src.resize((new_w, height), Image.LANCZOS))

    total_w = sum(lo.width for lo in logos) + LOGO_GAP * (len(logos) - 1)
    iw, ih  = img.size

    placement = cfg.get("logo_placement")
    if placement == "zone-top-right":
        # Right-aligned at the top edge of the text zone
        x0 = cfg["erase"][2] - LOGO_PAD - total_w
        y0 = cfg["erase"][1] + LOGO_PAD
    elif cfg["title_xy"][1] > ih / 2:
        # Text at bottom → logos top-right corner
        x0, y0 = iw - LOGO_PAD - total_w, LOGO_PAD
    else:
        # Text at top → logos bottom-right corner
        x0, y0 = iw - LOGO_PAD - total_w, ih - LOGO_PAD - height

    y0 += cfg.get("logo_y_offset", 0)

    canvas = img.convert("RGBA")
    cx = x0
    for lo in logos:
        canvas.paste(lo, (cx, y0), lo)
        cx += lo.width + LOGO_GAP
    return canvas.convert("RGB")

# One representative template per active config (format × group).
# Files are numbered globally across all folders:
#   01-13 → 4x5 folder (all group A)
#   14-26 → story folder (14-15=A, 16-26=B)
#   27-39 → landscape folder (27=B, 28-39=C)
# Per-template overrides: filename → {key: value, ...} patches applied on top of the group config.
TEMPLATE_OVERRIDES = {
    "Diseños para automatizar sin texto-05.jpg": {
        # 4x5/A: shift whole text section down 25%+5% (zone h=1040, shift=312px)
        "label_xy": (156, 1916),
        "title_xy": (156, 2030),
    },
    "Diseños para automatizar sin texto-04.jpg": {
        # 4x5/A: shift whole text section down 40% (zone h=1040, shift=416px)
        "label_xy": (156, 1968),
        "title_xy": (156, 2082),
    },
    "Diseños para automatizar sin texto-10.jpg": {
        # 4x5/A: shift whole text section down 10% (zone h=1040, shift=104px)
        "label_xy": (156, 1656),
        "title_xy": (156, 1770),
    },
    "Diseños para automatizar sin texto-14.jpg": {
        # story/A: shift text section down 10% (zone h=1190, shift=119px)
        "label_xy": (156, 2879),
        "title_xy": (156, 2959),
    },
    "Diseños para automatizar sin texto-20.jpg": {
        # story/B: shift text section up 20% (zone h=1190, shift=238px)
        "label_xy": (156, 2282),
        "title_xy": (156, 2362),
    },
    "Diseños para automatizar sin texto-24.jpg": {
        # logos at top-right of the white zone, shifted up 75% of LOGO_PAD
        "logo_placement": "zone-top-right",
        "logo_y_offset": -380,
    },
    "Diseños para automatizar sin texto-38.jpg": {
        # landscape/C: reduce text width by 5% (1771 → 1682) to wrap earlier
        "max_w": 1682,
    },
}

TEST_REPS = [
    ("4x5",       "A", "Diseños para automatizar sin texto-13.jpg"),
    ("story",     "A", "Diseños para automatizar sin texto-14.jpg"),
    ("story",     "B", "Diseños para automatizar sin texto-24.jpg"),
    ("landscape", "B", "Diseños para automatizar sin texto-27.jpg"),
    ("landscape", "C", "Diseños para automatizar sin texto-33.jpg"),
]

REPO_ROOT  = Path(__file__).resolve().parent.parent
FONTS_DIR  = REPO_ROOT / "static/fonts"
OUTPUT_DIR = REPO_ROOT / "static/flyers/posts"

TEXT_COLOR     = (20, 20, 20)
LABEL_SPACING  = 10   # extra pixels between label characters

# 9 layout configs: 3 formats × 3 design groups (A, B, C)
# All coordinates in actual image pixels (2.083× the folder-named dimensions).
# actual sizes: 4x5=2250×2812, story=2250×4000, landscape=3333×1875
TEMPLATES = [
    {
        "name": "4x5",
        "folder": REPO_ROOT / "static/flyers/1080-x-1350-px",
        "A": {"erase": (135, 1510, 2115, 2550), "sample": (150, 1520),
              "label_xy": (156, 1552), "label_size": 58,
              "title_xy": (156, 1666), "title_size": 162, "line_h": 168, "max_w": 1937,
              "desc_gap": 100, "desc_size": 75, "desc_anchor": None},
        "B": {"erase": (135, 1510, 2115, 2550), "sample": (150, 1520),
              "label_xy": (156, 1552), "label_size": 58,
              "title_xy": (156, 1666), "title_size": 162, "line_h": 168, "max_w": 1937,
              "desc_gap": 100, "desc_size": 75, "desc_anchor": None},
        "C": {"erase": (135, 60, 2115, 900), "sample": None,
              "label_xy": None, "label_size": 0,
              "title_xy": (156, 70), "title_size": 162, "line_h": 168, "max_w": 1937,
              "desc_gap": 80, "desc_size": 75, "desc_anchor": 2550},
    },
    {
        "name": "story",
        "folder": REPO_ROOT / "static/flyers/1080-x-1920-px",
        "A": {"erase": (135, 2740, 2115, 3930), "sample": (150, 2750),
              "label_xy": (156, 2760), "label_size": 58,
              "title_xy": (156, 2840), "title_size": 200, "line_h": 208, "max_w": 1937,
              "desc_gap": 100, "desc_size": 75, "desc_anchor": None},
        "B": {"erase": (135, 2500, 2115, 3690), "sample": (150, 2510),
              "label_xy": (156, 2520), "label_size": 58,
              "title_xy": (156, 2600), "title_size": 200, "line_h": 208, "max_w": 1937,
              "desc_gap": 100, "desc_size": 75, "desc_anchor": None},
        "C": {"erase": (135, 60, 2115, 1200), "sample": None,
              "label_xy": None, "label_size": 0,
              "title_xy": (156, 70), "title_size": 162, "line_h": 168, "max_w": 1937,
              "desc_gap": 80, "desc_size": 75, "desc_anchor": 3700},
    },
    {
        "name": "landscape",
        "folder": REPO_ROOT / "static/flyers/1600-x-900-px",
        "A": {"erase": (188, 531, 2200, 1450), "sample": (200, 540),
              "label_xy": None, "label_size": 0,
              "title_xy": (208, 583), "title_size": 140, "line_h": 154, "max_w": 1771,
              "desc_gap": 100, "desc_size": 79, "desc_anchor": None},
        "B": {"erase": (188, 338, 2200, 1728), "sample": (200, 348),
              "label_xy": (208, 348), "label_size": 58,
              "title_xy": (208, 438), "title_size": 140, "line_h": 154, "max_w": 1771,
              "desc_gap": 100, "desc_size": 79, "desc_anchor": None},
        "C": {"erase": (188, 60, 2200, 900), "sample": None,
              "label_xy": None, "label_size": 0,
              "title_xy": (208, 70), "title_size": 140, "line_h": 154, "max_w": 1771,
              "desc_gap": 80, "desc_size": 79, "desc_anchor": None},
    },
]


def detect_group(path):
    m = re.search(r'(\d+)', Path(path).stem)
    n = int(m.group(1)) if m else 0
    if n <= 15:  return "A"
    if n <= 27:  return "B"
    return "C"


def load_font(size, variant="label"):
    """variant: 'title' | 'label' | 'desc' | 'author'"""
    names = {
        "title":  "Jost-Bold.ttf",
        "label":  "Jost-Regular.ttf",
        "desc":   "GaramondPremrPro.otf",
        "author": "GaramondPremrPro-It.otf",
    }
    path = FONTS_DIR / names[variant]
    if not path.exists():
        raise FileNotFoundError(f"Font not found: {path}")
    return ImageFont.truetype(str(path), size=size)


def draw_spaced_label(draw, text, font, x, y, spacing=LABEL_SPACING):
    """Draw uppercase label text with extra letter spacing."""
    cursor = x
    for ch in text:
        draw.text((cursor, y), ch, font=font, fill=TEXT_COLOR)
        cursor += draw.textlength(ch, font=font) + spacing


def draw_wrapped(draw, text, font, x, y, max_w, line_h):
    words = text.split()
    lines, cur = [], ""
    for word in words:
        candidate = (cur + " " + word).strip()
        if draw.textlength(candidate, font=font) <= max_w:
            cur = candidate
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    for i, line in enumerate(lines):
        draw.text((x, y + i * line_h), line, font=font, fill=TEXT_COLOR)
    return y + len(lines) * line_h


def erase_zone(img, cfg, group):
    x0, y0, x1, y1 = cfg["erase"]
    if group in ("A", "B"):
        bg = img.getpixel(cfg["sample"])[:3]
        draw = ImageDraw.Draw(img)
        draw.rectangle(cfg["erase"], fill=bg)
    else:
        # Group C: semi-transparent cream overlay preserves collage texture
        overlay = Image.new("RGBA", img.size, (245, 241, 236, 100))
        img_rgba = img.convert("RGBA")
        region = overlay.crop((x0, y0, x1, y1))
        img_rgba.paste(region, (x0, y0), region)
        img = img_rgba.convert("RGB")
    return img


def _render_one(post, t, group, chosen, out_path):
    issues  = post.get("issues", [])
    label   = issues[0] if isinstance(issues, list) and issues else (issues or "")
    authors = post.get("author", [])
    author  = ", ".join(authors) if isinstance(authors, list) else (authors or "")
    desc    = post.get("description", "") or ""
    cfg = dict(t[group])
    cfg.update(TEMPLATE_OVERRIDES.get(chosen.name, {}))

    img  = Image.open(chosen).convert("RGB")
    draw = ImageDraw.Draw(img)

    if cfg["label_xy"] and label:
        draw_spaced_label(draw, label.upper(),
                          load_font(cfg["label_size"], variant="label"),
                          cfg["label_xy"][0], cfg["label_xy"][1])

    y_end = draw_wrapped(
        draw, post["title"],
        load_font(cfg["title_size"], variant="title"),
        cfg["title_xy"][0], cfg["title_xy"][1], cfg["max_w"], cfg["line_h"]
    )

    show_author = author and author.strip().upper() != "CELE"
    if show_author:
        y_end = draw_wrapped(
            draw, author,
            load_font(cfg["desc_size"], variant="author"),
            cfg["title_xy"][0], y_end + cfg["desc_gap"],
            cfg["max_w"], cfg["desc_size"] + 8
        )

    if desc:
        desc_y = cfg["desc_anchor"] if cfg["desc_anchor"] else y_end + cfg["desc_gap"]
        draw_wrapped(
            draw, desc,
            load_font(cfg["desc_size"], variant="desc"),
            cfg["title_xy"][0], desc_y, cfg["max_w"], cfg["desc_size"] + 8
        )

    img = add_logos(img, cfg)
    img.save(str(out_path), quality=90)


def generate(md_path, picks=2):
    post = frontmatter.load(md_path)
    slug = post.get("slug") or Path(md_path).stem
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for t in TEMPLATES:
        candidates = sorted(t["folder"].glob("*.jpg"))
        if not candidates:
            print(f"  skipping {t['name']}: no JPEGs in {t['folder']}")
            continue
        chosen_set = random.sample(candidates, min(picks, len(candidates)))
        for chosen in chosen_set:
            group = detect_group(chosen)
            n = re.search(r'(\d+)', chosen.stem).group(1)
            print(f"  template: {chosen.name}  group: {group}")
            out = OUTPUT_DIR / f"{slug}-{t['name']}-{n}.jpg"
            _render_one(post, t, group, chosen, out)
            print(f"  ✓ {out.name}")


def generate_test(md_path):
    """Generate one output per active config using fixed representative templates.
    Outputs named test-<format>-<group>-<slug>.jpg for easy side-by-side comparison."""
    post = frontmatter.load(md_path)
    slug = post.get("slug") or Path(md_path).stem
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    t_by_name = {t["name"]: t for t in TEMPLATES}

    for fmt, group, fname in TEST_REPS:
        t      = t_by_name[fmt]
        chosen = t["folder"] / fname
        if not chosen.exists():
            print(f"  MISSING: {chosen}")
            continue
        out = OUTPUT_DIR / f"test-{fmt}-{group}-{slug}.jpg"
        print(f"  [{fmt}/{group}] {fname}")
        _render_one(post, t, group, chosen, out)
        print(f"  ✓ {out.name}")


if __name__ == "__main__":
    test_mode = "--test" in sys.argv
    paths = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not paths:
        print("Usage: python scripts/generate_flyers.py [--test] content/es/posts/post-slug.md ...")
        sys.exit(1)
    for path in paths:
        print(f"Processing {path}")
        if test_mode:
            generate_test(path)
        else:
            generate(path)
