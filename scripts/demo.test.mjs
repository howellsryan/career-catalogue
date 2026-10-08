import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const core = createRequire(import.meta.url)("../assets/js/demo-core.js");

test("a new cycle has no example data, inferred evidence or completed feedback", () => {
  const state = core.empty();
  assert.equal(core.hasContent(state), false);
  assert.deepEqual(state.feedback, []);
  assert.match(core.agenda(state), /Evidence not recorded yet. Treat value as unverified./);
  assert.match(core.followUp(state), /No feedback has been recorded yet./);
});

test("a cycle adds and removes feedback without changing the source draft", () => {
  const original = core.example();
  const added = core.addFeedback(original);
  assert.equal(original.feedback.length, 2);
  assert.equal(added.feedback.length, 3);
  assert.equal(added.feedback[2].decision, "");
  assert.equal(added.feedback[2].responded, false);
  const removed = core.removeFeedback(added, 0);
  assert.equal(removed.feedback[0].request, original.feedback[1].request);
  assert.equal(added.feedback.length, 3);
  assert.throws(() => core.removeFeedback(removed, -1), RangeError);
  assert.throws(() => core.removeFeedback(removed, 0.5), RangeError);
  assert.throws(() => core.removeFeedback(removed, 2), RangeError);
});

test("a single demo cycle is bounded to 20 feedback items", () => {
  let state = core.empty();
  for (let i = 0; i < 20; i++) state = core.addFeedback(state);
  assert.equal(state.feedback.length, 20);
  assert.throws(() => core.addFeedback(state), /20 feedback items/);
  state.feedback.push({ request: "excess" });
  assert.equal(core.normalize(state).feedback.length, 20);
});

test("pending decisions and unsent responses stay visibly unresolved", () => {
  const state = core.addFeedback(core.empty());
  state.feedback[0].request = "Email the CSV weekly";
  const output = core.followUp(state, "2026-10-08");
  assert.match(output, /Decision: Pending — no decision recorded/);
  assert.match(output, /Owner: Not yet assigned/);
  assert.match(output, /Follow-up date: Not scheduled/);
  assert.match(output, /Response status: Response pending/);
});

test("response sharing never implies the action or investigation was completed", () => {
  const state = core.example();
  state.feedback[0].responded = true;
  state.feedback[0].responseDate = "2026-10-07";
  state.feedback[0].dueDate = "2026-10-06";
  const output = core.followUp(state, "2026-10-08");
  assert.match(output, /Decision: Investigate/);
  assert.match(output, /Response status: Response shared on 2026-10-07/);
  assert.match(output, /It does not mean the requested work or investigation is complete/);
  assert.equal(core.status(state.feedback[0], "2026-10-08"), "Response shared");
});

test("unshared response dates are removed instead of suggesting communication happened", () => {
  const state = core.example();
  state.feedback[0].responseDate = "2026-10-07";
  assert.equal(core.normalize(state).feedback[0].responseDate, "");
  assert.doesNotMatch(core.followUp(state, "2026-10-08"), /shared on/);
});

test("response deadlines distinguish overdue, due today and pending using local ISO dates", () => {
  const row = core.addFeedback(core.empty()).feedback[0];
  for (const [dueDate, expected] of [["2026-10-07", "Response overdue"], ["2026-10-08", "Response due today"], ["2026-10-09", "Response pending"], ["", "Response pending"]]) {
    assert.equal(core.status({ ...row, dueDate }, "2026-10-08"), expected);
  }
  assert.equal(core.status({ ...row, dueDate: "broken" }, "2026-10-08"), "Response pending");
});

test("ISO date validation rejects rollover and accepts real leap days and early years", () => {
  for (const date of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-00-01", "2026-10-00", "0000-01-01", "2026-1-01", "2026-10-08extra", null]) assert.equal(core.validDate(date), false, String(date));
  for (const date of ["2024-02-29", "2000-02-29", "0001-01-01", "0099-12-31", "9999-12-31"]) assert.equal(core.validDate(date), true, date);
});

test("invalid dates block export and future communication dates cannot become shared claims", () => {
  const state = core.example();
  state.demoDate = "2026-02-30";
  state.feedback[0].dueDate = "2026-13-01";
  state.feedback[1].responded = true;
  state.feedback[1].responseDate = "2026-10-09";
  assert.deepEqual(Object.keys(core.validate(state, "2026-10-08")), ["demoDate", "feedback.0.dueDate", "feedback.1.responseDate"]);
  assert.throws(() => core.pack(state, "2026-10-08"), /Correct the dates/);
  state.demoDate = "2026-10-08";
  state.feedback[0].dueDate = "";
  state.feedback[1].responseDate = "";
  assert.deepEqual(core.validate(state, "2026-10-08"), {});
  assert.match(core.followUp(state, "2026-10-08"), /Response status: Response shared/);
});

test("corrupt storage is normalized without trusting wrong types, enum values or dates", () => {
  for (const raw of [null, false, "broken", [], { version: 2, title: "unsupported" }]) {
    assert.deepEqual(core.restore(raw).state, core.empty());
    assert.equal(core.restore(raw).recovered, true);
  }
  const raw = { ...core.empty(), title: {}, demoDate: "2026-02-30", feedback: [null, [], { request: "CSV", decision: "Completed", rationale: false, owner: ["Sam"], dueDate: "2026-02-30", responded: "true", responseDate: "2026-10-07" }] };
  const result = core.restore(raw);
  assert.equal(result.recovered, true);
  assert.equal(result.state.title, "");
  assert.equal(result.state.demoDate, "");
  assert.equal(result.state.feedback.length, 1);
  assert.deepEqual(result.state.feedback[0], { request: "CSV", decision: "", rationale: "", owner: "", dueDate: "", responded: false, responseDate: "" });
  assert.equal(core.restore(core.example()).recovered, false);
});

test("oversized saved strings are bounded and recovery is reported", () => {
  const raw = core.example();
  raw.title = "x".repeat(201);
  raw.problem = "x".repeat(3001);
  raw.feedback[0].owner = "x".repeat(201);
  raw.feedback[0].request = "x".repeat(2001);
  const result = core.restore(raw);
  assert.equal(result.recovered, true);
  assert.equal(result.state.title.length, 200);
  assert.equal(result.state.problem.length, 3000);
  assert.equal(result.state.feedback[0].owner.length, 200);
  assert.equal(result.state.feedback[0].request.length, 2000);
});

test("date suffixes in saved data cannot become valid by truncation", () => {
  const raw = core.example();
  raw.demoDate = "2026-10-08extra";
  raw.feedback[0].dueDate = "2026-10-09extra";
  raw.feedback[0].responded = true;
  raw.feedback[0].responseDate = "2026-10-07extra";
  const result = core.restore(raw);
  assert.equal(result.recovered, true);
  assert.equal(result.state.demoDate, "");
  assert.equal(result.state.feedback[0].dueDate, "");
  assert.equal(result.state.feedback[0].responseDate, "");
});

test("exports preserve multiline user entries as text and include the full cycle", () => {
  const state = core.example();
  state.problem = "Finance task\n<script>alert('test')</script>";
  state.feedback[0].rationale = "Check demand first.\nDiscuss payment data.";
  const output = core.pack(state, "2026-10-08");
  assert.ok(output.startsWith("# Demo agenda — Payments reconciliation"));
  assert.match(output, /Finance task\n<script>alert\('test'\)<\/script>/);
  assert.match(output, /# Stakeholder follow-up/);
  assert.match(output, /Check demand first.\nDiscuss payment data./);
  assert.match(output, /Include the settlement reference/);
  assert.match(output, /Decision: Act/);
});
