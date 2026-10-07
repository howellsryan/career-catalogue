import { Parser } from "htmlparser2";
import { FactError, sourceUrl, validFactDate } from "./domain.js";
import type { Candidate, Category } from "./domain.js";

export interface SourceDocument {
  url: string; publisher: string; primary: boolean; organization: string;
  published_at: string | null; text: string;
}
export interface EvidenceProvider {
  generate(category: Category, day: string): Promise<SourceDocument[]>;
  review(candidate: Candidate, day: string): Promise<SourceDocument[]>;
}
const MAX_BODY_BYTES = 512_000;
const MAX_DOCUMENTS = 6;
const MAX_TEXT = 3_500;
const MAX_FETCHES = 16;
const PHASE_TIMEOUT_MS = 40_000;
const USER_AGENT = "CareerCatalogueDailyFact/1.0 (+https://github.com/howellsryan/career-catalogue)";
type Publisher = { domain: string; name: string; organization: string; primary: boolean };
const PUBLISHERS: Publisher[] = [
  { domain: "nasa.gov", name: "NASA", organization: "nasa", primary: true },
  { domain: "news.mit.edu", name: "MIT News", organization: "mit", primary: true },
  { domain: "si.edu", name: "Smithsonian Institution", organization: "smithsonian", primary: true },
  { domain: "smithsonianmag.com", name: "Smithsonian Magazine", organization: "smithsonian", primary: false },
  { domain: "nih.gov", name: "National Institutes of Health", organization: "nih", primary: true },
  { domain: "noaa.gov", name: "NOAA", organization: "noaa", primary: true },
  { domain: "usgs.gov", name: "US Geological Survey", organization: "usgs", primary: true },
  { domain: "esa.int", name: "European Space Agency", organization: "esa", primary: true },
  { domain: "loc.gov", name: "Library of Congress", organization: "loc", primary: true },
  { domain: "nps.gov", name: "National Park Service", organization: "nps", primary: true },
  { domain: "nationalarchives.gov.uk", name: "The National Archives", organization: "nationalarchives", primary: true },
  { domain: "guinnessworldrecords.com", name: "Guinness World Records", organization: "guinness", primary: true },
  { domain: "worldathletics.org", name: "World Athletics", organization: "worldathletics", primary: true },
  { domain: "olympics.com", name: "International Olympic Committee", organization: "ioc", primary: true },
  { domain: "olympic.org", name: "International Olympic Committee", organization: "ioc", primary: true },
  { domain: "fifa.com", name: "FIFA", organization: "fifa", primary: true },
  { domain: "olympedia.org", name: "Olympedia", organization: "olympedia", primary: true },
  { domain: "nhm.ac.uk", name: "Natural History Museum", organization: "nhm", primary: true },
  { domain: "britishmuseum.org", name: "The British Museum", organization: "britishmuseum", primary: true },
  { domain: "bbc.com", name: "BBC", organization: "bbc", primary: false },
  { domain: "bbc.co.uk", name: "BBC", organization: "bbc", primary: false },
  { domain: "bbci.co.uk", name: "BBC", organization: "bbc", primary: false },
  { domain: "theguardian.com", name: "The Guardian", organization: "guardian", primary: false },
  { domain: "reuters.com", name: "Reuters", organization: "reuters", primary: false },
  { domain: "nature.com", name: "Nature", organization: "nature", primary: false },
  { domain: "science.org", name: "Science", organization: "science", primary: false },
  { domain: "britannica.com", name: "Encyclopaedia Britannica", organization: "britannica", primary: false }
];
const NASA = "https://www.nasa.gov/news-release/feed/";
const MIT = "https://news.mit.edu/rss/";
const SMITHSONIAN = "https://www.smithsonianmag.com/rss/";
const FEEDS: Record<Category, string[]> = {
  news: ["https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", "https://www.theguardian.com/science/rss"],
  history: [SMITHSONIAN + "history/", MIT + "topic/history"],
  science: [NASA, MIT + "research"],
  nature: [SMITHSONIAN + "science-nature/", MIT + "topic/biology-and-genetics"],
  sport: ["https://feeds.bbci.co.uk/sport/athletics/rss.xml"],
  human: [MIT + "topic/health-sciences-and-technology", MIT + "topic/social-sciences"],
  technology: [MIT + "topic/technology", NASA],
  culture: [SMITHSONIAN + "arts-culture/", MIT + "topic/humanities"],
  other: [SMITHSONIAN + "smart-news/", MIT + "research"]
};
const QUERIES: Record<Category, string[]> = {
  news: ["recent scientific discovery", "new species discovery", "space exploration discovery"],
  history: ["archaeological discovery", "ancient engineering", "history invention", "historic expedition"],
  science: ["astronomical discovery", "physics experiment", "scientific discovery", "space probe"],
  nature: ["animal adaptation", "deep sea discovery", "plant adaptation", "animal migration"],
  sport: ["world record athletics", "Olympic Games record", "swimming world record", "Guinness World Records"],
  human: ["human memory", "human sensory system", "human physiology", "language acquisition"],
  technology: ["engineering invention", "robotics discovery", "communication invention", "computer history"],
  culture: ["musical instrument history", "ancient art discovery", "writing system", "museum collection"],
  other: ["unusual natural phenomenon", "historic discovery", "engineering record", "archaeological discovery"]
};
function publisher(url: string): Publisher | undefined {
  const host = new URL(url).hostname;
  return PUBLISHERS.find(p => host === p.domain || host.endsWith("." + p.domain));
}
function allowed(value: string, base?: string): string | null {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.href.length > 2048) return null;
    if (url.hostname !== "en.wikipedia.org" && !publisher(url.href)) return null;
    url.hash = ""; return url.href;
  } catch { return null; }
}
function discovered(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    // Older publisher feeds still contain HTTP links. Fetch their HTTPS version.
    if (url.protocol === "http:") url.protocol = "https:";
    return allowed(url.href);
  } catch { return null; }
}
export const normalizeEvidenceText = (text: string) => text.replace(/\s+/gu, " ").trim();
function feedLinks(xml: string): string[] {
  const links: string[] = [];
  let item = false, capture = false, value = "";
  const parser = new Parser({
    onopentag(name, attributes) {
      if (name === "item" || name === "entry") item = true;
      if (item && name === "link") {
        if (attributes.href && (!attributes.rel || attributes.rel === "alternate")) links.push(attributes.href);
        capture = true; value = "";
      }
    },
    ontext(text) { if (capture) value += text; },
    onclosetag(name) {
      if (name === "link") { if (capture && value.trim()) links.push(value.trim()); capture = false; }
      if (name === "item" || name === "entry") { item = false; capture = false; }
    }
  }, { xmlMode: true, decodeEntities: true });
  parser.end(xml);
  return [...new Set(links)].slice(0, 30);
}
const OMIT = new Set(["script", "style", "nav", "header", "footer", "form", "noscript", "svg", "aside"]);
const BLOCK = new Set(["p", "div", "section", "article", "main", "h1", "h2", "h3", "li", "br", "tr"]);
function pageContent(html: string): { text: string; date: string | null; links: string[]; title: string } {
  const stack: { name: string; omit: boolean; main: boolean; article: boolean }[] = [];
  let all = "", main = "", article = "", title = "", date: string | null = null;
  const links: string[] = [];
  function append(text: string) {
    if (stack.some(x => x.omit)) return;
    all += text;
    if (stack.some(x => x.main)) main += text;
    if (stack.some(x => x.article)) article += text;
  }
  const parser = new Parser({
    onopentag(name, attrs) {
      stack.push({ name, omit: OMIT.has(name), main: name === "main", article: name === "article" });
      if (BLOCK.has(name)) append("\n");
      if (name === "a" && attrs.href && !stack.some(x => x.omit)) links.push(attrs.href);
      const key = attrs.property ?? attrs.name;
      const published = name === "meta" && ["article:published_time", "datePublished", "pubdate"].includes(key ?? "")
        ? attrs.content : name === "time" ? attrs.datetime : undefined;
      const day = published?.slice(0, 10);
      if (!date && day && validFactDate(day)) date = day;
    },
    ontext(text) {
      if (stack.some(x => x.name === "title")) title += text;
      append(text);
    },
    onclosetag(name) {
      if (BLOCK.has(name)) append("\n");
      const index = stack.map(x => x.name).lastIndexOf(name);
      if (index >= 0) stack.splice(index);
    }
  }, { decodeEntities: true });
  parser.end(html);
  const core = normalizeEvidenceText(article).length >= 200 ? article :
    normalizeEvidenceText(main).length >= 200 ? main : all;
  return { text: normalizeEvidenceText(core).slice(0, MAX_TEXT), date, links: [...new Set(links)].slice(0, 2000), title };
}
interface Page { url: string; type: string; body: string }
class Retrieval {
  private calls = 0;
  private readonly signal = AbortSignal.timeout(PHASE_TIMEOUT_MS);
  private readonly pages = new Map<string, Promise<Page | null>>();
  constructor(private readonly send: typeof fetch) {}
  read(url: string): Promise<Page | null> {
    if (!this.pages.has(url)) this.pages.set(url, this.fetchPage(url));
    return this.pages.get(url)!;
  }
  private async fetchPage(initial: string): Promise<Page | null> {
    let url = allowed(initial);
    for (let redirects = 0; url && redirects <= 3; redirects++) {
      if (++this.calls > MAX_FETCHES || this.signal.aborted) return null;
      const signal = AbortSignal.any([this.signal, AbortSignal.timeout(10_000)]);
      try {
        const send = this.send;
        const response = await send(url, {
          redirect: "manual", signal, headers: { "User-Agent": USER_AGENT,
            Accept: "text/html, application/xhtml+xml, application/rss+xml, application/atom+xml, application/xml, text/xml, application/json" }
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          url = location ? allowed(location, url) : null;
          continue;
        }
        if (!response.ok) { await response.body?.cancel(); return null; }
        const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
        if (!["text/html", "application/xhtml+xml", "application/rss+xml", "application/atom+xml",
          "application/xml", "text/xml", "application/json"].includes(type) ||
          Number(response.headers.get("content-length") ?? 0) > MAX_BODY_BYTES || !response.body) {
          await response.body?.cancel(); return null;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0, body = "";
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > MAX_BODY_BYTES || signal.aborted) { await reader.cancel(); return null; }
            body += decoder.decode(part.value, { stream: true });
          }
          body += decoder.decode();
        } finally { reader.releaseLock(); }
        if (signal.aborted) return null;
        return { url, type, body };
      } catch { return null; }
    }
    return null;
  }
}
const randomValue = () => { const value = new Uint32Array(1); crypto.getRandomValues(value); return value[0] / 0x100000000; };
export class FreeEvidence implements EvidenceProvider {
  constructor(private readonly send: typeof fetch = fetch, private readonly random: () => number = randomValue,
    private readonly log: (event: string, data: Record<string, unknown>) => void = () => {}) {}
  private shuffled<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.max(0, Math.floor(this.random() * (i + 1))));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  private async collect(category: Category, day: string, candidate?: Candidate): Promise<SourceDocument[]> {
    const session = new Retrieval(this.send);
    const documents = new Map<string, SourceDocument>();
    const visited = new Set<string>();
    const related = new Set<string>();
    const add = async (value: string, base = value) => {
      const url = discovered(value, base);
      if (!url || !publisher(url) || visited.has(url) || documents.size >= MAX_DOCUMENTS) return;
      visited.add(url);
      const page = await session.read(url);
      if (!page || !["text/html", "application/xhtml+xml"].includes(page.type)) return;
      const content = pageContent(page.body);
      if (content.text.length < 200 || /access denied|request rejected|just a moment|service unavailable/i.test(content.title) ||
          (content.date && content.date > day)) return;
      const owner = publisher(page.url);
      if (!owner) return;
      documents.set(page.url, { url: page.url, publisher: owner.name, primary: owner.primary,
        organization: owner.organization, published_at: content.date, text: content.text });
      for (const link of content.links) { const resolved = discovered(link, page.url); if (resolved && publisher(resolved)) related.add(resolved); }
    };
    if (!candidate && category === "sport") {
      // Olympedia publishes the historians' own results/biographical database.
      // Its current random entries provide discovery without a paid search or
      // a fixed athlete shortlist. Only the fetched entry is supplied as evidence.
      const roster = await session.read("https://www.olympedia.org/");
      if (roster && ["text/html", "application/xhtml+xml"].includes(roster.type)) {
        const athletes = pageContent(roster.body).links
          .map(link => discovered(link, roster.url))
          .filter((url): url is string => !!url && new URL(url).hostname === "www.olympedia.org" &&
            /^\/athletes\/\d+$/.test(new URL(url).pathname)).slice(0, 3);
        for (const url of this.shuffled(athletes).slice(0, 2)) await add(url);
      }
    }
    if (candidate) {
      // Fresh HTTP retrieval: the author's quotes, dates and authority flags are not evidence.
      for (const source of candidate.sources) await add(source.url);
    } else {
      for (const feed of this.shuffled(FEEDS[category])) {
        const page = await session.read(feed);
        if (!page || !["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"].includes(page.type)) continue;
        for (const link of this.shuffled(feedLinks(page.body)).slice(0, 2)) await add(link, page.url);
      }
    }
    const query = candidate?.title ?? this.shuffled(QUERIES[category])[0];
    const search = await session.read("https://en.wikipedia.org/w/rest.php/v1/search/page?q=" + encodeURIComponent(query) + "&limit=2");
    if (search?.type === "application/json") {
      try {
        const result = JSON.parse(search.body) as { pages?: { key?: string }[] };
        for (const page of Array.isArray(result.pages) ? result.pages.slice(0, 2) : []) {
          if (typeof page.key !== "string" || page.key.length > 200) continue;
          // Reference URLs come from the small public API response, not a large
          // Wikipedia HTML page. Only the referenced publisher's own text is evidence.
          const references = await session.read("https://en.wikipedia.org/w/api.php?action=query&prop=extlinks&ellimit=500&format=json&formatversion=2&titles=" + encodeURIComponent(page.key));
          if (references?.type !== "application/json") continue;
          const data = JSON.parse(references.body) as {
            query?: { pages?: { extlinks?: { url?: string; "*"?: string }[] }[] };
          };
          const links: string[] = [];
          for (const referencePage of Array.isArray(data.query?.pages) ? data.query.pages : []) {
            for (const link of Array.isArray(referencePage.extlinks) ? referencePage.extlinks : []) {
              const value = link.url ?? link["*"];
              const url = typeof value === "string" ? discovered(value, references.url) : null;
              if (url && publisher(url)) links.push(url);
            }
          }
          const ordered = this.shuffled([...new Set(links)]).sort((a, b) =>
            Number(publisher(b)!.primary) - Number(publisher(a)!.primary));
          for (const link of ordered.slice(0, 3)) await add(link);
        }
      } catch { /* A discovery API failure cannot become evidence. */ }
    }
    if (documents.size < MAX_DOCUMENTS) {
      const ordered = this.shuffled([...related]).sort((a, b) =>
        Number(publisher(b)!.primary) - Number(publisher(a)!.primary));
      for (const url of ordered.slice(0, 2)) await add(url);
    }
    const sources = [...documents.values()];
    if (!sources.length) throw new FactError("evidence_unavailable");
    this.log("evidence_retrieved", { day, phase: candidate ? "review" : "generation",
      sources: sources.map(({ url, publisher, organization, primary, published_at, text }) =>
        ({ url, publisher, organization, primary, published_at, characters: text.length })) });
    return sources;
  }
  generate(category: Category, day: string) { return this.collect(category, day); }
  review(candidate: Candidate, day: string) { return this.collect(candidate.category, day, candidate); }
}
