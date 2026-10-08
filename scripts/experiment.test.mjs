import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const core = createRequire(import.meta.url)("../assets/js/experiment-core.js");

const today = "2026-10-08";
const agreed = {
  context: "Changes wait for review until sprint end.",
  change: "A volunteer checks the ready queue after the daily scrum.",
  owner: "Review volunteer",
  signal: "Less time waiting for review; ask whether people feel less rushed.",
  reviewDate: "2026-10-22"
};
const empty = () => core.normalizeState(null, today);
const active = () => core.savePlan(empty(), agreed, today, "review-queue").state;

test("a plan requires all five fields and a valid present or future review", () => {
  const missing = core.savePlan(empty(), {}, today, "first");
  assert.deepEqual(Object.keys(missing.errors).sort(), ["change", "context", "owner", "reviewDate", "signal"]);
  assert.equal(missing.state.active, null);
  for (const reviewDate of ["2026-02-30", "2026-10-07", "2026-10-22trailing", "2026-10-22 ", "10000-01-01"]) {
    assert.ok(core.savePlan(empty(), { ...agreed, reviewDate }, today, "first").errors.reviewDate);
  }
  assert.deepEqual(core.savePlan(empty(), { ...agreed, reviewDate: today }, today, "first").errors, {});
  assert.ok(core.savePlan(empty(), { ...agreed, owner: "a".repeat(201) }, today, "first").errors.owner);
});

test("saving makes one active plan without mutating its draft or accepting a second", () => {
  const original = empty();
  original.draft = { ...agreed };
  const before = structuredClone(original);
  const saved = core.savePlan(original, agreed, today, "first");
  assert.deepEqual(original, before);
  assert.deepEqual(saved.state.active.originalPlan, agreed);
  assert.deepEqual(saved.state.active.plan, agreed);
  assert.equal(saved.state.active.cycle, 1);
  assert.equal(core.hasDraftWork(saved.state.draft), false);
  assert.ok(core.savePlan(saved.state, agreed, today, "second").errors.form);
  assert.equal(saved.state.active.id, "first");
});

test("Keep requires observed learning and a future review date", () => {
  const state = active();
  assert.ok(core.reviewExperiment(state, { decision: "keep", nextDate: "2026-11-05" }, "2026-10-22").errors.happened);
  for (const nextDate of ["2026-10-21", "2026-10-22", "2026-11-05junk", ""]) {
    assert.ok(core.reviewExperiment(state, { happened: "Less waiting.", decision: "keep", nextDate }, "2026-10-22").errors.nextDate);
  }
  assert.ok(core.reviewExperiment(state, { happened: "Less waiting.", decision: "other" }, "2026-10-22").errors.decision);
  const result = core.reviewExperiment(state, { happened: "Less waiting.", decision: "keep", nextDate: "2026-11-05" }, "2026-10-22");
  assert.deepEqual(result.errors, {});
  assert.equal(result.state.active.cycle, 2);
  assert.equal(result.state.active.plan.reviewDate, "2026-11-05");
  assert.deepEqual(result.state.active.originalPlan, agreed);
  assert.deepEqual(result.state.archive[0].plan, agreed);
  assert.equal(result.state.archive[0].happened, "Less waiting.");
  assert.equal(state.archive.length, 0);
});

test("Change preserves the reviewed plan and original while requiring a revised plan", () => {
  const state = active();
  const input = { happened: "Waiting improved, reminders disrupted focus.", decision: "change", nextDate: "2026-11-05", plan: { ...agreed } };
  assert.ok(core.reviewExperiment(state, input, "2026-10-22").errors.change);
  assert.ok(core.reviewExperiment(state, { ...input, plan: { ...agreed, change: "" } }, "2026-10-22").errors.change);
  const revised = { ...agreed, change: "Use an asynchronous reminder for ready reviews.", reviewDate: "2026-11-05" };
  const result = core.reviewExperiment(state, { ...input, plan: revised }, "2026-10-22");
  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.state.active.plan, revised);
  assert.deepEqual(result.state.active.originalPlan, agreed);
  assert.deepEqual(result.state.archive[0].plan, agreed);
  assert.deepEqual(result.state.archive[0].nextPlan, revised);
  assert.equal(result.state.archive[0].happened, input.happened);
});

test("Stop closes a plan, retains learning and exports earlier reviews with the original", () => {
  let state = core.reviewExperiment(active(), { happened: "First-cycle learning.", decision: "keep", nextDate: "2026-11-05" }, "2026-10-22").state;
  state = core.reviewExperiment(state, { happened: "Second-cycle learning; make the habit routine.", decision: "stop" }, "2026-11-05").state;
  assert.equal(state.active, null);
  assert.equal(state.archive.length, 2);
  const exported = core.exportState(state);
  for (const text of ["Original plan", "Changes wait for review", "First\\-cycle learning", "Second\\-cycle learning", "Decision:** Stop"]) assert.ok(exported.includes(text), text);
  assert.ok(exported.indexOf("Review 1") < exported.indexOf("Review 2"));
  assert.ok(core.reviewExperiment(state, { happened: "More.", decision: "stop" }, "2026-11-06").errors.form);
});

test("starting another experiment preserves active work and unfinished review notes", () => {
  const state = active();
  state.reviewDraft.happened = "An observation we have not agreed yet.";
  const fresh = core.startNew(state, "2026-10-20");
  assert.equal(fresh.active, null);
  assert.equal(core.hasDraftWork(fresh.draft), false);
  assert.equal(fresh.archive[0].decision, "closed");
  assert.equal(fresh.archive[0].happened, state.reviewDraft.happened);
  assert.deepEqual(fresh.archive[0].originalPlan, agreed);
  assert.ok(state.active);
});

test("recent history is bounded to ten snapshots without losing the original plan", () => {
  let state = active();
  let day = "2026-10-22";
  for (let i = 0; i < 12; i++) {
    const nextDate = core.addDays(day, 14);
    state = core.reviewExperiment(state, { happened: "Learning " + i, decision: "keep", nextDate }, day).state;
    day = nextDate;
  }
  assert.equal(state.archive.length, 10);
  assert.equal(state.archive[0].happened, "Learning 11");
  assert.equal(state.archive[9].happened, "Learning 2");
  assert.deepEqual(state.active.originalPlan, agreed);
  assert.ok(core.exportState(state).includes("Original plan"));
  assert.ok(core.exportState(state).includes("limited to the last 10"));
});

test("corrupt and incompatible data normalize safely, recovering incomplete plans as drafts", () => {
  for (const value of [null, false, [], "broken", { version: 99, active: {} }]) {
    const state = core.normalizeState(value, today);
    assert.equal(state.active, null);
    assert.deepEqual(state.archive, []);
    assert.equal(state.draft.reviewDate, "2026-10-22");
  }
  const saved = active();
  saved.active.plan.reviewDate = "2026-10-22suffix";
  saved.archive = [null, {}, { decision: "stop" }];
  const recovered = core.normalizeState(saved, today);
  assert.equal(recovered.active, null);
  assert.equal(recovered.draft.change, agreed.change);
  assert.equal(recovered.draft.reviewDate, "");
  assert.equal(recovered.archive.length, 0);
  const roundtrip = core.normalizeState(JSON.parse(JSON.stringify(active())), today);
  assert.deepEqual(roundtrip, active());
});

test("date validation rejects rollover and compares local calendar dates without timezone conversion", () => {
  for (const date of ["2026-02-29", "2024-02-30", "1900-02-29", "2026-00-01", "0000-01-01"]) assert.equal(core.validDate(date), false);
  assert.equal(core.validDate("2000-02-29"), true);
  assert.equal(core.validDate("0099-01-01"), true);
  assert.equal(core.addDays("2026-12-28", 14), "2027-01-11");
  assert.equal(core.addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(core.addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(core.addDays("9999-12-31", 1), null);
  assert.equal(core.addDays("0001-01-01", -1), null);
  assert.equal(core.addDays(today, 1e100), null);
  assert.equal(core.reviewStatus("2027-01-01", "2026-12-31"), "upcoming");
  assert.equal(core.reviewStatus("2026-10-08", today), "today");
  assert.equal(core.reviewStatus("2026-10-07", today), "overdue");
  assert.equal(core.reviewStatus("bad", today), "unknown");
});

test("a new entered draft exports its own work rather than a previous experiment", () => {
  const stopped = core.reviewExperiment(active(), { happened: "It helped.", decision: "stop" }, today).state;
  stopped.draft = { ...agreed, context: "A completely new issue." };
  const output = core.exportState(stopped);
  assert.ok(output.includes("Team experiment draft"));
  assert.ok(output.includes("A completely new issue"));
  assert.equal(output.includes("It helped"), false);
  assert.ok(core.exportReview(stopped.archive[0]).includes("It helped"));
});

test("exports keep user content literal and escape HTML and Markdown injection", () => {
  const malicious = { ...agreed, context: "<script>alert(1)</script>\n# heading\n[link](https://example.test)\n* claim" };
  const state = core.savePlan(empty(), malicious, today, "safe").state;
  const output = core.exportState(state);
  assert.equal(output.includes("<script>"), false);
  assert.ok(output.includes("\\<script\\>"));
  assert.ok(output.includes("\n\\# heading"));
  assert.ok(output.includes("\\[link\\]"));
  assert.ok(output.includes("\n\\* claim"));
  assert.equal(state.active.plan.context, malicious.context);
});

test("an unfinished review exports current notes and proposed changes as a draft", () => {
  const state = active();
  state.reviewDraft = {
    happened: "Unsubmitted observation: daily reminders interrupt work.",
    decision: "change", nextDate: "2026-11-05",
    plan: { ...agreed, change: "Try an asynchronous reminder.", reviewDate: "2026-11-05" }
  };
  const output = core.exportState(state);
  for (const text of ["Review draft — not saved as a decision", "Unsubmitted observation", "Pending decision:** Change", "Proposed next review", "2026\\-11\\-05", "Try an asynchronous reminder"]) assert.ok(output.includes(text), text);
  assert.deepEqual(state.active.plan, agreed);
  assert.equal(state.archive.length, 0);
  state.reviewDraft.decision = "";
  assert.ok(core.exportState(state).includes("No decision selected"));
});
