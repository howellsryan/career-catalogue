(function () {
  "use strict";
  var core = window.ExperimentCore, kit = window.PracticeKit;
  if (!core || !kit) return;
  var KEY = "cc-practice-experiment-v1";
  var fields = ["context", "change", "owner", "signal", "reviewDate"];
  var revisedFields = fields.slice(0, 4);
  function el(id) { return document.getElementById(id); }
  function today() { return kit.localDate(); }
  var loaded = kit.read(KEY, null);
  var state = core.normalizeState(loaded, today());
  var showLatest = !state.active && !core.hasDraftWork(state.draft) && state.archive.length > 0;
  var status = el("experiment-status"), planForm = el("experiment-plan-form"), reviewForm = el("experiment-review");
  var draftTimer;

  function persist() {
    var saved = kit.write(KEY, state);
    el("experiment-storage-warning").textContent = "Your browser could not save this work. It remains here while the page is open. Copy or download it before leaving.";
    el("experiment-storage-warning").hidden = saved;
    return saved;
  }
  function announce(message, saved) {
    status.textContent = message + (saved === false ? " Copy or download your work before leaving; browser storage is unavailable." : "");
  }
  function readPlan() {
    var values = {};
    fields.forEach(function (key) { values[key] = el("experiment-" + key).value; });
    return values;
  }
  function readReview() {
    var values = {};
    revisedFields.forEach(function (key) { values[key] = el("experiment-revised-" + key).value; });
    values.reviewDate = el("experiment-nextDate").value;
    return { happened: el("experiment-happened").value, decision: el("experiment-decision").value, nextDate: el("experiment-nextDate").value, plan: values };
  }
  function fillForms() {
    fields.forEach(function (key) { el("experiment-" + key).value = state.draft[key]; });
    var draft = state.reviewDraft;
    el("experiment-happened").value = draft.happened;
    el("experiment-decision").value = draft.decision;
    el("experiment-nextDate").value = draft.nextDate;
    revisedFields.forEach(function (key) { el("experiment-revised-" + key).value = draft.plan[key]; });
    el("experiment-reviewDate").min = today();
    el("experiment-nextDate").min = core.addDays(today(), 1) || today();
    reviewVisibility();
  }
  function reviewVisibility() {
    var decision = el("experiment-decision").value;
    el("experiment-next-date-field").hidden = decision !== "keep" && decision !== "change";
    el("experiment-nextDate").required = decision === "keep" || decision === "change";
    el("experiment-nextDate").disabled = !el("experiment-nextDate").required;
    el("experiment-revised-fields").hidden = decision !== "change";
    revisedFields.forEach(function (key) {
      var input = el("experiment-revised-" + key);
      input.required = decision === "change";
      input.disabled = decision !== "change";
    });
  }
  function dateLabel(iso) {
    if (!core.validDate(iso)) return iso;
    var bits = iso.split("-").map(Number), date = new Date(0);
    date.setHours(12, 0, 0, 0);
    date.setFullYear(bits[0], bits[1] - 1, bits[2]);
    return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }
  function renderDue() {
    el("experiment-due").hidden = !state.active;
    if (!state.active) return;
    var reviewDate = state.active.plan.reviewDate, due = core.reviewStatus(reviewDate, today());
    el("experiment-due-title").textContent = due === "overdue" ? "Your experiment is ready for review" : (due === "today" ? "Review your experiment today" : "Review on " + dateLabel(reviewDate));
    el("experiment-due-copy").textContent = due === "overdue" ? "The agreed review date was " + dateLabel(reviewDate) + ". Bring the observation back to the team and choose what happens next." : (due === "today" ? "Compare what happened with the signal you agreed. Then keep, change or stop the experiment." : "You can review early if you have enough evidence. Otherwise, come back on the agreed date.");
    el("experiment-reviewDate").min = today();
    el("experiment-nextDate").min = core.addDays(today(), 1) || today();
  }
  function currentExport() {
    return state.active || showLatest ? core.exportState(state) : core.exportDraft(state.draft);
  }
  function renderPreview() {
    var latest = !state.active && showLatest && !core.hasDraftWork(state.draft);
    el("experiment-preview-heading").textContent = state.active ? "The agreed experiment" : (latest ? "Latest completed experiment" : "Your draft");
    el("experiment-preview-help").textContent = state.active ? "This export keeps the original plan and recent learning alongside the current plan." : (latest ? "Your plan and recent learning are ready to take away. Type in the form to start a new draft." : "A copy you can take into the conversation. Saving the agreed plan starts the review cycle.");
    el("experiment-output").textContent = currentExport();
  }
  function renderHistory() {
    var container = el("experiment-history");
    container.textContent = "";
    el("experiment-history-empty").hidden = state.archive.length > 0;
    state.archive.forEach(function (row) {
      var details = document.createElement("details"), summary = document.createElement("summary");
      details.className = "px-example";
      var decision = row.decision === "closed" ? "Closed without review" : row.decision[0].toUpperCase() + row.decision.slice(1);
      var change = row.plan.change.length > 90 ? row.plan.change.slice(0, 87) + "…" : row.plan.change;
      summary.textContent = dateLabel(row.reviewedOn) + " · " + decision + " · Cycle " + row.cycle + " · " + change;
      var learned = document.createElement("p");
      learned.textContent = row.happened;
      var preview = document.createElement("pre");
      preview.className = "px-output";
      preview.tabIndex = 0;
      preview.textContent = core.exportReview(row);
      var actions = document.createElement("div");
      actions.className = "px-actions";
      var copy = document.createElement("button"), download = document.createElement("button");
      copy.type = download.type = "button";
      copy.className = download.className = "px-btn px-btn--small";
      copy.textContent = "Copy this review";
      download.textContent = "Download this review";
      copy.addEventListener("click", function () { kit.copy(core.exportReview(row), copy, status); });
      download.addEventListener("click", function () {
        announce(kit.download(core.exportReview(row), "team-experiment-review-" + row.reviewedOn + ".md") ? "Review downloaded." : "Could not download. Copy the review or select its text instead.");
      });
      actions.appendChild(copy); actions.appendChild(download);
      details.appendChild(summary); details.appendChild(learned); details.appendChild(preview); details.appendChild(actions);
      container.appendChild(details);
    });
  }
  function render() {
    planForm.hidden = Boolean(state.active);
    reviewForm.hidden = !state.active;
    renderDue(); renderPreview(); renderHistory();
  }
  function clearErrors(form) {
    form.querySelectorAll("[aria-invalid]").forEach(function (input) { input.removeAttribute("aria-invalid"); });
    form.querySelectorAll(".px-error").forEach(function (error) { error.hidden = true; error.textContent = ""; });
  }
  function showErrors(form, errors) {
    clearErrors(form);
    var first;
    Object.keys(errors).forEach(function (key) {
      var isPlan = form === planForm;
      var id = key === "form" ? (isPlan ? "experiment-plan" : "experiment-review") : "experiment-" + (!isPlan && revisedFields.indexOf(key) >= 0 ? "revised-" : "") + key;
      var error = el(id + "-error"), input = el(id);
      if (error) { error.textContent = errors[key]; error.hidden = false; }
      if (input && key !== "form") { input.setAttribute("aria-invalid", "true"); if (!first) first = input; }
    });
    announce("Check the highlighted fields before saving.");
    if (first) first.focus();
  }
  function autosave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(function () {
      var saved = persist();
      announce(saved ? "Draft saved on this device." : "Draft updated in this page.", saved);
    }, 350);
  }
  planForm.addEventListener("input", function () {
    state.draft = readPlan();
    showLatest = false;
    clearErrors(planForm); renderPreview(); autosave();
  });
  reviewForm.addEventListener("input", function () {
    state.reviewDraft = readReview();
    clearErrors(reviewForm); renderPreview(); autosave();
  });
  el("experiment-decision").addEventListener("change", function () {
    state.reviewDraft = readReview();
    reviewVisibility(); clearErrors(reviewForm); renderPreview(); autosave();
  });
  planForm.addEventListener("submit", function (event) {
    event.preventDefault(); clearTimeout(draftTimer);
    var id = "experiment-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
    var result = core.savePlan(state, readPlan(), today(), id);
    if (Object.keys(result.errors).length) { showErrors(planForm, result.errors); return; }
    state = result.state; showLatest = false;
    clearErrors(planForm); fillForms(); render();
    var saved = persist();
    announce((saved ? "Agreed plan saved." : "Agreed plan is ready in this page.") + " Come back on " + dateLabel(state.active.plan.reviewDate) + " to review it.", saved);
    el("experiment-happened").focus();
  });
  reviewForm.addEventListener("submit", function (event) {
    event.preventDefault(); clearTimeout(draftTimer);
    var result = core.reviewExperiment(state, readReview(), today());
    if (Object.keys(result.errors).length) { showErrors(reviewForm, result.errors); return; }
    state = result.state; showLatest = !state.active;
    clearErrors(reviewForm); fillForms(); render();
    var saved = persist();
    var reviewMessage = saved ? "Review saved in Recent learning." : "Review added to this page's Recent learning.";
    announce(reviewMessage + (state.active ? " The next cycle is ready for " + dateLabel(state.active.plan.reviewDate) + "." : " This experiment is complete."), saved);
    el("experiment-preview-heading").setAttribute("tabindex", "-1");
    el("experiment-preview-heading").focus();
  });
  el("experiment-copy").addEventListener("click", function () { kit.copy(currentExport(), this, status); });
  el("experiment-download").addEventListener("click", function () {
    announce(kit.download(currentExport(), "team-experiment-" + today() + ".md") ? "Experiment downloaded." : "Could not download. Copy the preview or select its text instead.");
  });
  el("experiment-new").addEventListener("click", function () {
    if (state.active) {
      if (!window.confirm("Close the active experiment and start a blank draft? Its plan and any review notes will be kept in Recent learning as a closure without review.")) return;
    } else if (core.hasDraftWork(state.draft) && !window.confirm("Discard this draft and start a blank experiment? Download or copy it first if you want to keep it.")) return;
    clearTimeout(draftTimer);
    state = core.startNew(state, today()); showLatest = false;
    clearErrors(planForm); clearErrors(reviewForm); fillForms(); render();
    announce("A blank experiment is ready. Recent learning has been kept.", persist());
    el("experiment-context").focus();
  });
  el("experiment-clear").addEventListener("click", function () {
    if (!window.confirm("Delete the draft, active experiment and all recent learning from this device? This cannot be undone. Copy or download anything you want to keep first.")) return;
    clearTimeout(draftTimer);
    var removed = kit.remove(KEY);
    state = core.normalizeState(null, today()); showLatest = false;
    clearErrors(planForm); clearErrors(reviewForm); fillForms(); render();
    el("experiment-storage-warning").hidden = removed;
    if (!removed) el("experiment-storage-warning").textContent = "Your browser could not delete saved experiment data. The page has been cleared, but previous work may return on reload.";
    announce(removed ? "All experiment data cleared from this device." : "The page is cleared, but browser storage could not be cleared.");
    el("experiment-context").focus();
  });
  function refreshDate() { renderDue(); }
  window.addEventListener("focus", refreshDate);
  window.addEventListener("pageshow", refreshDate);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshDate(); });
  window.addEventListener("pagehide", function () { clearTimeout(draftTimer); persist(); });
  window.setInterval(refreshDate, 60000);
  var origin = new URLSearchParams(window.location.search).get("from");
  if (origin === "retro" || origin === "health") {
    el("experiment-origin").hidden = false;
    el("experiment-origin").textContent = origin === "retro" ? "From the retro: choose one observation the team wants to act on." : "From the health discussion: choose one shared observation to explore. Votes and personal scores are not copied into this plan.";
  }
  fillForms(); render();
  if (loaded && JSON.stringify(loaded) !== JSON.stringify(state)) announce("Saved data has been recovered where possible. Check the plan before continuing.");
  persist(); // Check storage availability before the reader invests in a plan.
})();
