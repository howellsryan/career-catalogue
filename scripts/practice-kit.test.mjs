import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../assets/js/practice-kit.js", import.meta.url), "utf8");
function setup(overrides = {}) {
  const values = new Map();
  const context = {
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key)
    },
    navigator: {}, ...overrides
  };
  vm.runInNewContext(source, context);
  return { kit: context.PracticeKit, values };
}

test("private drafts round-trip independently and clear only the selected tool", () => {
  const { kit } = setup();
  assert.equal(kit.write("brief", { problem: "Reconcile payments" }), true);
  kit.write("demo", { title: "CSV export" });
  assert.equal(kit.read("brief", {}).problem, "Reconcile payments");
  assert.equal(kit.remove("brief"), true);
  assert.equal(kit.read("brief", "empty"), "empty");
  assert.equal(kit.read("demo", {}).title, "CSV export");
});

test("unavailable storage and malformed JSON preserve a usable in-memory workflow", () => {
  const { kit, values } = setup();
  values.set("bad", "{unfinished");
  assert.equal(kit.read("bad", "fallback"), "fallback");
  const { kit: blocked } = setup({ localStorage: {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("quota"); },
    removeItem() { throw new Error("blocked"); }
  } });
  assert.equal(blocked.read("brief", "fallback"), "fallback");
  assert.equal(blocked.write("brief", {}), false);
  assert.equal(blocked.remove("brief"), false);
});

test("clipboard rejection falls back, restores focus, and restores button state", async () => {
  let removed = false, focused = false, selected = false;
  const button = { disabled: false };
  const status = { textContent: "" };
  const { kit } = setup({
    isSecureContext: true,
    navigator: { clipboard: { writeText: async () => { throw new Error("denied"); } } },
    document: {
      activeElement: { focus() { focused = true; } },
      body: { appendChild() {} },
      createElement() { return { style: {}, setAttribute() {}, select() { selected = true; }, remove() { removed = true; } }; },
      execCommand: () => true
    }
  });
  assert.equal(await kit.copy("private note", button, status), true);
  assert.equal(button.disabled, false);
  assert.ok(removed && focused && selected);
  assert.equal(status.textContent, "Copied to clipboard.");
});

test("clipboard failure offers manual export and never strands a disabled button", async () => {
  const { kit } = setup();
  const button = { disabled: false };
  const status = { textContent: "" };
  assert.equal(await kit.copy("note", button, status), false);
  assert.equal(button.disabled, false);
  assert.match(status.textContent, /download/);
});

test("review defaults use local calendar dates through month and year boundaries", () => {
  class Clock extends Date { constructor() { super(2026, 11, 25, 23, 30); } }
  const { kit } = setup({ Date: Clock });
  assert.equal(kit.localDate(), "2026-12-25");
  assert.equal(kit.localDate(14), "2027-01-08");
});
