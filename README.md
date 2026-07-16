# Career Catalogue

A personal blog on engineering leadership, agile delivery, applied AI and the
occasional side project. Built with [Jekyll](https://jekyllrb.com/) and hosted on
GitHub Pages at **https://howellsryan.github.io/career-catalogue/**.

---

## Writing a post

Posts live in `_posts/` and are named `YYYY-MM-DD-slug.md`. Every post needs a
small block of front matter at the top:

```yaml
---
layout: post
title: "Radical Candour"
date: 2025-07-29 18:35:47 +0100
description: "One or two sentences for the home page, search and social previews."
tags: [leadership, feedback]
---
```

| Field         | Required | Notes                                                        |
| ------------- | -------- | ------------------------------------------------------------ |
| `layout`      | yes      | Always `post`.                                               |
| `title`       | yes      | Shown as the page heading — no need for a `# H1` in the body. |
| `date`        | yes      | Must match the date in the filename.                         |
| `description` | yes      | ~120–160 characters. Powers SEO and the home-page excerpt.   |
| `tags`        | yes      | One or more from the taxonomy below.                         |

Do **not** repeat the title as an `# H1` in the body — the layout renders it for you.

### The recommended flow (drafts)

```bash
# 1. Scaffold a draft (creates _drafts/the-title.md)
scripts/new-post.sh "The Title Of My Post"

# 2. Write, previewing live (drafts are only visible with --drafts)
bundle exec jekyll serve --drafts

# 3. Publish — stamps today's date and moves it into _posts/
scripts/publish.sh _drafts/the-title-of-my-post.md

# 4. Ship
git add -A && git commit -m "Add post: the title of my post" && git push
```

Anything in `_drafts/` is never published, so half-finished pieces are safe to commit.

### Tag taxonomy

Keep tags consistent so the [Topics](https://howellsryan.github.io/career-catalogue/tags/)
page stays useful. Current vocabulary (extend it in `scripts/lint-posts.rb` when you
genuinely need a new one):

`leadership` · `engineering-management` · `agile` · `ai` · `engineering-practice` ·
`software-design` · `architecture` · `productivity` · `career` · `projects` ·
`security` · `algorithms` · `culture` · `wellbeing` · `product` · `hiring` ·
`feedback` · `communication` · `mindset` · `reflections` · `networking` ·
`testing` · `azure` · `agentic-workflows`

---

## Running locally

```bash
bundle install
bundle exec jekyll serve            # http://localhost:4000/career-catalogue/
bundle exec jekyll serve --drafts   # include work-in-progress drafts
```

> If Sass fails with an "Invalid US-ASCII character" error, your shell locale
> isn't UTF-8. Prefix commands with `LANG=C.UTF-8 LC_ALL=C.UTF-8`. GitHub Pages
> builds in UTF-8, so this only affects some local environments.

### Checks

```bash
ruby scripts/lint-posts.rb          # validates front matter + tags
bundle exec jekyll build

# Link check (html-proofer is installed standalone, not via the Gemfile):
gem install html-proofer -v "~> 5.0"
htmlproofer ./_site --disable-external --allow-hash-href \
  --swap-urls "^/career-catalogue/:/"
```

CI (`.github/workflows/ci.yml`) runs all three on every pull request.

---

## How it's built

| Piece                 | Where                                             |
| --------------------- | ------------------------------------------------- |
| Layouts               | `_layouts/` (`default`, `post`, `page`)           |
| Partials              | `_includes/` (`head`, `header`, `footer`, `reading-time`) |
| Design system / CSS   | `assets/css/styles.scss` (light + dark themes)    |
| Theme toggle          | `assets/js/theme.js`                              |
| Home (search + list)  | `index.html` — rendered at build time, filtered client-side |
| Topics                | `tags.html`                                       |
| Config & plugins      | `_config.yml`                                     |

Old URLs from before the `_posts/` migration (e.g. `/Radical_Candour`) are
preserved via `redirect_from` in each post's front matter, powered by
`jekyll-redirect-from`.
