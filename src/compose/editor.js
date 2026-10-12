/*
 * Compose script: runs inside the message editor of every compose window.
 *  - Inline expansion: type a snippet key (e.g. "po1") and press Tab (or
 *    Space, see settings): the key is replaced by the snippet. Snippets with
 *    fields open the ThunderSnippet form first (background.js).
 *  - Inserts text sent by the add-on at the caret ({ type: "ts-insert" }).
 *  - Keeps inserted attachment names current ({ type: "ts-attachments" }).
 * A classic script (no modules), as compose scripts must be.
 */
(() => {
  let keys = new Set();
  let expandKey = "Tab";

  async function load() {
    const data = await browser.storage.local.get(["snippets", "settings"]);
    keys = new Set((data.snippets ?? []).map((s) => s.key));
    expandKey = data.settings?.expandKey ?? "Tab";
  }
  load();
  browser.storage.onChanged.addListener((changes) => {
    if (changes.snippets || changes.settings) load();
  });

  // The word just before the caret, if the caret is in a text node.
  function wordBeforeCaret() {
    const sel = window.getSelection();
    if (!sel || !sel.isCollapsed || !sel.rangeCount) return null;
    const { startContainer: node, startOffset: offset } = sel.getRangeAt(0);
    if (node.nodeType !== Node.TEXT_NODE) return null;
    const m = /([\p{L}\p{N}_.-]+)$/u.exec(node.data.slice(0, offset));
    return m ? m[1] : null;
  }

  function deleteBack(count) {
    const sel = window.getSelection();
    for (let i = 0; i < count; i++) sel.modify("extend", "backward", "character");
    document.execCommand("delete", false, null);
  }

  document.addEventListener(
    "keydown",
    (ev) => {
      if (expandKey === "off" || ev.ctrlKey || ev.altKey || ev.metaKey || ev.shiftKey || ev.isComposing) return;
      if (ev.key !== (expandKey === "Space" ? " " : "Tab")) return;
      const word = wordBeforeCaret();
      if (!word || !keys.has(word.toLowerCase())) return;
      ev.preventDefault();
      ev.stopPropagation();
      deleteBack(word.length);
      browser.runtime.sendMessage({ type: "ts-expand", key: word.toLowerCase(), typed: word });
    },
    true,
  );

  // Insert at the caret and leave the caret between `before` and `after`.
  function insert({ plain, before, after }) {
    window.focus();
    document.body.focus();
    if (plain) {
      document.execCommand("insertText", false, before + after);
      const sel = window.getSelection();
      for (let i = 0; i < after.length; i++) sel.modify("move", "backward", "character");
      return;
    }
    const id = `ts-caret-${Date.now()}`;
    document.execCommand("insertHTML", false, `${before}<span id="${id}"></span>${after}`);
    const marker = document.getElementById(id);
    if (!marker) return;
    const range = document.createRange();
    range.setStartBefore(marker);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    marker.remove();
  }

  browser.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "ts-insert") {
      insert(msg);
      return Promise.resolve(true);
    }
    // Attachments changed: refresh the {{attachments}} text inserted earlier.
    if (msg?.type === "ts-attachments") {
      for (const span of document.querySelectorAll("span[data-ts-att]")) {
        const names = msg.names ?? [];
        span.textContent = span.dataset.tsAtt === "attachments.count" ? String(names.length) : names.join(", ") || span.dataset.fallback || "";
      }
      return Promise.resolve(true);
    }
    if (msg?.type === "ts-ping") return Promise.resolve(true);
    // Used by the integration tests: type text at the caret, then a key.
    if (msg?.type === "ts-type") {
      window.focus();
      document.execCommand("insertText", false, msg.text);
      if (msg.key) document.dispatchEvent(new KeyboardEvent("keydown", { key: msg.key, bubbles: true, cancelable: true }));
      return Promise.resolve(true);
    }
    return undefined;
  });
})();
