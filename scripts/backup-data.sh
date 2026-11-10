#!/bin/bash
# Back up the data that can't be regenerated: taste votes and library reviews.
#
#   scripts/backup-data.sh                  votes + review data  -> ~/Documents/PosterLab/backups
#   scripts/backup-data.sh /Volumes/Disk    same, to another folder (an external disk, say)
#   scripts/backup-data.sh --full [folder]  the whole library too (images, crops, segmentation)
#
# The default archive holds:
#   taste/taste.json, taste/assets          every vote and the image it was cast on
#   library/*.json                          library index, taxonomy, type systems, curation
#   library/posters/*/*.json, *.md          per-poster records, review status, tags, captions
#   library/reviews/                        saved review sessions
#   kerning/*.json                          your kerning pairs per font, when there are any
#
# It leaves out what can be rebuilt: trained models, the SigLIP index, segmentation
# masks and image crops. --full adds everything in library/ except models and the index.
#
# Restore:  tar -xzf posterlab-data-<date>.tar.gz -C /path/to/posters
# The archive is written next to a .sha256 file; check with  shasum -a 256 -c <file>.sha256

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
dest="${POSTERLAB_BACKUPS:-$HOME/Documents/PosterLab/backups}"
full=0

for arg in "$@"; do
  case "$arg" in
    --full) full=1 ;;
    -h|--help) sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Unknown option: $arg" >&2; exit 2 ;;
    *) dest="$arg" ;;
  esac
done

cd "$root"
[ -f taste/taste.json ] || { echo "No taste/taste.json in $root" >&2; exit 1; }
[ -d library/posters ] || { echo "No library/posters in $root" >&2; exit 1; }

case "$(cd "$(dirname "$dest")" 2>/dev/null && pwd)/" in
  "$root"/*) echo "Choose a folder outside the project: $dest" >&2; exit 2 ;;
esac

mkdir -p "$dest"
stamp="$(date +%Y%m%d-%H%M%S)"
kind="data"; [ "$full" = 1 ] && kind="full"
archive="$dest/posterlab-$kind-$stamp.tar.gz"
list="$(mktemp -t posterlab-backup)"
trap 'rm -f "$list" "$archive.partial"' EXIT

{
  echo taste/taste.json
  find taste/assets -type f ! -name .DS_Store
  if [ -d kerning ]; then find kerning -type f -name '*.json'; fi
  if [ "$full" = 1 ]; then
    find library -type f ! -name .DS_Store \
      ! -path 'library/models/*' ! -path 'library/semantic-siglip/*'
  else
    find library -maxdepth 1 -type f -name '*.json'
    find library/posters -type f \( -name '*.json' -o -name '*.md' \)
    find library/reviews -type f ! -name .DS_Store
  fi
} | LC_ALL=C sort > "$list"

files="$(wc -l < "$list" | tr -d ' ')"
bytes="$(tr '\n' '\0' < "$list" | xargs -0 stat -f '%z' | awk '{s+=$1} END {printf "%.0f", s}')"
free_kb="$(df -k "$dest" | awk 'NR==2 {print $4}')"
# JSON packs to about a seventh; images hardly pack at all.
need_kb=$(( bytes / 1024 / 4 )); [ "$full" = 1 ] && need_kb=$(( bytes / 1024 ))
if [ "$free_kb" -lt $(( need_kb + 1048576 )) ]; then
  echo "Not enough room in $dest: $(( free_kb / 1024 )) MB free, about $(( need_kb / 1024 + 1024 )) MB wanted." >&2
  exit 1
fi

echo "Packing $files files ($(( bytes / 1048576 )) MB) …"
COPYFILE_DISABLE=1 tar -czf "$archive.partial" -T "$list"

packed="$(tar -tzf "$archive.partial" | wc -l | tr -d ' ')"
if [ "$packed" != "$files" ]; then
  echo "Archive holds $packed of $files files; not kept." >&2
  exit 1
fi
if ! tar -xzOf "$archive.partial" taste/taste.json | cmp -s - taste/taste.json; then
  echo "taste.json changed while the backup ran; run it again." >&2
  exit 1
fi

mv "$archive.partial" "$archive"
( cd "$dest" && shasum -a 256 "$(basename "$archive")" > "$(basename "$archive").sha256" )

images="$(grep -c '^taste/assets/' "$list" || true)"
records="$(grep -c '/record\.json$' "$list" || true)"
size_mb="$(( $(stat -f '%z' "$archive") / 1048576 ))"
echo "Saved $archive"
echo "  $size_mb MB · $files files · $records poster records · taste.json $(( $(stat -f '%z' taste/taste.json) / 1024 )) KB · $images taste images"
echo "  Other backups here: $(find "$dest" -maxdepth 1 -name 'posterlab-*.tar.gz' | wc -l | tr -d ' ') in all, $(du -sh "$dest" | cut -f1) on disk"
