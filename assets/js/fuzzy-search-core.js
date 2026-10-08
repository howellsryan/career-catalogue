(function (root, factory) {
  "use strict";
  var core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.FuzzySearchCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var limits = { characters: 64, candidates: 50, text: 6500 };
  var example = { query: "plumbr", candidates: "plumber\nplumper\ncarpenter\nelectrician\nplumbing", threshold: 1 };

  function normalize(value) {
    return value.trim().toLowerCase().normalize("NFC");
  }

  // Uses Unicode code points, not UTF-16 code units. Callers normalize first.
  function distance(left, right) {
    if (typeof left !== "string" || typeof right !== "string") throw new TypeError("Compare two strings.");
    if (left.length > limits.characters * 2 || right.length > limits.characters * 2) throw new RangeError("Use strings of up to 64 characters.");
    var a = Array.from(left), b = Array.from(right);
    if (a.length > limits.characters || b.length > limits.characters) throw new RangeError("Use strings of up to 64 characters.");
    var previous = b.map(function (_, i) { return i + 1; });
    previous.unshift(0);
    for (var i = 1; i <= a.length; i++) {
      var current = [i];
      for (var j = 1; j <= b.length; j++) {
        current[j] = Math.min(
          current[j - 1] + 1,
          previous[j] + 1,
          previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
      }
      previous = current;
    }
    return previous[b.length];
  }

  function parseCandidates(text) {
    if (typeof text !== "string") return { values: [], duplicates: 0, error: "Add at least one candidate, one per line." };
    if (text.length > limits.text) return { values: [], duplicates: 0, error: "Keep the candidate list below 6,500 characters." };
    if (!text.trim()) return { values: [], duplicates: 0, error: "Add at least one candidate, one per line." };
    var lines = text.split(/\r\n|\n|\r/).map(function (line) { return line.trim(); }).filter(Boolean);
    if (lines.length > limits.candidates) return { values: [], duplicates: 0, error: "Use up to 50 non-empty candidate lines." };
    for (var i = 0; i < lines.length; i++) {
      if (Array.from(lines[i]).length > limits.characters || Array.from(normalize(lines[i])).length > limits.characters) {
        return { values: [], duplicates: 0, error: "Candidate " + (i + 1) + " is too long. Use up to 64 characters per candidate." };
      }
    }
    var seen = new Set(), values = [];
    lines.forEach(function (line) {
      var key = normalize(line);
      if (!seen.has(key)) { seen.add(key); values.push(line); }
    });
    return { values: values, duplicates: lines.length - values.length, error: null };
  }

  function thresholdValue(value) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    return /^[0-3]$/.test(String(value)) ? Number(value) : null;
  }

  function compare(query, text, threshold) {
    var errors = {}, normalized = "";
    if (typeof query !== "string" || !query.trim()) errors.query = "Add a query so there is something to compare.";
    else if (query.length > limits.characters * 2 || Array.from(query.trim()).length > limits.characters || Array.from(normalize(query)).length > limits.characters) errors.query = "Use a query of up to 64 characters.";
    else normalized = normalize(query);
    var parsed = parseCandidates(text), maximum = thresholdValue(threshold);
    if (parsed.error) errors.candidates = parsed.error;
    if (maximum === null) errors.threshold = "Choose a whole edit-distance threshold from 0 to 3.";
    if (Object.keys(errors).length) return { errors: errors, rows: [], duplicates: 0, query: normalized, threshold: maximum };
    var rows = parsed.values.map(function (value, index) {
      var edits = distance(normalized, normalize(value));
      return { value: value, normalized: normalize(value), distance: edits, exact: edits === 0, accepted: edits <= maximum, index: index };
    });
    rows.sort(function (a, b) { return a.distance - b.distance || a.index - b.index; });
    return { errors: {}, rows: rows, duplicates: parsed.duplicates, query: normalized, threshold: maximum };
  }

  function checkExercise(threshold) {
    var maximum = thresholdValue(threshold);
    if (maximum === null) return { passed: false, message: "Choose a threshold before checking your answer." };
    if (maximum === 0) return { passed: false, message: "Threshold 0 accepts exact matches only. ‘plumbr’ is missing the ‘e’ in ‘plumber’, so the intended occupation is still excluded. Try allowing one edit." };
    if (maximum === 1) return { passed: true, message: "Yes: one insertion turns ‘plumbr’ into ‘plumber’. ‘plumper’ needs two edits, so threshold 1 recovers the occupation and excludes the unrelated word. This works for this example; real search needs relevance checks too." };
    return { passed: false, message: "This recovers ‘plumber’, but also accepts ‘plumper’ at distance 2. A larger threshold adds matches without understanding meaning. Try the smallest threshold that fixes the one missing letter." };
  }

  function formatComparison(result) {
    if (!result || !result.errors || Object.keys(result.errors).length || !Array.isArray(result.rows) || !result.rows.length) return "";
    var exact = result.rows.filter(function (row) { return row.exact; }).length;
    var accepted = result.rows.filter(function (row) { return row.accepted; }).length;
    var lines = [
      "Fuzzy-search comparison",
      "",
      "Query (normalized): " + JSON.stringify(result.query),
      "Maximum edit distance: " + result.threshold,
      "Exact matches: " + exact + " of " + result.rows.length,
      "Fuzzy accepts: " + accepted + " of " + result.rows.length,
      "",
      "Candidates, ranked by fewest edits (ties keep input order):"
    ];
    result.rows.forEach(function (row) {
      lines.push(JSON.stringify(row.value) + " — distance " + row.distance + "; " + (row.accepted ? "accepted" : "excluded") + "; " + (row.exact ? "exact match" : "not an exact match"));
    });
    if (result.duplicates) lines.push("", "Repeated normalized candidate lines ignored: " + result.duplicates);
    lines.push("", "Normalization: surrounding whitespace ignored; lowercase Unicode NFC; accents remain significant.");
    lines.push("Spelling similarity is not intent: an accepted candidate may still be irrelevant. Larger thresholds can recover typos and introduce false positives. Check relevance in your own domain.");
    lines.push("Next check: try one real typo and one confusing near-match before choosing a production threshold.");
    return lines.join("\n");
  }

  return { limits: limits, example: example, normalize: normalize, distance: distance, parseCandidates: parseCandidates, compare: compare, checkExercise: checkExercise, formatComparison: formatComparison };
});
