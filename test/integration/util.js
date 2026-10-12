// Shared helpers for the in-Thunderbird self-test.

import { REPORT_URL } from "./config.js";

export const results = [];
export const post = (msg) => fetch(REPORT_URL, { method: "POST", body: JSON.stringify(msg) }).catch(() => {});
export const log = (text) => post({ type: "log", text });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(fn, what, ms = 30000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
    await sleep(200);
  }
}

export async function check(name, fn) {
  log(`- ${name}`);
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (e) {
    log(`  failed: ${e}`);
    results.push({ name, ok: false, error: String(e?.stack ?? e) });
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Open a compose window and wait until ThunderSnippet's compose script runs.
export async function compose(details = {}) {
  const tab = await browser.compose.beginNew({ to: ["Ann Lee <ann@example.com>"], subject: "Quote 42", ...details });
  await waitFor(() => browser.tabs.sendMessage(tab.id, { type: "ts-ping" }).catch(() => false), "the compose script");
  return tab;
}

// Type text in the message (then optionally a key such as Tab).
export const typeIn = (tab, text, key = "") => browser.tabs.sendMessage(tab.id, { type: "ts-type", text, key });

// The message text so far (HTML tags stripped).
export async function bodyText(tab) {
  const d = await browser.compose.getComposeDetails(tab.id);
  return d.isPlainText ? d.plainTextBody : d.body.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}

export async function closeCompose(tab) {
  await browser.windows.remove(tab.windowId).catch(() => {});
}

// The palette window's page, once it shows `ready(doc)`.
export async function paletteView(ready = (doc) => doc.querySelector(".tk-list li, .tk-form input")) {
  return waitFor(() => browser.extension.getViews().find((v) => v.location.pathname.endsWith("palette.html") && ready(v.document)), "the snippet palette");
}

export function key(view, k, target = view.document.activeElement ?? view.document.body) {
  target.dispatchEvent(new view.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
}
