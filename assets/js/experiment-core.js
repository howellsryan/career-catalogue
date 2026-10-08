(function (root, factory) {
  "use strict";
  var core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.ExperimentCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FIELDS = ["context", "change", "owner", "signal", "reviewDate"];
  var LIMITS = { context: 3000, change: 3000, owner: 200, signal: 3000, reviewDate: 10 };
  var LABELS = { context: "Describe the problem or observation.", change: "Describe one change to try.", owner: "Add a volunteer owner.", signal: "Describe an observable sign that the change helped." };
  var DECISIONS = ["keep", "change", "stop", "closed"];

  function object(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function clean(value, limit) { return typeof value === "string" ? value.trim().slice(0, limit) : ""; }
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var bits = value.split("-").map(Number), year = bits[0], month = bits[1], day = bits[2];
    var leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    var days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
  }
  function addDays(iso, days) {
    if (!validDate(iso) || !Number.isSafeInteger(days)) return null;
    var bits = iso.split("-").map(Number), date = new Date(0);
    date.setUTCHours(12, 0, 0, 0);
    date.setUTCFullYear(bits[0], bits[1] - 1, bits[2]);
    date.setUTCDate(date.getUTCDate() + days);
    var year = date.getUTCFullYear();
    if (!Number.isFinite(year) || year < 1 || year > 9999) return null;
    return String(year).padStart(4, "0") + "-" + String(date.getUTCMonth() + 1).padStart(2, "0") + "-" + String(date.getUTCDate()).padStart(2, "0");
  }
  function plan(raw) {
    var result = {};
    FIELDS.forEach(function (key) {
      var value = object(raw) ? raw[key] : "";
      result[key] = key === "reviewDate" ? (validDate(value) ? value : "") : clean(value, LIMITS[key]);
    });
    return result;
  }
  function blankPlan(today) {
    var result = plan(null);
    result.reviewDate = addDays(today, 14) || today;
    return result;
  }
  function validatePlan(raw, today, nextReview) {
    var result = plan(raw), errors = {};
    ["context", "change", "owner", "signal"].forEach(function (key) {
      if (!result[key]) errors[key] = LABELS[key];
      else if (typeof raw[key] === "string" && raw[key].trim().length > LIMITS[key]) errors[key] = "Use no more than " + LIMITS[key] + " characters.";
    });
    if (!validDate(result.reviewDate)) errors.reviewDate = "Choose a valid review date.";
    else if (validDate(today) && (nextReview ? result.reviewDate <= today : result.reviewDate < today)) {
      errors.reviewDate = nextReview ? "Choose the next review after today." : "Choose today or a future review date.";
    }
    return { plan: result, errors: errors };
  }
  function complete(raw) { return Object.keys(validatePlan(raw, null, false).errors).length === 0; }
  function reviewDraft(raw, active, today) {
    var source = object(raw) ? raw : {};
    var revised = plan(source.plan || (active && active.plan));
    return {
      happened: clean(source.happened, 5000),
      decision: ["keep", "change", "stop"].indexOf(source.decision) >= 0 ? source.decision : "",
      nextDate: validDate(source.nextDate) ? source.nextDate : (addDays(today, 14) || today),
      plan: revised
    };
  }
  function normalizeState(raw, today) {
    var source = object(raw) && raw.version === 1 ? raw : {};
    var draft = object(source.draft) ? plan(source.draft) : blankPlan(today);
    var active = null;
    if (object(source.active)) {
      var current = plan(source.active.plan), original = plan(source.active.originalPlan);
      if (complete(current)) {
        active = {
          id: clean(source.active.id, 80) || "recovered-experiment",
          plan: current,
          originalPlan: complete(original) ? original : plan(current),
          createdOn: validDate(source.active.createdOn) ? source.active.createdOn : today,
          cycle: Number.isInteger(source.active.cycle) && source.active.cycle > 0 && source.active.cycle <= 1000000 ? source.active.cycle : 1
        };
      } else if (["context", "change", "owner", "signal"].some(function (key) { return current[key]; })) {
        draft = current; // Recover incomplete saved work into the editable draft.
      }
    }
    var archive = [];
    if (Array.isArray(source.archive)) source.archive.forEach(function (row) {
      if (!object(row) || !complete(row.plan) || DECISIONS.indexOf(row.decision) < 0 || !validDate(row.reviewedOn)) return;
      archive.push({
        experimentId: clean(row.experimentId, 80) || "recovered-experiment",
        cycle: Number.isInteger(row.cycle) && row.cycle > 0 && row.cycle <= 1000000 ? row.cycle : 1,
        plan: plan(row.plan), originalPlan: complete(row.originalPlan) ? plan(row.originalPlan) : plan(row.plan),
        createdOn: validDate(row.createdOn) ? row.createdOn : row.reviewedOn,
        reviewedOn: row.reviewedOn, happened: clean(row.happened, 5000), decision: row.decision,
        nextPlan: complete(row.nextPlan) ? plan(row.nextPlan) : null
      });
    });
    return { version: 1, draft: draft, active: active, reviewDraft: reviewDraft(source.reviewDraft, active, today), archive: archive.slice(0, 10) };
  }
  function hasDraftWork(raw) {
    return ["context", "change", "owner", "signal"].some(function (key) { return plan(raw)[key] !== ""; });
  }
  function savePlan(state, raw, today, id) {
    var next = normalizeState(state, today), checked = validatePlan(raw, today, false);
    if (next.active) checked.errors.form = "Review or close the active experiment before saving another.";
    if (!validDate(today)) checked.errors.form = "The current date is unavailable. Reload and try again.";
    if (Object.keys(checked.errors).length) return { state: next, errors: checked.errors };
    next.active = { id: clean(id, 80) || "experiment-" + today, plan: plan(checked.plan), originalPlan: plan(checked.plan), createdOn: today, cycle: 1 };
    next.draft = blankPlan(today);
    next.reviewDraft = reviewDraft(null, next.active, today);
    return { state: next, errors: {} };
  }
  function reviewExperiment(state, raw, today) {
    var next = normalizeState(state, today), errors = {}, input = object(raw) ? raw : {};
    if (!next.active) return { state: next, errors: { form: "Save an experiment before reviewing it." } };
    if (!validDate(today)) errors.form = "The current date is unavailable. Reload and try again.";
    var happened = clean(input.happened, 5000);
    if (!happened) errors.happened = "Record what happened, including what you observed.";
    else if (typeof input.happened === "string" && input.happened.trim().length > 5000) errors.happened = "Use no more than 5,000 characters.";
    if (["keep", "change", "stop"].indexOf(input.decision) < 0) errors.decision = "Choose Keep, Change or Stop.";
    var nextPlan = null;
    if (input.decision === "keep" || input.decision === "change") {
      if (!validDate(input.nextDate) || input.nextDate <= today) errors.nextDate = "Choose the next review after today.";
      if (input.decision === "keep") nextPlan = plan(next.active.plan);
      else {
        var revised = Object.assign({}, object(input.plan) ? input.plan : {}, { reviewDate: input.nextDate });
        var checked = validatePlan(revised, today, true);
        Object.keys(checked.errors).forEach(function (key) { if (key !== "reviewDate") errors[key] = checked.errors[key]; });
        nextPlan = checked.plan;
        if (["context", "change", "owner", "signal"].every(function (key) { return nextPlan[key] === next.active.plan[key]; })) {
          errors.change = "Revise the plan to describe what you will try differently.";
        }
      }
      if (nextPlan) nextPlan.reviewDate = validDate(input.nextDate) ? input.nextDate : "";
    }
    if (Object.keys(errors).length) return { state: next, errors: errors };
    var current = next.active;
    next.archive.unshift({ experimentId: current.id, cycle: current.cycle, plan: plan(current.plan), originalPlan: plan(current.originalPlan), createdOn: current.createdOn, reviewedOn: today, happened: happened, decision: input.decision, nextPlan: nextPlan ? plan(nextPlan) : null });
    next.archive = next.archive.slice(0, 10);
    if (input.decision === "stop") next.active = null;
    else next.active = { id: current.id, cycle: current.cycle + 1, plan: nextPlan, originalPlan: plan(current.originalPlan), createdOn: current.createdOn };
    next.reviewDraft = reviewDraft(null, next.active, today);
    return { state: next, errors: {} };
  }
  function startNew(state, today) {
    var next = normalizeState(state, today);
    if (next.active) {
      var current = next.active;
      next.archive.unshift({ experimentId: current.id, cycle: current.cycle, plan: plan(current.plan), originalPlan: plan(current.originalPlan), createdOn: current.createdOn, reviewedOn: today, happened: next.reviewDraft.happened || "Closed without a review when a new experiment was started.", decision: "closed", nextPlan: null });
      next.archive = next.archive.slice(0, 10);
    }
    next.active = null;
    next.draft = blankPlan(today);
    next.reviewDraft = reviewDraft(null, null, today);
    return next;
  }
  function reviewStatus(reviewDate, today) {
    if (!validDate(reviewDate) || !validDate(today)) return "unknown";
    return reviewDate < today ? "overdue" : (reviewDate === today ? "today" : "upcoming");
  }
  function markdown(value) { return String(value || "").replace(/[\\`*_{}\[\]<>#+.!|~\-]/g, "\\$&"); }
  function planMarkdown(value) {
    var labels = { context: "Context", change: "Change to try", owner: "Volunteer owner", signal: "Observable success signal", reviewDate: "Review date" };
    return FIELDS.map(function (key) { return "**" + labels[key] + "**\n\n" + markdown(value[key]); }).join("\n\n");
  }
  function reviewMarkdown(row) {
    var label = row.decision === "closed" ? "Closed without completing a review" : row.decision[0].toUpperCase() + row.decision.slice(1);
    return "## Review " + row.cycle + " — " + row.reviewedOn + "\n\n### Plan reviewed\n\n" + planMarkdown(row.plan) + "\n\n### What happened\n\n" + markdown(row.happened) + "\n\n**Decision:** " + label + (row.nextPlan ? "\n\n### Next plan\n\n" + planMarkdown(row.nextPlan) : "");
  }
  function exportReview(row) {
    return "# Team experiment\n\n## Original plan\n\n" + planMarkdown(row.originalPlan) + "\n\n" + reviewMarkdown(row) + "\n";
  }
  function exportDraft(draft) {
    return "# Team experiment draft\n\n" + planMarkdown(plan(draft)) + "\n";
  }
  function exportState(state) {
    if (!state.active) {
      if (hasDraftWork(state.draft)) return exportDraft(state.draft);
      if (state.archive.length) {
        var latest = state.archive[0];
        var completed = state.archive.filter(function (row) { return row.experimentId === latest.experimentId; }).slice().reverse();
        return "# Team experiment\n\nStarted: " + latest.createdOn + "\n\n## Original plan\n\n" + planMarkdown(latest.originalPlan) + "\n\n## Learning\n\nRecent history is limited to the last 10 saved reviews and closures.\n\n" + completed.map(reviewMarkdown).join("\n\n") + "\n";
      }
      return exportDraft(state.draft);
    }
    var active = state.active;
    var output = "# Team experiment\n\nStarted: " + active.createdOn + "\n\n## Original plan\n\n" + planMarkdown(active.originalPlan);
    if (active.cycle > 1) output += "\n\n## Current plan — cycle " + active.cycle + "\n\n" + planMarkdown(active.plan);
    var rows = state.archive.filter(function (row) { return row.experimentId === active.id; }).slice().reverse();
    if (rows.length) output += "\n\n## Learning\n\nRecent history is limited to the last 10 saved reviews and closures.\n\n" + rows.map(reviewMarkdown).join("\n\n");
    var pending = object(state.reviewDraft) ? state.reviewDraft : {};
    if (clean(pending.happened, 5000) || pending.decision) {
      output += "\n\n## Review draft — not saved as a decision\n\n**What happened (draft)**\n\n" + markdown(clean(pending.happened, 5000));
      output += "\n\n**Pending decision:** " + (["keep", "change", "stop"].indexOf(pending.decision) >= 0 ? pending.decision[0].toUpperCase() + pending.decision.slice(1) : "No decision selected");
      if (pending.decision === "keep" || pending.decision === "change") output += "\n\n**Proposed next review:** " + markdown(pending.nextDate);
      if (pending.decision === "change") output += "\n\n### Proposed revised plan (draft)\n\n" + planMarkdown(Object.assign(plan(pending.plan), { reviewDate: validDate(pending.nextDate) ? pending.nextDate : "" }));
    }
    return output + "\n";
  }
  return { validDate: validDate, addDays: addDays, plan: plan, blankPlan: blankPlan, validatePlan: validatePlan, normalizeState: normalizeState, hasDraftWork: hasDraftWork, savePlan: savePlan, reviewExperiment: reviewExperiment, startNew: startNew, reviewStatus: reviewStatus, markdown: markdown, exportReview: exportReview, exportDraft: exportDraft, exportState: exportState };
});
