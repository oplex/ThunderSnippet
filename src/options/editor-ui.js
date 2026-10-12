// Settings page: the snippet list and the editor (with a live preview).

import { getSnippets, putSnippet, deleteSnippet } from "../tb/store.js";
import { checkSnippet, preview, rankSnippets } from "../lib/snippets.js";
import { fieldsOf, render } from "../lib/template.js";
import { composeContext } from "../lib/context.js";
import { confirmDialog, toast } from "../kit/dialog.js";
import { storeFile, removeFiles } from "../tb/files.js";
import { describeHeaders } from "../lib/headers.js";
import { drawHeaders, newHeader } from "./headers-ui.js";

const $ = (id) => document.getElementById(id);
const SAMPLE = composeContext({ to: ["Ann Lee <ann@example.com>"], from: "You <you@example.com>", subject: "Quote 42" });
let editing = null; // key being edited, or "" for a new snippet
let files = []; // the edited snippet's files: { id, name, type, size }
let added = []; // ids added while editing (removed again on Cancel)
let removed = []; // ids to delete on Save
let headers = []; // the edited snippet's header changes

const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function drawFiles() {
  const ul = $("eFiles");
  ul.replaceChildren(
    ...files.map((f, i) => {
      const li = document.createElement("li");
      const name = Object.assign(document.createElement("input"), { type: "text", value: f.name, title: "File name (fields allowed)" });
      name.addEventListener("input", () => {
        files[i] = { ...f, name: name.value };
        updatePreview();
      });
      const size = Object.assign(document.createElement("span"), { className: "size", textContent: kb(f.size) });
      li.append("📎", name, size, button("Remove", () => {
        removed.push(f.id);
        files.splice(i, 1);
        drawFiles();
        updatePreview();
      }));
      return li;
    }),
  );
}

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
  // Fields show their default, or [NAME] where something will be typed.
  const all = fieldsOf({ body, files, headers }, snippets);
  const values = Object.fromEntries(all.map((f) => [f.name, f.default || `[${f.name}]`]));
  const names = files.map((f) => render(f.name, { context: SAMPLE, values }).text);
  const r = render(body, { context: { ...SAMPLE, attachments: names }, values, snippets });
  const text = $("eHtml").checked ? r.text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "") : r.text;
  const changes = describeHeaders(headers, (v) => render(v, { context: SAMPLE, values, snippets }).text);
  $("ePreview").textContent =
    (changes.length ? `${changes.join("\n")}\n\n` : "") + text + (names.length ? `\n\n${names.map((n) => `📎 ${n}`).join("\n")}` : "");
  const fields = all.map((f) => f.name);
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
  files = [...(s?.files ?? [])];
  added = [];
  removed = [];
  headers = structuredClone(s?.headers ?? []);
  drawFiles();
  drawHeaders($("eHeaders"), headers, updatePreview);
  updatePreview();
  $("editor").scrollIntoView({ block: "nearest" });
  (s ? $("eBody") : $("eKey")).focus();
}

async function save() {
  const snippet = { key: $("eKey").value, name: $("eName").value, group: $("eGroup").value, body: $("eBody").value, html: $("eHtml").checked, files, headers };
  const others = (await getSnippets()).filter((o) => o.key !== editing);
  const error = checkSnippet(snippet, others);
  if (error) {
    $("eStatus").textContent = error;
    $("eStatus").className = "error";
    return;
  }
  await putSnippet(snippet, editing || snippet.key);
  await removeFiles(removed);
  added = removed = [];
  $("editor").hidden = true;
  editing = null;
  toast(`Saved “${snippet.key.trim().toLowerCase()}”`);
}

export function initEditor() {
  for (const id of ["eBody", "eHtml"]) $(id).addEventListener("input", updatePreview);
  $("eSave").addEventListener("click", save);
  $("eCancel").addEventListener("click", async () => {
    await removeFiles(added);
    added = [];
    $("editor").hidden = true;
    editing = null;
  });
  $("eAddFiles").addEventListener("change", async (ev) => {
    for (const file of ev.target.files) {
      const meta = await storeFile(file.name, file.type, new Uint8Array(await file.arrayBuffer()));
      files.push(meta);
      added.push(meta.id);
    }
    ev.target.value = "";
    drawFiles();
    updatePreview();
  });
  $("eAddHeader").addEventListener("click", () => {
    headers.push(newHeader());
    drawHeaders($("eHeaders"), headers, updatePreview);
    updatePreview();
    $("eHeaders").lastElementChild?.querySelector("input:not([hidden])")?.focus();
  });
  $("newSnippet").addEventListener("click", () => openEditor());
  $("filter").addEventListener("input", renderList);
  browser.storage.onChanged.addListener((changes) => {
    if (changes.snippets) renderList();
  });
  if (location.hash === "#new") openEditor();
  return renderList();
}
