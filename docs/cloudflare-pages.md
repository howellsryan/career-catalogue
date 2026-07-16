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

---

## One-time setup

1. **Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.**
   Pick `howellsryan/career-catalogue`.

2. **Build settings:**

   | Setting                | Value                                                        |
   | ---------------------- | ------------------------------------------------------------ |
   | Framework preset       | Jekyll (or "None")                                            |
   | Build command          | `bundle exec jekyll build --config _config.yml,_config.cloudflare.yml` |
   | Build output directory | `_site` (also set in `wrangler.toml`)                        |
   | Production branch      | `main`                                                        |

3. **Environment variables** (Settings → Environment variables):

   | Variable        | Value    | Why                                                     |
   | --------------- | -------- | ------------------------------------------------------- |
   | `RUBY_VERSION`  | `3.3.6`  | Matches `.ruby-version` and the `github-pages` gem.     |
   | `BUNDLE_WITHOUT`| `test`   | Skips the CI-only `html-proofer` gem during the build.  |
   | `LANG`          | `C.UTF-8`| Avoids the Ruby-Sass "Invalid US-ASCII character" error.|

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
bundle exec htmlproofer ./_site --disable-external --allow-hash-href
```
