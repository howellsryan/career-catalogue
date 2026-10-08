# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

A Jekyll blog ("Career Catalogue") deployed to GitHub Pages at
`https://howellsryan.github.io/career-catalogue/` (note the `/career-catalogue`
baseurl — every internal link must go through `relative_url` / `absolute_url`).

## Conventions that matter

- **Posts** live in `_posts/` as `YYYY-MM-DD-slug.md`. Front matter must include
  `layout: post`, `title`, `date` (matching the filename), `description`, and
  `tags`. The body must **not** start with an `# H1` — the layout renders the
  title. `scripts/lint-posts.rb` enforces all of this.
- **Tags** come from a fixed taxonomy defined in `scripts/lint-posts.rb`
  (`ALLOWED_TAGS`). Reuse existing tags; only add a new one there when necessary.
- **Drafts** go in `_drafts/` (never published). Use `scripts/new-post.sh` to
  create one and `scripts/publish.sh` to promote it into `_posts/`.
- **Old URLs** are preserved with `redirect_from` — don't remove those lines.
- **Practice** (`practice.html`, permalink `/practice/`) is the tools catalogue.
  `_data/practice.yml` owns the tool names, routes, job groups and introductions;
  `_includes/practice-header.html` shares breadcrumbs and the tool switcher across
  all nine pages. Original tools (`retro.html`, `forecast.html`, `health.html`,
  `one-to-ones.html`, `room.html`) include `_includes/practice-panels/*`.
  `practice.js` initializes only the mounted tool; calculations and validation
  live in `practice-core.js`. `practice-catalogue.js` preserves old tab bookmarks.
  Keep `assets/css/practice.scss` on existing site tokens. Run
  `node --test scripts/*.test.mjs` when changing these tools.
- **Companion tools** (`work-brief.html`, `fuzzy-search.html`, `experiment.html`,
  `demo.html`) live under `/practice/` and use the same CSS tokens. Their
  `assets/js/*-core.js` modules hold pure validation/calculations and their
  matching `assets/js/*.js` modules manage the page. `practice-kit.js` provides
  browser-local persistence and export helpers. Keep user entries local, render
  previews as text, and show storage failures so readers can export a backup.

## Design system

- All styling is in `assets/css/styles.scss` (Sass, compiled by Jekyll).
- Colours, spacing and type are CSS custom properties on `:root`, with a light
  default and a dark override under both `@media (prefers-color-scheme: dark)`
  and `:root[data-theme="dark"]`. If you add a colour, define it in **all three**
  places so the theme toggle keeps working.
- Fonts: Newsreader (serif, body/headings) + Inter (UI), loaded from Google Fonts
  with system fallbacks.

## Building & verifying

```bash
LANG=C.UTF-8 LC_ALL=C.UTF-8 bundle exec jekyll build   # UTF-8 needed on some shells
ruby scripts/lint-posts.rb
gem install html-proofer -v "~> 5.0"                    # standalone, not in the Gemfile
htmlproofer ./_site --disable-external --allow-hash-href \
  --swap-urls "^/career-catalogue/:/"
```

The `--swap-urls` flag is required because links are `baseurl`-prefixed but
`_site` isn't nested under `career-catalogue/`.

## Gotchas

- GitHub Pages pins gem versions via the `github-pages` gem; only use plugins on
  its allow-list. `html-proofer` is intentionally NOT in the Gemfile (its native
  deps broke the Cloudflare build); CI installs it standalone.
- On some local shells Ruby's Sass throws `Invalid US-ASCII character` — that's a
  locale issue, fixed by exporting a UTF-8 locale, not a code bug.
- A stray `_site/assets/css/style.css` may appear from the Pages default theme;
  it's unused and gitignored via `_site/`.
