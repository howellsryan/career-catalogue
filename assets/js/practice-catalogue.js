(function () {
  "use strict";
  // Keep bookmarked links to the former tab panels working on either host.
  function openBookmarkedTool() {
    var id = window.location.hash.slice(1).replace(/^panel-/, "");
    var links = document.querySelectorAll("[data-legacy-tool]");
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute("data-legacy-tool") === id) {
        window.location.replace(links[i].href + window.location.search);
        break;
      }
    }
  }
  window.addEventListener("hashchange", openBookmarkedTool);
  openBookmarkedTool();
})();
