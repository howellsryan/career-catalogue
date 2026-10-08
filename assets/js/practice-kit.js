(function (root, factory) {
  "use strict";
  var kit = factory(root);
  if (typeof module === "object" && module.exports) module.exports = kit;
  else root.PracticeKit = kit;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  "use strict";

  function read(key, fallback) {
    try {
      var value = root.localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) { return fallback; }
  }

  function write(key, value) {
    try {
      root.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) { return false; }
  }

  function remove(key) {
    try {
      root.localStorage.removeItem(key);
      return true;
    } catch (error) { return false; }
  }

  async function copy(text, button, status) {
    var previous = root.document && root.document.activeElement;
    var wasDisabled = button ? button.disabled : false;
    if (button) button.disabled = true;
    var copied = false;
    try {
      if (root.navigator.clipboard && root.isSecureContext) {
        try {
          await root.navigator.clipboard.writeText(text);
          copied = true;
        } catch (error) { /* Try a browser-local fallback below. */ }
      }
      if (!copied) {
        var field = root.document.createElement("textarea");
        field.value = text;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.left = "-10000px";
        root.document.body.appendChild(field);
        try {
          field.select();
          copied = root.document.execCommand("copy");
        } finally {
          field.remove();
        }
      }
    } catch (error) { copied = false; }
    finally {
      if (button) button.disabled = wasDisabled;
      if (previous && typeof previous.focus === "function" &&
          (root.document.activeElement === previous || root.document.activeElement === root.document.body)) {
        previous.focus({ preventScroll: true });
      }
    }
    if (status) status.textContent = copied ? "Copied to clipboard." : "Could not copy. Select the preview text and copy it using your browser, or download it.";
    return copied;
  }

  function download(text, filename) {
    var url;
    var link;
    try {
      url = root.URL.createObjectURL(new root.Blob([text], { type: "text/markdown;charset=utf-8" }));
      link = root.document.createElement("a");
      link.href = url;
      link.download = filename;
      root.document.body.appendChild(link);
      link.click();
      return true;
    } catch (error) { return false; }
    finally {
      if (link) link.remove();
      if (url) root.setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
    }
  }

  function localDate(days) {
    var date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + (Number.isInteger(days) ? days : 0));
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  return { read: read, write: write, remove: remove, copy: copy, download: download, localDate: localDate };
});
