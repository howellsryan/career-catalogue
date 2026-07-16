# Deploying to Cloudflare Pages

This mirrors how **PocketRPG** is hosted: a Cloudflare Pages project connected
to the GitHub repo via the **Git integration**. Cloudflare builds the site on
every push — there is no deploy workflow in this repo. The repo only carries the
Cloudflare-side config (`wrangler.toml`, `_headers`, `robots.txt` and the
`_config.cloudflare.yml` build override); the build command and branch settings
live in the Cloudflare dashboard, exactly as they do for PocketRPG.

The site stays deployable to **GitHub Pages** at the same time — nothing here
removes that. The only difference between the two hosts is the URL base, handled
by `_config.cloudflare.yml`.

> ### ⚠️ Create a **Pages** project, not a **Worker**
>
> Cloudflare's "Workers & Pages → **Import a repository**" flow now creates a
> **Worker** by default. A Worker runs `npx wrangler deploy`, which prepends
> `npx` to the build command — so `bundle exec jekyll build` becomes
> `npx bundle exec jekyll build` and dies with **"could not determine executable
> to run"** (`npx` only knows Node packages; `bundle` is a Ruby gem). Workers
> also ignore `pages_build_output_dir` in `wrangler.toml`.
>
> A Ruby/Jekyll site must use a **Pages** project, whose build system has native
> Ruby/Jekyll support and runs the build command as-is. Use the **Pages** entry
> point described below, not "Import a repository".

---

## One-time setup

0. **Delete the failed Worker first** (if you already made one). A Worker named
   `career-catalogue` will collide with the Pages project name. Workers & Pages
   → the `career-catalogue` Worker → Settings → Delete.

1. **Create the Pages project.** Go to **Workers & Pages → Create → Pages tab →
   "Connect to Git"** (direct link: `https://dash.cloudflare.com/?to=/:account/pages/new/provider/github`).
   Pick `howellsryan/career-catalogue`. If a screen offers "Import a repository"
   that provisions a *Worker*, back out — you want the **Pages** path above.

2. **Build settings:**

   | Setting                | Value                                                        |
   | ---------------------- | ------------------------------------------------------------ |
   | Framework preset       | None (do **not** rely on the Jekyll preset's default command)|
   | Build command          | `LANG=C.UTF-8 LC_ALL=C.UTF-8 bundle exec jekyll build --config _config.yml,_config.cloudflare.yml` |
   | Build output directory | `_site` (also set in `wrangler.toml`)                        |
   | Production branch      | `main`                                                        |

   The inline `LANG=…` makes the build robust even if you skip the env var below.
   The `--config` layer is what serves the site correctly at the domain root
   instead of under `/career-catalogue`.

3. **Environment variables** (Settings → Environment variables → Production):

   | Variable        | Value    | Why                                                     |
   | --------------- | -------- | ------------------------------------------------------- |
   | `RUBY_VERSION`  | `3.3.6`  | Matches `.ruby-version` and the `github-pages` gem.     |
   | `LANG`          | `C.UTF-8`| Avoids the Ruby-Sass "Invalid US-ASCII character" error (also inlined in the build command as a backup). |

   (No `BUNDLE_WITHOUT` needed — `html-proofer` isn't in the Gemfile, so the
   build bundle only contains what Jekyll needs.)

4. **Save and deploy.** The first build publishes to
   `https://career-catalogue.pages.dev`. Push to any other branch (like the
   redesign branch) for a preview deployment at a `*.pages.dev` alias.

---

## Custom domain (optional)

Add it under the Pages project → **Custom domains**, then update the `url:` in
`_config.cloudflare.yml` and `APP_BASE_URL` in `wrangler.toml` to match, so
canonical URLs, the sitemap and social cards point at the real domain.

---

## What is *not* here (and why)

PocketRPG's `wrangler.toml` binds D1, R2 and Workers AI and ships a `functions/`
directory of Pages Functions, because it's a full application. This blog is a
static site, so it needs none of that — Jekyll emits a plain `_site/` that Pages
serves directly. `.assetsignore` is likewise unnecessary: PocketRPG needs it
because it serves from the repo root (`pages_build_output_dir = "."`), whereas
here the output directory is a clean `_site/`.

---

## Verifying the Cloudflare build locally

The Cloudflare build is just Jekyll with the extra config layer, so you can run
it exactly as Cloudflare will:

```bash
LANG=C.UTF-8 LC_ALL=C.UTF-8 \
  bundle exec jekyll build --config _config.yml,_config.cloudflare.yml

# Links are root-relative under this config (no /career-catalogue prefix):
gem install html-proofer -v "~> 5.0"
htmlproofer ./_site --disable-external --allow-hash-href
```

---

## Troubleshooting

**`npm error could not determine executable to run` / build command shows as
`npx bundle exec jekyll build`.**
You created a Worker, not a Pages project — see the warning box at the top.
Delete the Worker and create a **Pages** project instead.

**`Invalid US-ASCII character "\xE2" …` during Sass compilation.**
The build locale isn't UTF-8. The build command above inlines `LANG=C.UTF-8`;
make sure that prefix is present (and/or set the `LANG` env var).

**Every link 404s / CSS doesn't load on `*.pages.dev`.**
The `--config _config.yml,_config.cloudflare.yml` part of the build command is
missing, so the site built with the `/career-catalogue` base path. Add it back.

**`Could not find html-proofer-…, pdf-reader-…, Ascii85-… (Bundler::GemNotFound)`.**
An older revision listed `html-proofer` in the Gemfile. It has been removed —
pull the latest of this branch. `html-proofer` is now installed standalone in CI
only, never as part of the site build.

**`bundler: command not found: jekyll` or a Ruby version error.**
`RUBY_VERSION` isn't taking effect. Confirm the env var is set to `3.3.6` and
that the Pages project is using build system **v2** (Settings → Build → Build
system version), which honours `.ruby-version`.
