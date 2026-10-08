import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const core = createRequire(import.meta.url)("../assets/js/fuzzy-search-core.js");

test("Levenshtein counts insertions, deletions and substitutions with empty boundaries", () => {
  for (const [left, right, expected] of [["", "", 0], ["", "cat", 3], ["cat", "", 3], ["cat", "cat", 0], ["cat", "cut", 1], ["kitten", "sitting", 3], ["plumbr", "plumber", 1], ["plumbr", "plumper", 2]]) {
    assert.equal(core.distance(left, right), expected);
    assert.equal(core.distance(right, left), expected);
  }
});

test("letter swaps cost two and Unicode code points are not split into UTF-16 units", () => {
  assert.equal(core.distance("ab", "ba"), 2);
  assert.equal(core.distance("😀", ""), 1);
  assert.equal(core.distance("😀", "😃"), 1);
  assert.equal(core.distance("😀a", "😀"), 1);
  assert.throws(() => core.distance("a".repeat(65), "a"), RangeError);
  assert.throws(() => core.distance(null, "a"), TypeError);
});

test("comparison normalizes case, surrounding whitespace and canonical accents without removing accents", () => {
  const result = core.compare(" CAFÉ ", "cafe\nCafe\u0301\n CAFÉ ", 0);
  assert.deepEqual(result.errors, {});
  assert.equal(result.rows[0].value, "Cafe\u0301");
  assert.equal(result.rows[0].exact, true);
  assert.equal(result.rows[1].value, "cafe");
  assert.equal(result.rows[1].distance, 1);
  assert.equal(result.duplicates, 1);
});

test("threshold recovers the intended typo while a larger threshold introduces a false positive", () => {
  const accepts = threshold => core.compare("plumbr", "plumber\nplumper", threshold).rows.filter(row => row.accepted).map(row => row.value);
  assert.deepEqual(accepts(0), []);
  assert.deepEqual(accepts(1), ["plumber"]);
  assert.deepEqual(accepts(2), ["plumber", "plumper"]);
  assert.equal(core.checkExercise(1).passed, true);
  for (const threshold of [0, 2, 3, "", null, 1.5]) assert.equal(core.checkExercise(threshold).passed, false);
});

test("ranking is deterministic and preserves input order for equal distances", () => {
  const result = core.compare("cat", "cut\ncat\nbat\ncatch", "1");
  assert.deepEqual(result.rows.map(row => [row.value, row.distance, row.accepted]), [["cat", 0, true], ["cut", 1, true], ["bat", 1, true], ["catch", 2, false]]);
  assert.deepEqual(core.compare("cat", "cut\ncat\nbat\ncatch", "1"), result);
});

test("candidate parsing handles pasted line endings and suppresses normalized duplicates", () => {
  assert.deepEqual(core.parseCandidates("\r\n PLUMBER \rplumber\nplumper\r\n\r\n"), { values: ["PLUMBER", "plumper"], duplicates: 1, error: null });
  assert.equal(core.parseCandidates(Array(50).fill("a").join("\n")).error, null);
  assert.ok(core.parseCandidates(Array(51).fill("a").join("\n")).error);
});

test("invalid input clears comparisons and returns actionable field errors", () => {
  for (const query of ["", "  ", null, "x".repeat(65)]) {
    const result = core.compare(query, "candidate", 1);
    assert.ok(result.errors.query);
    assert.deepEqual(result.rows, []);
  }
  for (const text of ["", " \n ", null, "a".repeat(65), Array(51).fill("word").join("\n"), " ".repeat(6501) + "a"]) {
    const result = core.compare("word", text, 1);
    assert.ok(result.errors.candidates);
    assert.deepEqual(result.rows, []);
  }
  for (const threshold of ["", "01", " 1 ", -1, 4, 1.5, Infinity, true, null]) {
    const result = core.compare("word", "word", threshold);
    assert.ok(result.errors.threshold);
    assert.deepEqual(result.rows, []);
  }
});

test("maximum supported Unicode inputs stay valid and matching compares complete strings", () => {
  const long = "😀".repeat(64);
  const result = core.compare(long, long, 0);
  assert.deepEqual(result.errors, {});
  assert.equal(result.rows[0].distance, 0);
  assert.ok(core.compare("İ".repeat(64), "word", 1).errors.query, "lowercasing can expand the normalized code-point length");
  assert.equal(core.compare("cat", "a cat", 1).rows[0].accepted, false);
});

test("comparison export includes the actual normalized query, threshold, ranked outcomes and intent caveat", () => {
  const result = core.compare(" PLUMBR ", "plumper\nplumber\nPLUMBER", 1);
  const text = core.formatComparison(result);
  assert.match(text, /Query \(normalized\): "plumbr"/);
  assert.match(text, /Maximum edit distance: 1/);
  assert.match(text, /Exact matches: 0 of 2/);
  assert.match(text, /Fuzzy accepts: 1 of 2/);
  assert.match(text, /"plumber" — distance 1; accepted; not an exact match/);
  assert.match(text, /"plumper" — distance 2; excluded; not an exact match/);
  assert.ok(text.indexOf('"plumber" —') < text.indexOf('"plumper" —'));
  assert.match(text, /Repeated normalized candidate lines ignored: 1/);
  assert.match(text, /Spelling similarity is not intent/);
  assert.match(text, /one real typo and one confusing near-match/);
});

test("invalid comparisons cannot be exported but a valid comparison with no accepted candidates can", () => {
  for (const result of [null, {}, core.compare("", "plumber", 1), core.compare("plumbr", "", 1), core.compare("plumbr", "plumber", 4)]) assert.equal(core.formatComparison(result), "");
  const text = core.formatComparison(core.compare("plumbr", "plumber", 0));
  assert.match(text, /Fuzzy accepts: 0 of 1/);
  assert.match(text, /"plumber" — distance 1; excluded/);
});

test("comparison export treats entered markup and quotes as literal candidate text", () => {
  const text = core.formatComparison(core.compare('<em>"hi"</em>', '<em>"hi"</em>\nother', 0));
  assert.ok(text.includes(JSON.stringify('<em>"hi"</em>') + ' — distance 0; accepted; exact match'));
  assert.match(text, /Fuzzy accepts: 1 of 2/);
});
