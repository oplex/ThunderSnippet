// Settings page: the snippet list and the editor (with a live preview).

import { getSnippets, putSnippet, deleteSnippet } from "../tb/store.js";
import { checkSnippet, preview, rankSnippets } from "../lib/snippets.js";
import { fieldsOf, render } from "../lib/template.js";
import { composeContext } from "../lib/context.js";
import { confirmDialog, toast } from "../kit/dialog.js";

const $ = (id) => document.getElementById(id);
const SAMPLE = composeContext({ to: ["Ann Lee <ann@example.com>"], from: "You <you@example.com>", subject: "Quote 42" });
let editing = null; // key being edited, or "" for a new snippet

function cell(text, className) {
  const td = document.createElement("td");
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function button(text, onClick, className = "") {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = className;
  b.addEventListener("click", onClick);
  return b;
}

export async function renderList() {
  const all = await getSnippets();
  const shown = rankSnippets(all, $("filter").value, 1000).map((r) => r.snippet);
  const tbody = $("snippets");
  tbody.replaceChildren();
  if (!shown.length) {
    const tr = document.createElement("tr");
    const td = cell(all.length ? "No snippet matches." : "No snippets yet.", "dim");
    td.colSpan = 4;
    tr.append(td);
    tbody.append(tr);
  }
  for (const s of shown) {
    const tr = document.createElement("tr");
    tr.dataset.key = s.key;
    const actions = cell("", "actions");
    actions.append(
      button("Edit", () => openEditor(s)),
      button("Delete", async () => {
        if (await confirmDialog(`Delete “${s.key}”?`, s.name, { ok: "Delete" })) await deleteSnippet(s.key);
      }),
    );
    tr.append(cell(s.key, "key"), cell(s.name), cell(preview(s, 60), "text"), actions);
    tbody.append(tr);
  }
}

async function updatePreview() {
  const snippets = await getSnippets();
  const body = $("eBody").value;
  const r = render(body, { context: SAMPLE, values: {}, snippets });
  $("ePreview").textContent = $("eHtml").checked ? r.text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "") : r.text;
  const fields = fieldsOf(body, snippets).map((f) => f.name);
  $("eFields").textContent = fields.length ? `asks for: ${fields.join(", ")}` : "inserted right away (no fields)";
}

export function openEditor(s = null) {
  editing = s ? s.key : "";
  $("editor").hidden = false;
  $("editorTitle").textContent = s ? `Edit “${s.key}”` : "New snippet";
  $("eKey").value = s?.key ?? "";
  $("eName").value = s?.name ?? "";
  $("eGroup").value = s?.group ?? "";
  $("eBody").value = s?.body ?? "";
  $("eHtml").checked = !!s?.html;
  $("eStatus").textContent = "";
  updatePreview();
  $("editor").scrollIntoView({ block: "nearest" });
  (s ? $("eBody") : $("eKey")).focus();
}

async function save() {
  const snippet = { key: $("eKey").value, name: $("eName").value, group: $("eGroup").value, body: $("eBody").value, html: $("eHtml").checked };
  const others = (await getSnippets()).filter((o) => o.key !== editing);
  const error = checkSnippet(snippet, others);
  if (error) {
    $("eStatus").textContent = error;
    $("eStatus").className = "error";
    return;
  }
  await putSnippet(snippet, editing || snippet.key);
  $("editor").hidden = true;
  editing = null;
  toast(`Saved “${snippet.key.trim().toLowerCase()}”`);
}

export function initEditor() {
  for (const id of ["eBody", "eHtml"]) $(id).addEventListener("input", updatePreview);
  $("eSave").addEventListener("click", save);
  $("eCancel").addEventListener("click", () => {
    $("editor").hidden = true;
    editing = null;
  });
  $("newSnippet").addEventListener("click", () => openEditor());
  $("filter").addEventListener("input", renderList);
  browser.storage.onChanged.addListener((changes) => {
    if (changes.snippets) renderList();
  });
  if (location.hash === "#new") openEditor();
  return renderList();
}
