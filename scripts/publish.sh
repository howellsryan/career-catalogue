#!/usr/bin/env bash
# Publish a draft: stamp it with today's date and move it into _posts/.
#
#   scripts/publish.sh _drafts/my-post.md
#
# The file is renamed to _posts/YYYY-MM-DD-<slug>.md and a `date:` line is added
# to its front matter so ordering and the displayed date are correct.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: scripts/publish.sh _drafts/<slug>.md" >&2
  exit 1
fi

SRC="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[ -f "$SRC" ] || { echo "No such draft: $SRC" >&2; exit 1; }

BASE=$(basename "$SRC" .md)
TODAY=$(date +%Y-%m-%d)
STAMP=$(date "+%Y-%m-%d %H:%M:%S %z")
DEST="$ROOT/_posts/${TODAY}-${BASE}.md"

mkdir -p "$ROOT/_posts"
[ -e "$DEST" ] && { echo "Target already exists: $DEST" >&2; exit 1; }

# Insert a `date:` line right after the opening `---` if none is present.
if grep -qE '^date:' "$SRC"; then
  cp "$SRC" "$DEST"
else
  awk -v d="$STAMP" 'NR==1 && $0=="---"{print; print "date: " d; next} {print}' "$SRC" > "$DEST"
fi

rm "$SRC"
echo "Published -> _posts/${TODAY}-${BASE}.md"
echo "Review, then: git add -A && git commit -m \"Add post: ${BASE}\" && git push"
