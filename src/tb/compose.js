/*
 * Compose windows: the compose script that does inline expansion and inserts
 * text at the caret, and filling in a snippet for a compose tab.
 *   Thunderbird 140+ (Manifest V3): scripting.compose.registerScripts
 *   Thunderbird 91–139 (Manifest V2): composeScripts.register
 */

import { render } from "../lib/template.js";
import { composeContext } from "../lib/context.js";
import { textToHtml } from "../lib/snippets.js";
import { getSnippets } from "./store.js";
import { fileBytes } from "./files.js";

const SCRIPT = "src/compose/editor.js";

export async function registerComposeScript() {
  if (browser.scripting?.compose) {
    const id = "ts-editor";
    const have = await browser.scripting.compose.getRegisteredScripts({ ids: [id] }).catch(() => []);
    if (!have.length) await browser.scripting.compose.registerScripts([{ id, js: [SCRIPT] }]);
    return;
  }
  await browser.composeScripts.register({ js: [{ file: `/${SCRIPT}` }] });
}

// The compose tab in `windowId`, or the active one in the last focused window.
export async function findComposeTab(windowId) {
  const query = windowId != null ? { windowId, active: true } : { active: true, lastFocusedWindow: true };
  const [tab] = await browser.tabs.query(query);
  if (tab?.type === "messageCompose") return tab;
  const compose = await browser.tabs.query({ type: "messageCompose" }).catch(() => []);
  return compose.length === 1 ? compose[0] : null;
}

export async function contextFor(tabId) {
  return composeContext(await browser.compose.getComposeDetails(tabId));
}

const stripHtml = (html) => html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// What the compose script inserts: { plain, before, after } (HTML unless
// plain), with the caret placed between before and after.
export function insertPayload(snippet, rendered, plain) {
  const { text, cursor } = rendered;
  const at = cursor ?? text.length;
  const parts = [text.slice(0, at), text.slice(at)];
  if (plain) return { plain, before: snippet.html ? stripHtml(parts[0]) : parts[0], after: snippet.html ? stripHtml(parts[1]) : parts[1] };
  return { plain, before: snippet.html ? parts[0] : textToHtml(parts[0]), after: snippet.html ? parts[1] : textToHtml(parts[1]) };
}

// Attach the snippet's files, their names filled in like the text.
async function attachFiles(tabId, snippet, values, context) {
  for (const f of snippet.files ?? []) {
    const name = render(f.name, { context, values }).text.trim() || "attachment";
    await browser.compose.addAttachment(tabId, { file: new File([await fileBytes(f.id)], name, { type: f.type }) });
  }
}

// Fill in `snippet` with `values` for compose tab `tabId` and insert it:
// files first, so {{attachments}} lists them too.
export async function insertSnippet(tabId, snippet, values = {}) {
  const [details, snippets] = await Promise.all([browser.compose.getComposeDetails(tabId), getSnippets()]);
  const context = composeContext(details);
  await attachFiles(tabId, snippet, values, context);
  context.attachments = (await browser.compose.listAttachments(tabId).catch(() => [])).map((a) => a.name);
  const rendered = render(snippet.body, { context, values, snippets });
  const tab = await browser.tabs.get(tabId);
  await browser.windows.update(tab.windowId, { focused: true }).catch(() => {});
  await browser.tabs.sendMessage(tabId, { type: "ts-insert", ...insertPayload(snippet, rendered, !!details.isPlainText) });
  return rendered.text;
}

// Put typed text back (an inline expansion that was cancelled).
export async function insertText(tabId, text) {
  const details = await browser.compose.getComposeDetails(tabId);
  await browser.tabs.sendMessage(tabId, { type: "ts-insert", plain: !!details.isPlainText, before: details.isPlainText ? text : textToHtml(text), after: "" });
}
