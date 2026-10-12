// ThunderSnippet settings page.

import { getSettings, saveSettings } from "../tb/store.js";
import { initEditor } from "./editor-ui.js";
import { initImport } from "./import-ui.js";
import { renderKeyboard, setKeyboardLabels } from "../kit/keyboard-ui.js";
import { discoverSuite } from "../kit/suite.js";

const $ = (id) => document.getElementById(id);

setKeyboardLabels({
  "open-snippets": "Open the snippet palette (in a message you're writing)",
  _execute_compose_action: "Snippet button in the compose window",
});

async function initSettings() {
  const s = await getSettings();
  $("expandKey").value = s.expandKey;
  $("expandKey").addEventListener("change", () => saveSettings({ expandKey: $("expandKey").value }));
  for (const id of ["rememberValues", "closeOnBlur"]) {
    $(id).checked = !!s[id];
    $(id).addEventListener("change", () => saveSettings({ [id]: $(id).checked }));
  }
  const key = (await browser.commands.getAll()).find((c) => c.name === "open-snippets")?.shortcut;
  $("paletteKey").textContent = key || "(no key)";
}

async function showSuite() {
  const others = await discoverSuite();
  if (others.length) $("suite").textContent = `Works together with: ${others.map((o) => `${o.app} ${o.version}`).join(", ")}`;
}

initEditor();
initImport();
initSettings();
renderKeyboard();
showSuite();
