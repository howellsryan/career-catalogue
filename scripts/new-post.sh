#!/usr/bin/env bash
# Scaffold a new draft from the template.
#
#   scripts/new-post.sh "The Title Of My Post"
#
# Creates _drafts/<slug>.md with front matter pre-filled. Drafts are previewable
# locally with `bundle exec jekyll serve --drafts` but are never published until
# you run scripts/publish.sh.
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: scripts/new-post.sh \"Post Title\"" >&2
  exit 1
fi

TITLE="$*"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# slug: lowercase, spaces/underscores -> hyphens, strip anything else
SLUG=$(printf '%s' "$TITLE" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')

DEST="$ROOT/_drafts/${SLUG}.md"
mkdir -p "$ROOT/_drafts"

if [ -e "$DEST" ]; then
  echo "Draft already exists: _drafts/${SLUG}.md" >&2
  exit 1
fi

cat > "$DEST" <<EOF
---
layout: post
title: "${TITLE}"
description: ""
tags: [leadership]
---

Write here.
EOF

echo "Created _drafts/${SLUG}.md"
echo "Preview with:  bundle exec jekyll serve --drafts"
echo "Publish with:  scripts/publish.sh _drafts/${SLUG}.md"
