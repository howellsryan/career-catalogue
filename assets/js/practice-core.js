(function (root, factory) {
  "use strict";
  var core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.PracticeCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function numberInRange(value, min, max, whole) {
    if (typeof value !== "string" && typeof value !== "number") return null;
    if (String(value).trim() === "") return null;
    var n = Number(value);
    return Number.isFinite(n) && n >= min && n <= max && (!whole || Number.isInteger(n)) ? n : null;
  }

  function parseHistory(text) {
    var parts = String(text).trim().split(/[\s,;]+/).filter(Boolean);
    if (!parts.length) return { values: [], error: "Add at least one completed period, including zeros." };
    if (parts.length > 60) return { values: [], error: "Use up to 60 periods; remove the oldest periods first." };
    var values = parts.map(function (part) {
      return /^\d+$/.test(part) ? numberInRange(part, 0, 1000, true) : null;
    });
    if (values.some(function (n) { return n === null; })) {
      return { values: [], error: "Use whole, non-negative item counts from 0 to 1,000, separated by commas, spaces or new lines." };
    }
    if (!values.some(function (n) { return n > 0; })) {
      return { values: values, error: "Every period finished nothing, so no finish can be forecast. Add history with completed items." };
    }
    return { values: values, error: null };
  }

  function localDate(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    var parts = iso.split("-").map(Number);
    if (parts[0] < 1) return null;
    var date = new Date(0);
    date.setHours(12, 0, 0, 0);
    date.setFullYear(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2] ? date : null;
  }

  function doneDate(iso, periods, cadence) {
    var date = localDate(iso);
    if (!date || !Number.isInteger(periods) || periods < 1 || [7, 10, 14, 21].indexOf(cadence) < 0) return null;
    date.setDate(date.getDate() + periods * cadence - 1);
    return date.getFullYear() <= 9999 ? date : null;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function simulate(history, remaining, seed) {
    if (!Array.isArray(history) || !history.length || history.length > 60 ||
        history.some(function (n) { return numberInRange(n, 0, 1000, true) === null; }) ||
        !history.some(function (n) { return n > 0; }) || numberInRange(remaining, 1, 5000, true) === null) {
      throw new RangeError("A forecast needs valid throughput history and a whole backlog from 1 to 5,000.");
    }
    var trials = 10000;
    var maxPeriods = 400;
    var rand = mulberry32(seed);
    var durations = new Array(trials);
    var unfinished = 0;
    for (var t = 0; t < trials; t++) {
      var left = remaining;
      var periods = 0;
      while (left > 0 && periods < maxPeriods) {
        left -= history[(rand() * history.length) | 0];
        periods++;
      }
      if (left > 0) unfinished++;
      // A stopped simulation has no completion date. Keep it in the denominator.
      durations[t] = left > 0 ? Infinity : periods;
    }
    durations.sort(function (a, b) { return a - b; });
    var results = [0.5, 0.7, 0.85, 0.95].map(function (p) {
      var duration = durations[Math.ceil(p * trials) - 1];
      return { p: p, periods: Number.isFinite(duration) ? duration : null };
    });
    return { durations: durations.filter(Number.isFinite), results: results, unfinished: unfinished, trials: trials, maxPeriods: maxPeriods };
  }

  function normalizeVotes(raw, dimensions, levels) {
    var votes = {};
    dimensions.forEach(function (dim) {
      votes[dim.id] = {};
      levels.forEach(function (level) {
        var saved = raw && typeof raw === "object" && raw[dim.id] && raw[dim.id][level.id];
        votes[dim.id][level.id] = typeof saved === "number" && Number.isInteger(saved) && saved >= 0 && saved <= 9999 ? saved : 0;
      });
    });
    return votes;
  }

  return {
    numberInRange: numberInRange,
    parseHistory: parseHistory,
    localDate: localDate,
    doneDate: doneDate,
    simulate: simulate,
    normalizeVotes: normalizeVotes
  };
});
