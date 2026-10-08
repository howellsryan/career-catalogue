import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const core = createRequire(import.meta.url)("../assets/js/work-brief-core.js");

test("blank and partial briefs keep unknown information visible without inventing it", () => {
  assert.equal(core.hasContent(null), false);
  assert.equal(core.hasContent({ problem: "  \n " }), false);
  assert.equal(core.hasContent({ problem: "Reconciliation is slow." }), true);
  const markdown = core.markdown({ problem: "Reconciliation is slow." });
  assert.ok(markdown.includes("Reconciliation is slow."));
  assert.ok(markdown.includes("## Evidence and assumptions\n\nTo discuss"));
  assert.ok(markdown.includes("## How we will know it helped\n\nTo discuss"));
  assert.equal((core.markdown(null).match(/To discuss/g) || []).length, 12);
  assert.ok(!markdown.includes("25 minutes"));
});

test("saved draft normalization rejects corrupt types and unrelated or inherited data", () => {
  for (const saved of [null, false, 14, "bad JSON shape", []]) {
    assert.equal(core.hasContent(core.normalize(saved)), false);
  }
  const inherited = Object.create({ problem: "inherited content" });
  inherited.title = "A real draft";
  inherited.evidence = { untrusted: "object" };
  inherited.unknowns = ["not a string"];
  inherited.unrelated = "ignored";
  const normalized = core.normalize(inherited);
  assert.equal(normalized.title, "A real draft");
  assert.equal(normalized.problem, "");
  assert.equal(normalized.evidence, "");
  assert.equal(normalized.unknowns, "");
  assert.equal(Object.hasOwn(normalized, "unrelated"), false);
});

test("bounded persistence keeps multiline content and removes invalid control characters", () => {
  const normalized = core.normalize({ title: "x".repeat(1000), problem: "First\r\nSecond\rThird\u0000\trow", acceptance: "a".repeat(5000) });
  assert.equal(normalized.title.length, 180);
  assert.equal(normalized.acceptance.length, 4000);
  assert.equal(normalized.problem, "First\nSecond\nThird\trow");
  assert.deepEqual(core.normalize(normalized), normalized);
  assert.ok(core.validate({ title: "x".repeat(181) }).title);
  assert.deepEqual(core.validate({ title: "x".repeat(180), problem: "" }), {});
});

test("discussion surfaces the user's questions and identifies missing information without a readiness score", () => {
  const draft = core.example();
  draft.evidence = "";
  draft.unknowns = "Who can validate this?\n\nWhat is the row limit?";
  const questions = core.discussionQuestions(draft);
  assert.deepEqual(questions, ["Who can validate this?", "What is the row limit?", "What have we observed, and what are we still assuming?"]);
  assert.ok(!questions.some(question => /score|ready|approved/i.test(question)));
  const complete = core.example();
  complete.unknowns = "";
  assert.deepEqual(core.discussionQuestions(complete), ["Are there any remaining assumptions or questions to test?"]);
});

test("example is clearly illustrative and independent of the user's work", () => {
  const first = core.example();
  assert.equal(Object.keys(core.validate(first)).length, 0);
  assert.match(first.evidence, /Illustrative example/);
  assert.match(first.unknowns, /formulas/);
  first.title = "Changed title";
  assert.notEqual(core.example().title, first.title);
});

test("export filenames cannot introduce paths and preserve useful Latin titles", () => {
  assert.equal(core.filename({ title: "../Invoice / Report\\October" }), "invoice-report-october.md");
  assert.equal(core.filename({ title: "Café invoices" }), "cafe-invoices.md");
  assert.equal(core.filename({ title: "你好" }), "work-brief.md");
  assert.equal(core.filename(null), "work-brief.md");
  assert.ok(core.filename({ title: "long ".repeat(50) }).length <= 63);
});

test("brief export retains literal user input and never fabricates acceptance cases", () => {
  const text = '<img src=x onerror="alert(1)">\n[Request](https://example.com)';
  const markdown = core.markdown({ problem: text });
  assert.ok(markdown.includes(text));
  assert.ok(markdown.includes("## Acceptance examples\n\nTo discuss"));
});

function browser(saved = null, canSave = true) {
  const html = readFileSync(new URL("../work-brief.html", import.meta.url), "utf8");
  const nodes = new Map();
  function element() {
    return {
      value: "", textContent: "", hidden: false, disabled: false, children: [], listeners: {},
      addEventListener(event, listener) { this.listeners[event] = listener; },
      setAttribute() {}, removeAttribute() {}, focus() {},
      appendChild(child) { this.children.push(child); },
      replaceChildren() { this.children = []; },
      set innerHTML(value) { throw new Error("User content must not be rendered as HTML: " + value); }
    };
  }
  for (const match of html.matchAll(/id="([^"]+)"/g)) nodes.set(match[1], element());
  let stored = saved, confirmed = false, copied = "", downloaded = "";
  const kit = {
    read() { return stored; },
    write(key, value) { if (canSave) stored = structuredClone(value); return canSave; },
    remove() { if (canSave) stored = null; return canSave; },
    async copy(text) { copied = text; return true; },
    download(text) { downloaded = text; return true; }
  };
  const document = { getElementById(id) { return nodes.get(id); }, createElement: element };
  runInNewContext(readFileSync(new URL("../assets/js/work-brief.js", import.meta.url), "utf8"), {
    window: { WorkBriefCore: core, PracticeKit: kit, confirm() { return confirmed; } }, document
  });
  return {
    node(id) { return nodes.get(id); },
    async click(id) { await nodes.get(id).listeners.click(); },
    type(key, value) { nodes.get("brief-" + key).value = value; nodes.get("work-brief-form").listeners.input(); },
    confirm(value) { confirmed = value; },
    stored() { return stored; }, copied() { return copied; }, downloaded() { return downloaded; }
  };
}

test("client keeps content literal, blocks empty exports and requires confirmation before replacing work", async () => {
  const page = browser();
  assert.equal(page.node("brief-copy").disabled, true);
  assert.equal(page.node("brief-download").disabled, true);
  const text = '<img src=x onerror="alert(1)">';
  page.type("problem", text);
  assert.ok(page.node("brief-preview").textContent.includes(text));
  assert.equal(page.stored().problem, text);
  await page.click("brief-example");
  assert.equal(page.node("brief-problem").value, text);
  await page.click("brief-clear");
  assert.equal(page.stored().problem, text);
  await page.click("brief-copy");
  await page.click("brief-download");
  assert.ok(page.copied().includes(text));
  assert.equal(page.downloaded(), page.copied());
  page.confirm(true);
  await page.click("brief-example");
  assert.match(page.node("brief-evidence").value, /Illustrative example/);
  await page.click("brief-clear");
  assert.equal(page.stored(), null);
  assert.equal(page.node("brief-copy").disabled, true);
  assert.equal(page.node("brief-problem").value, "");
});

test("restored drafts are normalized and unavailable storage gives an honest backup warning", async () => {
  const page = browser({ title: "Kept title", problem: { corrupt: true }, unknowns: "x".repeat(5000) }, false);
  assert.equal(page.node("brief-title").value, "Kept title");
  assert.equal(page.node("brief-problem").value, "");
  assert.equal(page.node("brief-unknowns").value.length, 4000);
  page.type("problem", "User research needed.");
  assert.match(page.node("brief-save-status").textContent, /could not save/);
  assert.equal(page.node("brief-copy").disabled, false);
  page.confirm(true);
  await page.click("brief-clear");
  assert.match(page.node("brief-save-status").textContent, /may return on reload/);
});
