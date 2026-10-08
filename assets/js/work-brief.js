(function () {
  "use strict";

  var Core = window.WorkBriefCore;
  var Kit = window.PracticeKit;
  var form = document.getElementById("work-brief-form");
  if (!Core || !Kit || !form) return;

  var KEY = "cc-practice-work-brief-v1";
  var status = document.getElementById("brief-status");
  var saveStatus = document.getElementById("brief-save-status");
  var copyButton = document.getElementById("brief-copy");
  var downloadButton = document.getElementById("brief-download");
  var clearButton = document.getElementById("brief-clear");
  var copying = false;
  var draft = Core.normalize(Kit.read(KEY, null));

  function collect() {
    var values = {};
    Core.fields.forEach(function (field) { values[field.key] = document.getElementById("brief-" + field.key).value; });
    return values;
  }

  function fill(values) {
    Core.fields.forEach(function (field) { document.getElementById("brief-" + field.key).value = values[field.key]; });
  }

  function render() {
    var values = collect();
    var errors = Core.validate(values);
    var valid = Object.keys(errors).length === 0;
    draft = Core.normalize(values);
    Core.fields.forEach(function (field) {
      var input = document.getElementById("brief-" + field.key);
      var error = document.getElementById("brief-" + field.key + "-error");
      error.textContent = errors[field.key] || "";
      error.hidden = !errors[field.key];
      if (errors[field.key]) {
        input.setAttribute("aria-invalid", "true");
        var disclosure = typeof input.closest === "function" ? input.closest("details") : null;
        if (disclosure) disclosure.open = true;
      } else input.removeAttribute("aria-invalid");
    });
    document.getElementById("brief-preview").textContent = Core.markdown(draft);
    document.getElementById("brief-summary-title").textContent = draft.title.trim() || "Work brief";
    ["user", "problem", "outcome", "slice"].forEach(function (key) {
      document.getElementById("brief-summary-" + key).textContent = draft[key].trim() || "To discuss";
    });
    var list = document.getElementById("brief-discussion");
    list.replaceChildren();
    Core.discussionQuestions(draft).forEach(function (question) {
      var item = document.createElement("li");
      item.textContent = question;
      list.appendChild(item);
    });
    var content = Core.hasContent(values);
    copyButton.disabled = !content || !valid || copying;
    downloadButton.disabled = !content || !valid;
    clearButton.disabled = !content;
    return valid;
  }

  function save() {
    if (!render()) {
      saveStatus.textContent = "This change is not saved. Shorten the highlighted field to save or export.";
      return;
    }
    saveStatus.textContent = Kit.write(KEY, draft)
      ? "Saved on this device."
      : "This browser could not save the draft. Copy or download it before leaving.";
  }

  fill(draft);
  render();
  if (Core.hasContent(draft)) saveStatus.textContent = "Saved draft restored from this device.";
  form.addEventListener("submit", function (event) { event.preventDefault(); });
  form.addEventListener("input", function () { status.textContent = ""; save(); });

  document.getElementById("brief-example").addEventListener("click", function () {
    if (Core.hasContent(collect()) && !window.confirm("Replace your draft with the finance CSV example? Copy or download your current draft first if you want to keep it.")) return;
    fill(Core.example());
    save();
    status.textContent = "Example loaded. Its evidence is illustrative; replace it with your own observations.";
    document.getElementById("brief-title").focus();
  });

  copyButton.addEventListener("click", async function () {
    if (!render() || !Core.hasContent(draft)) return;
    copying = true;
    try { await Kit.copy(Core.markdown(draft), copyButton, status); }
    finally { copying = false; render(); }
  });

  downloadButton.addEventListener("click", function () {
    if (!render() || !Core.hasContent(draft)) return;
    status.textContent = Kit.download(Core.markdown(draft), Core.filename(draft))
      ? "Markdown download started. Keep a copy somewhere you can find again."
      : "The download could not start. Use Copy Markdown to keep a copy.";
  });

  clearButton.addEventListener("click", function () {
    if (!Core.hasContent(collect()) || !window.confirm("Clear this work brief from the page and this browser? Copy or download it first if you want to keep it.")) return;
    var removed = Kit.remove(KEY);
    if (!removed) removed = Kit.write(KEY, Core.normalize(null));
    fill(Core.normalize(null));
    render();
    saveStatus.textContent = removed
      ? "Draft cleared from this device."
      : "The page is cleared, but this browser could not remove the saved draft. It may return on reload.";
    status.textContent = removed ? "Draft cleared." : "Saved draft could not be cleared. See the save status below.";
    document.getElementById("brief-title").focus();
  });
})();
