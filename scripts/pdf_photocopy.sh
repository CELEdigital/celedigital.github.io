#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  pdf_photocopy.sh INPUT.pdf OUTPUT.pdf [options]

Options:
  --dpi N           Rasterization DPI (default: 300)
  --brightness N    Brightness tweak for ImageMagick (default: 8)
  --contrast N      Contrast tweak for ImageMagick (default: 42)
  --noise X         Gaussian noise amount (default: 0.35)
  --skew X          Max random rotation degrees per page (default: 0.6)
  --threshold PCT   Binarize at percent, e.g. 58 (off by default)
  -h, --help        Show this help

Example:
  ./scripts/pdf_photocopy.sh in.pdf out-photocopy.pdf --dpi 300 --noise 0.45 --threshold 60
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing dependency: $1" >&2
    exit 1
  fi
}

rand_between() {
  # rand_between MIN MAX
  awk -v min="$1" -v max="$2" 'BEGIN{srand(); print min + (max-min)*rand()}'
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

INPUT="$1"
OUTPUT="$2"
shift 2

DPI=300
BRIGHTNESS=8
CONTRAST=20
NOISE=0.12
SKEW=0.6
THRESHOLD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dpi)
      DPI="${2:-}"; shift 2 ;;
    --brightness)
      BRIGHTNESS="${2:-}"; shift 2 ;;
    --contrast)
      CONTRAST="${2:-}"; shift 2 ;;
    --noise)
      NOISE="${2:-}"; shift 2 ;;
    --skew)
      SKEW="${2:-}"; shift 2 ;;
    --threshold)
      THRESHOLD="${2:-}"; shift 2 ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1 ;;
  esac
done

if [[ ! -f "$INPUT" ]]; then
  echo "Input file not found: $INPUT" >&2
  exit 1
fi

require_cmd gs
require_cmd magick

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

RAW_DIR="$TMPDIR/raw"
PROC_DIR="$TMPDIR/processed"
mkdir -p "$RAW_DIR" "$PROC_DIR"

echo "Rasterizing PDF pages..."
gs \
  -dSAFER \
  -dBATCH \
  -dNOPAUSE \
  -sDEVICE=pnggray \
  -r"$DPI" \
  -sOutputFile="$RAW_DIR/page-%05d.png" \
  "$INPUT" >/dev/null

shopt -s nullglob
PAGES=("$RAW_DIR"/page-*.png)
if [[ ${#PAGES[@]} -eq 0 ]]; then
  echo "No pages produced from input PDF." >&2
  exit 1
fi

echo "Applying photocopy effect..."
for f in "${PAGES[@]}"; do
  base="$(basename "$f")"
  angle="$(rand_between "-$SKEW" "$SKEW")"

  cmd=(
    magick "$f"
    -colorspace Gray
    -auto-level
    -brightness-contrast "${BRIGHTNESS}x${CONTRAST}"
    -attenuate "$NOISE" +noise Gaussian
    -blur 0x0.35
    -background white
    -rotate "$angle"
    -shave 6x6
    -bordercolor white
    -border 6x6
    -alpha off
  )

  if [[ -n "$THRESHOLD" ]]; then
    cmd+=(-threshold "${THRESHOLD}%")
  fi

  cmd+=("$PROC_DIR/$base")
  "${cmd[@]}"
done

echo "Rebuilding PDF..."
magick \
  -density "$DPI" \
  "$PROC_DIR"/page-*.png \
  -units PixelsPerInch \
  "$OUTPUT"

echo "Done: $OUTPUT"
