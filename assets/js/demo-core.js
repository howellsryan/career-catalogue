(function (root, factory) {
  "use strict";
  var core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.DemoCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var MAX_FEEDBACK = 20;
  var DECISIONS = ["Act", "Defer", "Decline", "Investigate"];
  var FIELDS = { title: 200, demoDate: 10, problem: 3000, change: 3000, evidence: 3000, question: 3000 };
  var ROW_FIELDS = { request: 2000, rationale: 2000, owner: 200, dueDate: 10, responseDate: 10 };

  function object(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
  function text(value, limit) { return typeof value === "string" ? value.slice(0, limit) : ""; }
  function blankRow() { return { request: "", decision: "", rationale: "", owner: "", dueDate: "", responded: false, responseDate: "" }; }
  function empty() { return { version: 1, title: "", demoDate: "", problem: "", change: "", evidence: "", question: "", feedback: [] }; }

  function validDate(iso) {
    if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    var parts = iso.split("-").map(Number);
    if (parts[0] < 1) return false;
    var date = new Date(0);
    date.setUTCFullYear(parts[0], parts[1] - 1, parts[2]);
    return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
  }

  function normalize(value) {
    var state = empty();
    if (!object(value) || value.version !== 1) return state;
    Object.keys(FIELDS).forEach(function (key) { state[key] = key === "demoDate" ? (validDate(value[key]) ? value[key] : "") : text(value[key], FIELDS[key]); });
    if (Array.isArray(value.feedback)) {
      state.feedback = value.feedback.filter(object).slice(0, MAX_FEEDBACK).map(function (raw) {
        var row = blankRow();
        Object.keys(ROW_FIELDS).forEach(function (key) { row[key] = key === "dueDate" || key === "responseDate" ? (validDate(raw[key]) ? raw[key] : "") : text(raw[key], ROW_FIELDS[key]); });
        row.decision = DECISIONS.indexOf(raw.decision) === -1 ? "" : raw.decision;
        row.responded = raw.responded === true;
        if (!row.responded) row.responseDate = "";
        return row;
      });
    }
    return state;
  }

  function restore(value) {
    var state = normalize(value);
    return { state: state, recovered: JSON.stringify(value) !== JSON.stringify(state) };
  }

  function hasContent(value) {
    var state = normalize(value);
    return Object.keys(FIELDS).some(function (key) { return state[key].trim(); }) || state.feedback.length > 0;
  }

  function addFeedback(value) {
    var state = normalize(value);
    if (state.feedback.length >= MAX_FEEDBACK) throw new RangeError("Keep up to 20 feedback items in this demo cycle.");
    state.feedback.push(blankRow());
    return state;
  }

  function removeFeedback(value, index) {
    var state = normalize(value);
    if (!Number.isInteger(index) || index < 0 || index >= state.feedback.length) throw new RangeError("Choose an existing feedback item.");
    state.feedback.splice(index, 1);
    return state;
  }

  function validate(value, today) {
    var errors = {};
    var state = object(value) ? value : empty();
    if (state.demoDate && !validDate(state.demoDate)) errors.demoDate = "Use a real date in YYYY-MM-DD format.";
    (Array.isArray(state.feedback) ? state.feedback : []).forEach(function (row, i) {
      if (!object(row)) return;
      if (row.dueDate && !validDate(row.dueDate)) errors["feedback." + i + ".dueDate"] = "Use a real follow-up date in YYYY-MM-DD format.";
      if (row.responded && row.responseDate) {
        if (!validDate(row.responseDate)) errors["feedback." + i + ".responseDate"] = "Use a real response date in YYYY-MM-DD format.";
        else if (validDate(today) && row.responseDate > today) errors["feedback." + i + ".responseDate"] = "A shared response date cannot be in the future. Leave it blank if you do not know the date.";
      }
    });
    return errors;
  }

  function status(row, today) {
    if (row.responded === true) return "Response shared";
    if (validDate(row.dueDate) && validDate(today)) {
      if (row.dueDate < today) return "Response overdue";
      if (row.dueDate === today) return "Response due today";
    }
    return "Response pending";
  }

  function usable(value, today) {
    if (Object.keys(validate(value, today)).length) throw new RangeError("Correct the dates before exporting.");
    return normalize(value);
  }
  function filled(value, fallback) { return value.trim() || fallback; }

  function agenda(value, today) {
    var state = usable(value, today);
    return [
      "# Demo agenda — " + filled(state.title, "Untitled demo"),
      "", "Demo date: " + filled(state.demoDate, "Not scheduled"),
      "", "## 1. Who has the problem?", filled(state.problem, "User and problem not recorded yet."),
      "", "## 2. What changed? Show before and after.", filled(state.change, "Before and after not recorded yet."),
      "", "## 3. What evidence of value do we have?", filled(state.evidence, "Evidence not recorded yet. Treat value as unverified."),
      "", "## 4. What do we want to learn from this demo?", filled(state.question, "Question for the audience not recorded yet."),
      "", "## 5. Capture feedback and close the loop", "Record requests, a decision or open question, an owner and a follow-up date. Mark a response as shared only after communicating it.", ""
    ].join("\n");
  }

  function followUp(value, today) {
    var state = usable(value, today);
    var lines = ["# Stakeholder follow-up — " + filled(state.title, "Untitled demo"), ""];
    if (state.demoDate) lines.push("Demo date: " + state.demoDate, "");
    lines.push("Thanks for the feedback. Here is our current response, including the questions that remain open.", "");
    if (!state.feedback.length) lines.push("No feedback has been recorded yet.");
    state.feedback.forEach(function (row, i) {
      lines.push(
        "## " + (i + 1) + ". " + filled(row.request, "Feedback item not described yet"),
        "Decision: " + filled(row.decision, "Pending — no decision recorded"),
        "Rationale / next step: " + filled(row.rationale, "Not recorded yet"),
        "Owner: " + filled(row.owner, "Not yet assigned"),
        "Follow-up date: " + filled(row.dueDate, "Not scheduled"),
        "Response status: " + status(row, today) + (row.responded && row.responseDate ? " on " + row.responseDate : ""),
        ""
      );
    });
    lines.push("A shared response records communication. It does not mean the requested work or investigation is complete.", "");
    return lines.join("\n");
  }

  function pack(value, today) { return agenda(value, today) + "\n---\n\n" + followUp(value, today); }

  function example() {
    return {
      version: 1, title: "Payments reconciliation: first reporting slice", demoDate: "",
      problem: "Finance reconciles payments every Friday. Matching records by hand takes about two hours and makes missing references hard to find.",
      change: "Before: copy payment rows from several screens. After: export one CSV for a chosen date range, with payment ID, reference, amount and status. Show the same reconciliation task before and after.",
      evidence: "In a trial with one finance colleague, the CSV reduced a sample reconciliation from 20 minutes to 8. This is a small trial; weekly time saved is not yet validated.",
      question: "Can Finance reconcile a real week using these columns? Which missing information would stop them?",
      feedback: [
        { request: "Schedule the CSV to arrive by email every Friday.", decision: "Investigate", rationale: "First check who needs scheduled delivery, whether email is suitable for payment data, and whether the manual export is already sufficient.", owner: "Product owner", dueDate: "", responded: false, responseDate: "" },
        { request: "Include the settlement reference in the CSV.", decision: "Act", rationale: "The finance trial showed that this reference is needed to match payments. Confirm the source and add it to the next small slice.", owner: "Engineering lead", dueDate: "", responded: false, responseDate: "" }
      ]
    };
  }

  return { MAX_FEEDBACK: MAX_FEEDBACK, DECISIONS: DECISIONS, empty: empty, normalize: normalize, restore: restore, validDate: validDate, validate: validate, hasContent: hasContent, addFeedback: addFeedback, removeFeedback: removeFeedback, status: status, agenda: agenda, followUp: followUp, pack: pack, example: example };
});
