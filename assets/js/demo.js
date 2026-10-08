(function () {
  "use strict";
  var core = window.DemoCore;
  var kit = window.PracticeKit;
  if (!core || !kit || !document.getElementById("demo-tool")) return;

  var KEY = "cc-practice-demo-v1";
  var restored = core.restore(kit.read(KEY, core.empty()));
  var state = restored.state;
  var outputs = { agenda: "", followUp: "", pack: "" };

  function $(id) { return document.getElementById(id); }
  function today() { return kit.localDate(); }
  function announce(message) { $("demo-status").textContent = message; }
  function save() {
    $("demo-storage").textContent = kit.write(KEY, state)
      ? "Saved in this browser. Download the pack to keep a separate copy."
      : "Browser storage is unavailable. This draft will last only while this page stays open; download the pack to keep it.";
  }
  function element(tag, className, content) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function compact(value, fallback, limit) {
    var plain = value.trim().replace(/\s+/g, " ") || fallback;
    return plain.length > limit ? plain.slice(0, limit - 1) + "…" : plain;
  }
  function openFeedbackRows() {
    var open = [];
    document.querySelectorAll("[data-feedback-item]").forEach(function (details) { open[Number(details.dataset.feedbackItem)] = details.open; });
    return open;
  }

  function rowField(index, key, label, options) {
    var settings = options || {};
    var id = "demo-feedback-" + index + "-" + key;
    var wrapper = element("div", "px-field");
    var labelNode = element("label", "px-legend", label);
    labelNode.htmlFor = id;
    var input = document.createElement(settings.multiline ? "textarea" : "input");
    input.id = id;
    input.dataset.feedbackField = key;
    input.dataset.feedbackIndex = index;
    if (settings.multiline) input.rows = 3;
    else input.type = settings.type || "text";
    if (settings.limit) input.maxLength = settings.limit;
    if (settings.placeholder) input.placeholder = settings.placeholder;
    input.value = state.feedback[index][key];
    wrapper.append(labelNode, input);
    if (input.type === "date") {
      input.min = "0001-01-01";
      input.max = key === "responseDate" ? today() : "9999-12-31";
      var error = element("p", "px-error");
      error.id = id + "-error";
      error.hidden = true;
      input.setAttribute("aria-describedby", error.id);
      wrapper.appendChild(error);
    }
    return wrapper;
  }

  function renderFeedback(openRows) {
    var opened = openRows || openFeedbackRows();
    var rows = $("demo-feedback-rows");
    rows.replaceChildren();
    if (!state.feedback.length) rows.appendChild(element("p", "px-empty", "No feedback recorded yet. Add an item when you hear a request or question."));
    state.feedback.forEach(function (row, index) {
      var card = element("details", "px-card px-feedback-item");
      card.dataset.feedbackItem = index;
      card.open = opened[index] === true;
      var summary = element("summary");
      summary.id = "demo-feedback-" + index + "-heading";
      var request = element("span", "px-feedback-request");
      request.id = "demo-feedback-" + index + "-summary-request";
      var meta = element("span", "px-feedback-meta");
      meta.id = "demo-feedback-" + index + "-summary-meta";
      summary.append(request, meta);
      card.appendChild(summary);
      var body = element("div", "px-stack");
      body.appendChild(rowField(index, "request", "Request or question", { multiline: true, limit: 2000, placeholder: "What did the stakeholder ask for?" }));
      var grid = element("div", "px-grid");
      var decisionField = element("div", "px-field");
      var decisionId = "demo-feedback-" + index + "-decision";
      var label = element("label", "px-legend", "Decision");
      label.htmlFor = decisionId;
      var select = document.createElement("select");
      select.id = decisionId;
      select.dataset.feedbackField = "decision";
      select.dataset.feedbackIndex = index;
      [""].concat(core.DECISIONS).forEach(function (decision) {
        var option = element("option", "", decision || "Pending — decide later");
        option.value = decision;
        select.appendChild(option);
      });
      select.value = row.decision;
      decisionField.append(label, select);
      grid.append(decisionField, rowField(index, "owner", "Owner", { limit: 200, placeholder: "Name a person or role" }));
      body.appendChild(grid);
      body.appendChild(rowField(index, "rationale", "Rationale or next step", { multiline: true, limit: 2000, placeholder: "Why this decision? What remains to be checked?" }));
      body.appendChild(rowField(index, "dueDate", "Follow-up date (optional)", { type: "date" }));
      var sharedLabel = element("label", "px-choice");
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = "demo-feedback-" + index + "-responded";
      checkbox.dataset.feedbackField = "responded";
      checkbox.dataset.feedbackIndex = index;
      checkbox.checked = row.responded;
      sharedLabel.append(checkbox, document.createTextNode("Response shared with the stakeholder"));
      body.appendChild(sharedLabel);
      var responseField = rowField(index, "responseDate", "Date response was shared (optional)", { type: "date" });
      responseField.id = "demo-feedback-" + index + "-response-date-field";
      responseField.hidden = !row.responded;
      responseField.querySelector("input").disabled = !row.responded;
      body.appendChild(responseField);
      var rowStatus = element("p", "px-status");
      rowStatus.id = "demo-feedback-" + index + "-status";
      body.appendChild(rowStatus);
      var actions = element("div", "px-actions");
      var copy = element("button", "px-btn px-btn--small", "Copy this response");
      copy.type = "button";
      copy.id = "demo-feedback-" + index + "-copy";
      copy.dataset.copyFeedback = index;
      var remove = element("button", "px-btn px-btn--ghost px-btn--small", "Remove feedback " + (index + 1));
      remove.type = "button";
      remove.dataset.removeFeedback = index;
      actions.append(copy, remove);
      body.appendChild(actions);
      card.appendChild(body);
      rows.appendChild(card);
    });
    $("demo-add-feedback").disabled = state.feedback.length >= core.MAX_FEEDBACK;
  }

  function updateErrors() {
    var errors = core.validate(state, today());
    document.querySelectorAll("#demo-tool input[type='date']").forEach(function (input) {
      var key = input.dataset.demoField || "feedback." + input.dataset.feedbackIndex + "." + input.dataset.feedbackField;
      if (!input.disabled && input.validity.badInput) errors[key] = "Use a complete, real date in YYYY-MM-DD format.";
      var message = errors[key] || "";
      var errorNode = $(input.id + "-error");
      if (errorNode) {
        errorNode.hidden = !message;
        errorNode.textContent = message;
      }
      if (message) {
        input.setAttribute("aria-invalid", "true");
        var details = input.closest("details[data-feedback-item]");
        if (details) details.open = true;
      }
      else input.removeAttribute("aria-invalid");
    });
    return errors;
  }

  function update() {
    var errors = updateErrors();
    var valid = Object.keys(errors).length === 0;
    var agendaStarted = ["title", "demoDate", "problem", "change", "evidence", "question"].some(function (key) { return state[key].trim(); });
    ["demo-copy-agenda", "demo-download-agenda"].forEach(function (id) { $(id).disabled = !valid || !agendaStarted; });
    ["demo-copy-follow-up", "demo-download-follow-up"].forEach(function (id) { $(id).disabled = !valid || !state.feedback.length; });
    $("demo-download-pack").disabled = !valid || !core.hasContent(state);
    $("demo-agenda-glance-title").textContent = compact(state.title, "Untitled demo", 120) + (state.demoDate ? " · " + state.demoDate : "");
    var prompts = { problem: "Name the user and their problem.", change: "Describe the task you will demonstrate.", evidence: "Record what you know, or what needs testing.", question: "Choose what you want to learn." };
    Object.keys(prompts).forEach(function (key) { $("demo-agenda-glance-" + key).textContent = compact(state[key], prompts[key], 220); });
    if (valid) {
      outputs.agenda = core.agenda(state, today());
      outputs.followUp = core.followUp(state, today());
      outputs.pack = core.pack(state, today());
      $("demo-agenda-output").textContent = outputs.agenda;
      $("demo-follow-up-output").textContent = outputs.followUp;
    } else {
      $("demo-agenda-output").textContent = "Correct the highlighted dates to preview or export this demo pack. Your other entries are kept.";
      $("demo-follow-up-output").textContent = "Correct the highlighted dates to preview or export the follow-up.";
    }
    var pending = 0;
    var overdue = 0;
    state.feedback.forEach(function (row, index) {
      var rowErrors = Object.keys(errors).some(function (key) { return key.indexOf("feedback." + index + ".") === 0; });
      var description = core.status(row, today());
      if (!row.responded || rowErrors) pending += 1;
      if (description === "Response overdue") overdue += 1;
      $("demo-feedback-" + index + "-status").textContent = rowErrors ? "Check the dates before sharing this response." : description + (row.responded && row.responseDate ? " on " + row.responseDate : "") + ".";
      $("demo-feedback-" + index + "-summary-request").textContent = (index + 1) + ". " + compact(row.request, "New feedback item", 120);
      $("demo-feedback-" + index + "-summary-meta").textContent = [row.decision || "Decision pending", compact(row.owner, "Owner unassigned", 60), row.dueDate ? "Follow up " + row.dueDate : "No follow-up date", rowErrors ? "Check dates" : description].join(" · ");
      $("demo-feedback-" + index + "-copy").disabled = rowErrors;
    });
    $("demo-feedback-summary").textContent = state.feedback.length
      ? state.feedback.length + " feedback item" + (state.feedback.length === 1 ? "" : "s") + "; " + pending + " response" + (pending === 1 ? "" : "s") + " still pending" + (overdue ? ", " + overdue + " overdue" : "") + "."
      : "";
  }

  function render() {
    document.querySelectorAll("[data-demo-field]").forEach(function (input) { input.value = state[input.dataset.demoField]; });
    renderFeedback([]);
    update();
  }

  function edit(event) {
    var input = event.target;
    if (input.dataset.demoField) state[input.dataset.demoField] = input.value;
    else if (input.dataset.feedbackField) {
      var index = Number(input.dataset.feedbackIndex);
      var key = input.dataset.feedbackField;
      if (!state.feedback[index]) return;
      state.feedback[index][key] = key === "responded" ? input.checked : input.value;
      if (key === "responded") {
        var field = $("demo-feedback-" + index + "-response-date-field");
        var dateInput = field.querySelector("input");
        field.hidden = !input.checked;
        dateInput.disabled = !input.checked;
        if (!input.checked) {
          state.feedback[index].responseDate = "";
          dateInput.value = "";
        }
      }
    } else return;
    update();
    save();
  }

  $("demo-tool").addEventListener("input", edit);
  $("demo-tool").addEventListener("change", edit);
  $("demo-add-feedback").addEventListener("click", function () {
    if (state.feedback.length >= core.MAX_FEEDBACK) return;
    var opened = openFeedbackRows();
    state = core.addFeedback(state);
    opened[state.feedback.length - 1] = true;
    renderFeedback(opened); update(); save();
    $("demo-feedback-" + (state.feedback.length - 1) + "-request").focus();
    announce("Feedback item added.");
  });
  $("demo-feedback-rows").addEventListener("click", function (event) {
    var copy = event.target.closest("[data-copy-feedback]");
    if (copy) {
      var response = core.response(state, Number(copy.dataset.copyFeedback), today());
      kit.copy(response, copy, $("demo-status")).then(update);
      return;
    }
    var button = event.target.closest("[data-remove-feedback]");
    if (!button) return;
    var index = Number(button.dataset.removeFeedback);
    var row = state.feedback[index];
    if (Object.keys(row).some(function (key) { return row[key] === true || (typeof row[key] === "string" && row[key].trim()); }) &&
        !window.confirm("Remove feedback " + (index + 1) + " and its recorded response? This clears the item's fields.")) return;
    var opened = openFeedbackRows();
    state = core.removeFeedback(state, index);
    opened.splice(index, 1);
    if (state.feedback.length) opened[Math.min(index, state.feedback.length - 1)] = true;
    renderFeedback(opened); update(); save();
    if (state.feedback.length) $("demo-feedback-" + Math.min(index, state.feedback.length - 1) + "-request").focus();
    else $("demo-add-feedback").focus();
    announce("Feedback item removed.");
  });

  function replace(next, prompt, message) {
    if (core.hasContent(state) && !window.confirm(prompt)) return;
    state = next;
    render(); save();
    $("demo-title").focus();
    announce(message);
  }
  $("demo-example").addEventListener("click", function () {
    replace(core.example(), "Replace this demo and its feedback with the reporting example? Download the complete pack first if you need to keep it.", "Reporting example loaded. Choose your own demo and follow-up dates.");
  });
  $("demo-reset").addEventListener("click", function () {
    replace(core.empty(), "Clear this demo and all its feedback to start the next one? Download the complete pack first if you need to keep it.", "Current demo cleared. Ready for the next one.");
  });

  [["demo-copy-agenda", "agenda"], ["demo-copy-follow-up", "followUp"]].forEach(function (item) {
    $(item[0]).addEventListener("click", function () { kit.copy(outputs[item[1]], $(item[0]), $("demo-status")).then(update); });
  });
  [["demo-download-agenda", "agenda", "demo-agenda.md"], ["demo-download-follow-up", "followUp", "demo-follow-up.md"], ["demo-download-pack", "pack", "demo-feedback-pack.md"]].forEach(function (item) {
    $(item[0]).addEventListener("click", function () {
      announce(kit.download(outputs[item[1]], item[2]) ? "Download prepared. Keep it before starting the next demo." : "Download could not start. Copy the text to keep a separate version.");
    });
  });

  render();
  save();
  if (restored.recovered) announce("Some saved fields were not valid and have been reset. Review this draft before sharing it.");
})();
