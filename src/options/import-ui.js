// Settings page: import (ThunderSnippet, Quicktext, CSV) and export.

import { getSnippets, getSettings, addSnippets } from "../tb/store.js";
import { buildExport, readImport } from "../lib/backup.js";
import { PRESETS } from "../lib/snippets.js";
import { confirmDialog } from "../kit/dialog.js";

const $ = (id) => document.getElementById(id);

function say(text, cls = "ok") {
  $("importStatus").textContent = text;
  $("importStatus").className = cls;
}

// Import a file's text; returns the message shown (also used by the tests).
export async function importText(text, fileName = "") {
  const r = readImport(text, fileName);
  if (!r.snippets.length) throw new Error(`No snippets found in this ${r.kind} file`);
  const n = await addSnippets(r.snippets);
  const kept = r.notes.length ? ` · kept as text (no equivalent): ${r.notes.join(", ")}` : "";
  return `Imported ${n} snippet${n === 1 ? "" : "s"} from ${r.kind}${kept}`;
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function initImport() {
  $("importFile").addEventListener("change", async (ev) => {
    const file = ev.target.files[0];
    ev.target.value = "";
    if (!file) return;
    try {
      say(await importText(await file.text(), file.name));
    } catch (e) {
      say(e?.message ?? String(e), "error");
    }
  });
  $("exportFile").addEventListener("click", async () => {
    const data = buildExport(await getSnippets(), await getSettings());
    download(`thundersnippet-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
    say(`Exported ${data.snippets.length} snippets`);
  });
  $("addPresets").addEventListener("click", async () => {
    if (!(await confirmDialog("Add the example snippets?", PRESETS.map((p) => `${p.key} – ${p.name}`).join("\n"), { ok: "Add" }))) return;
    const have = new Set((await getSnippets()).map((s) => s.key));
    const n = await addSnippets(PRESETS.filter((p) => !have.has(p.key)));
    say(n ? `Added ${n} example snippets` : "The examples are already there");
  });
}
