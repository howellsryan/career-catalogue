import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const core = createRequire(import.meta.url)("../assets/js/practice-core.js");

test("history accepts whole item counts, zeros and common pasted separators", () => {
  assert.deepEqual(core.parseHistory("6, 0;\n9 7").values, [6, 0, 9, 7]);
  assert.equal(core.parseHistory("6, 0;\n9 7").error, null);
});
for (const text of ["6,-9,7", "6,2.5,7", "6,invalid,7", "6,1001,7", "6,1e2,7", "6,+9,7"]) {
  test("history rejects malformed input without silently changing it: " + text, () => {
    assert.ok(core.parseHistory(text).error);
    assert.deepEqual(core.parseHistory(text).values, []);
  });
}
test("empty, all-zero and oversized history have actionable errors", () => {
  for (const text of ["", "0,0,0", Array(61).fill("1").join(",")]) assert.ok(core.parseHistory(text).error);
  assert.equal(core.parseHistory(Array(60).fill("1").join(",")).error, null);
});
test("number validation distinguishes blank from a real zero and enforces bounds", () => {
  for (const input of ["", " ", null, true, "Infinity", "-1", "5001", "2.5"]) assert.equal(core.numberInRange(input, 1, 5000, true), null);
  assert.equal(core.numberInRange("0", 0, 1000, false), 0);
  assert.equal(core.numberInRange("70.25", 0, 1000, false), 70.25);
  assert.equal(core.numberInRange("5000", 1, 5000, true), 5000);
});
test("a constant throughput yields exact inclusive period-end dates", () => {
  const forecast = core.simulate([6], 24, 1);
  assert.deepEqual(forecast.results.map(row => row.periods), [4, 4, 4, 4]);
  assert.equal(forecast.unfinished, 0);
  const date = core.doneDate("2026-10-07", 4, 14);
  assert.equal(date.getFullYear(), 2026); assert.equal(date.getMonth(), 11); assert.equal(date.getDate(), 1);
});
test("unfinished runs cannot become completion dates at the computational horizon", () => {
  const forecast = core.simulate([1], 5000, 1);
  assert.equal(forecast.unfinished, 10000);
  assert.deepEqual(forecast.results.map(row => row.periods), [null, null, null, null]);
  assert.deepEqual(forecast.durations, []);
});
test("partial censoring keeps unfinished runs in percentile denominators", () => {
  const forecast = core.simulate([0,1], 200, 123456789);
  assert.ok(forecast.unfinished > 0 && forecast.unfinished < forecast.trials);
  assert.equal(forecast.durations.length + forecast.unfinished, forecast.trials);
  assert.equal(forecast.results[2].periods, null);
  assert.ok(forecast.results[0].periods === null || forecast.results[0].periods <= 400);
});
test("simulation is reproducible for a seed and rejects invalid histories and backlogs", () => {
  assert.deepEqual(core.simulate([0,4,8], 24, 42), core.simulate([0,4,8], 24, 42));
  for (const history of [[],[0],[-1,2],[1.5]]) assert.throws(() => core.simulate(history, 24, 1), RangeError);
  for (const backlog of [0,5001,2.5,Infinity]) assert.throws(() => core.simulate([6], backlog, 1), RangeError);
});
test("dates reject rollover, retain leap days and handle years below 100", () => {
  for (const iso of ["2026-02-30","2026-13-01","2026-00-07","0000-01-01","no date"]) assert.equal(core.localDate(iso), null);
  assert.equal(core.localDate("2024-02-29").getDate(), 29);
  assert.equal(core.localDate("0099-01-01").getFullYear(), 99);
  assert.equal(core.doneDate("2026-10-07", null, 14), null);
  assert.equal(core.doneDate("2026-10-07", 4, 0), null);
});
test("health persistence retains 500 and bounded totals while rejecting corrupt values", () => {
  const dims = [{id:"clarity"},{id:"flow"}], levels = [{id:"low"},{id:"mid"},{id:"high"}];
  const votes = core.normalizeVotes({clarity:{low:500,mid:9999,high:"5"},flow:{low:-1,mid:2.5,high:10000}},dims,levels);
  assert.deepEqual(votes,{clarity:{low:500,mid:9999,high:0},flow:{low:0,mid:0,high:0}});
  for (const raw of [null, false, "broken", []]) assert.deepEqual(core.normalizeVotes(raw,dims,levels),{clarity:{low:0,mid:0,high:0},flow:{low:0,mid:0,high:0}});
});
