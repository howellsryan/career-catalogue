(function (root, factory) {
  "use strict";
  var core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.WorkBriefCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FIELDS = [
    { key: "title", label: "Work name", limit: 180 },
    { key: "user", label: "Who needs this?", limit: 600, question: "Who will use this, and in what situation?" },
    { key: "problem", label: "The problem today", limit: 2000, question: "What is hard for the user today?" },
    { key: "evidence", label: "Evidence and assumptions", limit: 2000, question: "What have we observed, and what are we still assuming?" },
    { key: "outcome", label: "Desired user outcome", limit: 1500, question: "What should change for the user?" },
    { key: "success", label: "How we will know it helped", limit: 1500, question: "How will we know the change helped, and when will we check?" },
    { key: "slice", label: "The smallest useful slice", limit: 2000, question: "What is the smallest useful piece we can deliver?" },
    { key: "nonGoals", label: "Outside this slice", limit: 1500 },
    { key: "acceptance", label: "Acceptance examples", limit: 4000, question: "Which concrete cases should this change satisfy?" },
    { key: "constraints", label: "Constraints", limit: 2000 },
    { key: "dependencies", label: "Dependencies", limit: 2000 },
    { key: "unknowns", label: "Open questions and assumptions", limit: 4000 }
  ];

  function normalize(raw) {
    var validObject = raw !== null && typeof raw === "object" && !Array.isArray(raw);
    var draft = {};
    FIELDS.forEach(function (field) {
      var value = validObject && Object.prototype.hasOwnProperty.call(raw, field.key) ? raw[field.key] : null;
      draft[field.key] = typeof value === "string"
        ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, field.limit)
        : "";
    });
    return draft;
  }

  function hasContent(raw) {
    var draft = normalize(raw);
    return FIELDS.some(function (field) { return draft[field.key].trim() !== ""; });
  }

  function validate(raw) {
    var errors = {};
    FIELDS.forEach(function (field) {
      if (raw && typeof raw[field.key] === "string" && raw[field.key].length > field.limit) {
        errors[field.key] = "Use up to " + field.limit.toLocaleString("en-GB") + " characters. Shorten this field before saving or exporting.";
      }
    });
    return errors;
  }

  function discussionQuestions(raw) {
    var draft = normalize(raw);
    var questions = draft.unknowns.split("\n").map(function (line) { return line.trim(); }).filter(Boolean);
    FIELDS.forEach(function (field) {
      if (field.question && !draft[field.key].trim()) questions.push(field.question);
    });
    if (!draft.unknowns.trim()) questions.push("Are there any remaining assumptions or questions to test?");
    return questions;
  }

  function markdown(raw) {
    var draft = normalize(raw);
    var lines = ["# Work brief", "", "Draft for refinement. Blank fields are still to discuss.", ""];
    FIELDS.forEach(function (field) {
      lines.push("## " + field.label, "", draft[field.key].trim() || "To discuss", "");
    });
    return lines.join("\n").trimEnd() + "\n";
  }

  function filename(raw) {
    var title = normalize(raw).title.trim().toLowerCase();
    var slug = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/g, "");
    return (slug || "work-brief") + ".md";
  }

  function example() {
    return normalize({
      title: "Export invoices for finance reconciliation",
      user: "A finance analyst reconciling last month's invoices against the accounting system.",
      problem: "The analyst copies invoice rows from an on-screen table into a spreadsheet. This takes time and makes it easy to miss a row or transpose an amount.",
      evidence: "Illustrative example: in one observed reconciliation, the analyst spent 25 minutes copying 80 invoice rows. We do not yet know whether this is typical.",
      outcome: "The analyst can obtain the invoice data they already have permission to view without manually re-entering each row.",
      success: "Baseline in this example: 25 minutes to copy 80 rows. Trial the export during the next reconciliation and record time spent preparing the data and any missing or incorrect rows. Confirm the target with finance before refinement.",
      slice: "Export the current invoice table as a CSV, respecting its date filters and the user's existing permissions. Include invoice ID, issue date, customer, currency and total.",
      nonGoals: "Scheduled exports, a new reporting dashboard, accounting-system integration, and changes to invoice permissions.",
      acceptance: "Given a filtered table of 80 accessible invoices, when the analyst exports, then the CSV contains all 80 matching rows and the agreed column headers.\nGiven an invoice outside the user's permissions, when they export, then it is absent from the file.\nGiven a customer name containing a comma or quote, when the file is opened, then its fields remain in the correct columns.\nGiven no matching invoices, when the analyst exports, then the file has headers and no data rows.",
      constraints: "Preserve existing access controls. The export must work with the spreadsheet software finance uses. Check which invoice fields may contain personal data.",
      dependencies: "Finance to confirm column names, date format and spreadsheet software. Engineering to confirm the existing filtering and permissions behavior.",
      unknowns: "Does the export need all filtered results, or just the visible page? Finance to confirm.\nWhat row volume should we support, and what should happen above it? Engineering and finance to agree.\nCan any cells be interpreted as spreadsheet formulas, and how should they be handled safely? Engineering to investigate.\nIs this reconciliation problem common enough to justify the slice? Validate with another analyst."
    });
  }

  return { fields: FIELDS, normalize: normalize, hasContent: hasContent, validate: validate, discussionQuestions: discussionQuestions, markdown: markdown, filename: filename, example: example };
});
