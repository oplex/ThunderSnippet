/*
 * Snippet palette: a spotlight window over a compose window (or the compose
 * toolbar button's popup). Type to find a snippet, Enter to insert it;
 * snippets with fields show a form first.
 */

import { rankSnippets, preview as previewOf } from "../lib/snippets.js";
import { fieldsOf } from "../lib/template.js";
import { composeContext } from "../lib/context.js";
import { getSnippets, getLastValues, getSettings } from "../tb/store.js";
import { showForm } from "./form.js";

const params = new URLSearchParams(location.search);
const mode = params.get("mode") === "window" ? "window" : "popup";
const $ = (id) => document.getElementById(id);
const input = $("input");

const state = { tabId: null, snippets: [], rows: [], selected: 0, context: {}, form: null, snippet: null, windowId: null };

function setStatus(text = "", cls = "") {
  $("status").textContent = text;
  $("status").className = cls;
}

function close() {
  window.close();
  if (mode === "window") browser.windows.remove(state.windowId).catch(() => {});
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function draw() {
  const list = $("list");
  list.replaceChildren();
  if (!state.rows.length) {
    list.append(el("li", "info", state.snippets.length ? `No snippet matches “${input.value}”` : "No snippets yet · click ⚙ to add some"));
  }
  state.rows.forEach((s, i) => {
    const li = el("li", i === state.selected ? "selected" : "");
    li.setAttribute("role", "option");
    const text = el("div", "text");
    text.append(el("div", "title", s.name || s.key), el("div", "sub", previewOf(s)));
    li.append(el("span", "icon", fieldsOf(s.body, state.snippets).length ? "✎" : "❝"), text, el("span", "badge", s.key));
    li.addEventListener("mousedown", (ev) => ev.preventDefault());
    li.addEventListener("click", () => choose(s));
    list.append(li);
  });
  list.children[state.selected]?.scrollIntoView({ block: "nearest" });
}

function refresh() {
  state.rows = rankSnippets(state.snippets, input.value).map((r) => r.snippet);
  state.selected = 0;
  draw();
}

async function insert(snippet, values = {}) {
  if (state.tabId == null) return setStatus("Open a message you're writing to insert snippets", "error");
  try {
    await browser.runtime.sendMessage({ type: "ts-insert-snippet", tabId: state.tabId, key: snippet.key, values, windowId: state.windowId });
    close();
  } catch (e) {
    setStatus(e?.message ?? String(e), "error");
  }
}

// Enter on a snippet: insert, or show its form.
async function choose(snippet) {
  if (!fieldsOf(snippet.body, state.snippets).length) return insert(snippet);
  state.snippet = snippet;
  $("list").hidden = true;
  $("form").hidden = false;
  $("preview").hidden = false;
  $("mode").hidden = false;
  $("mode").textContent = `${snippet.key} ›`;
  input.value = snippet.name || snippet.key;
  input.readOnly = true;
  $("hints").textContent = "↵ insert · Tab next field · Esc back";
  state.form = showForm($("form"), $("preview"), snippet, {
    snippets: state.snippets,
    context: state.context,
    lastValues: (await getSettings()).rememberValues ? await getLastValues() : {},
    onSubmit: () => insert(snippet, state.form.values()),
  });
  state.form.focus();
}

function backToList() {
  if (params.get("typed")) return close(); // inline expansion: closing puts the key back
  state.snippet = state.form = null;
  $("list").hidden = false;
  $("form").hidden = $("preview").hidden = $("mode").hidden = true;
  input.readOnly = false;
  input.value = "";
  $("hints").textContent = "↵ insert · ↑↓ choose · Esc close · ⚙ edit snippets";
  input.focus();
  refresh();
}

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    ev.preventDefault();
    return state.form ? backToList() : close();
  }
  if (state.form) return;
  if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
    ev.preventDefault();
    const n = state.rows.length;
    if (n) state.selected = (state.selected + (ev.key === "ArrowDown" ? 1 : -1) + n) % n;
    draw();
  } else if (ev.key === "Enter") {
    ev.preventDefault();
    if (state.rows[state.selected]) choose(state.rows[state.selected]);
  }
});

async function findTab() {
  const fromParam = params.get("tab");
  if (fromParam) return Number(fromParam);
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.type === "messageCompose" ? tab.id : null;
}

async function init() {
  document.body.classList.add(mode);
  input.focus();
  state.windowId = (await browser.windows.getCurrent()).id;
  state.tabId = await findTab();
  state.snippets = await getSnippets();
  if (state.tabId != null) state.context = composeContext(await browser.compose.getComposeDetails(state.tabId).catch(() => ({})));
  else ($("banner").hidden = false), ($("banner").textContent = "No message is being written · you can browse and edit snippets");
  input.addEventListener("input", refresh);
  $("openOptions").addEventListener("click", () => browser.runtime.openOptionsPage().then(close));
  const settings = await getSettings();
  if (mode === "window" && settings.closeOnBlur) window.addEventListener("blur", () => !state.form && close());
  refresh();
  const key = params.get("key");
  const preset = key && state.snippets.find((s) => s.key === key);
  if (preset) choose(preset);
}

init().catch((e) => setStatus(e?.message ?? String(e), "error"));
