source "https://rubygems.org"

# Use the github-pages gem so local builds match what GitHub Pages runs in
# production. This pins Jekyll and all supported plugins to the exact versions
# GitHub uses, so "works on my machine" also means "works when deployed".
gem "github-pages", group: :jekyll_plugins

# Plugins used by the site. These are all on the GitHub Pages allow-list, so
# they run on production too.
group :jekyll_plugins do
  gem "jekyll-feed"          # RSS/Atom feed at /feed.xml
  gem "jekyll-seo-tag"       # <meta> description, Open Graph and Twitter cards
  gem "jekyll-sitemap"       # sitemap.xml for search engines
  gem "jekyll-redirect-from" # preserves old post URLs after the migration
end

# Windows and JRuby helpers (harmless elsewhere).
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end
gem "wdm", "~> 0.1.1", platforms: [:mingw, :x64_mingw, :mswin]

# NOTE: link checking uses `html-proofer`, but it is deliberately NOT a
# dependency here. It pulls heavy native gems (pdf-reader, Ascii85, async…)
# that the site build never needs, and their presence broke the Cloudflare
# Pages build. CI installs it standalone instead (`gem install html-proofer`);
# see .github/workflows/ci.yml and README.md.
