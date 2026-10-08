(function () {
  "use strict";
  var core = window.FuzzySearchCore;
  if (!core || !document.getElementById("fuzzy-search-lab")) return;
  function $(id) { return document.getElementById(id); }

  function render() {
    var result = core.compare($("fx-query").value, $("fx-candidates").value, $("fx-threshold").value);
    ["query", "candidates", "threshold"].forEach(function (field) {
      var error = result.errors[field], input = $("fx-" + field), message = $("fx-" + field + "-error");
      input.setAttribute("aria-invalid", error ? "true" : "false");
      message.hidden = !error;
      message.textContent = error || "";
    });
    $("fx-rows").textContent = "";
    var invalid = Object.keys(result.errors).length > 0;
    $("fx-results").hidden = invalid;
    if (invalid) {
      $("fx-status").textContent = "Comparison paused. " + Object.keys(result.errors).map(function (field) { return result.errors[field]; }).join(" ");
      return;
    }

    result.rows.forEach(function (row) {
      var tr = document.createElement("tr"), heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = row.value;
      tr.appendChild(heading);
      [row.distance, row.exact ? "Yes" : "No", row.accepted ? "Yes" : "No"].forEach(function (value) {
        var cell = document.createElement("td");
        cell.textContent = String(value);
        tr.appendChild(cell);
      });
      $("fx-rows").appendChild(tr);
    });
    var exact = result.rows.filter(function (row) { return row.exact; }).length;
    var fuzzy = result.rows.filter(function (row) { return row.accepted; }).length;
    $("fx-status").textContent = "Exact: " + exact + " of " + result.rows.length + ". Fuzzy at threshold " + result.threshold + ": " + fuzzy + " of " + result.rows.length + ".";
    var hasExample = result.query === "plumbr" && result.rows.some(function (row) { return row.normalized === "plumber"; }) && result.rows.some(function (row) { return row.normalized === "plumper"; });
    $("fx-example-note").hidden = !hasExample;
    if (hasExample) {
      $("fx-example-note").textContent = result.threshold === 0
        ? "The occupation ‘plumber’ is one edit away, so exact matching misses it. Try threshold 1."
        : result.threshold === 1
          ? "‘Plumber’ is accepted at distance 1. ‘Plumper’ stays out at distance 2: spelling tolerance recovered the intended occupation in this example."
          : "‘Plumber’ is accepted, but ‘plumper’ is now accepted too. That is an extra match with a different meaning: a false positive for someone looking for the occupation.";
    }
    $("fx-duplicates").hidden = result.duplicates === 0;
    $("fx-duplicates").textContent = result.duplicates + " repeated candidate line" + (result.duplicates === 1 ? " was" : "s were") + " ignored after normalization.";
  }

  $("fx-form").addEventListener("submit", function (event) { event.preventDefault(); render(); });
  ["fx-query", "fx-candidates"].forEach(function (id) { $(id).addEventListener("input", render); });
  $("fx-threshold").addEventListener("change", render);
  $("fx-reset").addEventListener("click", function () {
    $("fx-query").value = core.example.query;
    $("fx-candidates").value = core.example.candidates;
    $("fx-threshold").value = String(core.example.threshold);
    render();
    $("fx-status").textContent += " Worked example restored.";
  });
  $("fx-check").addEventListener("click", function () {
    $("fx-exercise-feedback").textContent = core.checkExercise($("fx-exercise").value).message;
  });
  $("fx-exercise").addEventListener("change", function () { $("fx-exercise-feedback").textContent = ""; });
  render();
})();
