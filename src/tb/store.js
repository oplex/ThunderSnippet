// ThunderSnippet's storage (storage.local): snippets, settings and the last
// values typed into each field.

import { normalizeKey, PRESETS } from "../lib/snippets.js";
import { storeFile, removeFiles, fromBase64 } from "./files.js";
import { cleanHeaders } from "../lib/headers.js";

export const DEFAULT_SETTINGS = {
  expandKey: "Tab", // "Tab", "Space" or "off": expands an abbreviation typed in a message
  rememberValues: true, // prefill fields with what was typed last time
  closeOnBlur: true,
};

async function get(key, fallback) {
  return (await browser.storage.local.get(key))[key] ?? fallback;
}
const set = (key, value) => browser.storage.local.set({ [key]: value });

export const getSnippets = () => get("snippets", []);
export const saveSnippets = (list) => set("snippets", list.map((s) => ({ ...s, key: normalizeKey(s.key) })));

export async function getSnippet(key) {
  return (await getSnippets()).find((s) => s.key === normalizeKey(key)) ?? null;
}

// Add or replace (by `oldKey`, or by its own key).
export async function putSnippet(snippet, oldKey = snippet.key) {
  const list = (await getSnippets()).filter((s) => s.key !== normalizeKey(oldKey) && s.key !== normalizeKey(snippet.key));
  list.push({ key: normalizeKey(snippet.key), name: snippet.name || snippet.key, body: snippet.body, html: !!snippet.html, group: snippet.group ?? "", files: snippet.files ?? [], headers: cleanHeaders(snippet.headers) });
  list.sort((a, b) => a.key.localeCompare(b.key));
  await saveSnippets(list);
}

export async function deleteSnippet(key) {
  const all = await getSnippets();
  const gone = all.find((s) => s.key === normalizeKey(key));
  await saveSnippets(all.filter((s) => s !== gone));
  await removeFiles((gone?.files ?? []).map((f) => f.id));
}

// Imported files carry their data (base64); store it and keep the metadata.
async function storeImportedFiles(files = []) {
  const out = [];
  for (const f of files) out.push(f.data ? await storeFile(f.name, f.type, fromBase64(f.data)) : f);
  return out;
}

// Adds snippets, renaming keys that are taken ("po1" → "po1-2"). Returns the count.
export async function addSnippets(incoming) {
  const list = await getSnippets();
  const taken = new Set(list.map((s) => s.key));
  for (const s of incoming) {
    let key = normalizeKey(s.key);
    for (let i = 2; taken.has(key); i++) key = `${normalizeKey(s.key)}-${i}`;
    taken.add(key);
    list.push({ key, name: s.name || key, body: s.body, html: !!s.html, group: s.group ?? "", files: await storeImportedFiles(s.files), headers: cleanHeaders(s.headers) });
  }
  await saveSnippets(list.sort((a, b) => a.key.localeCompare(b.key)));
  return incoming.length;
}

// First run: the examples.
export async function seedPresets() {
  if ((await browser.storage.local.get("snippets")).snippets) return false;
  await saveSnippets(PRESETS);
  return true;
}

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(await get("settings", {})) };
}
export async function saveSettings(patch) {
  await set("settings", { ...(await getSettings()), ...patch });
}

export const getLastValues = () => get("lastValues", {});
export async function rememberValues(values) {
  if (!(await getSettings()).rememberValues) return;
  await set("lastValues", { ...(await getLastValues()), ...values });
}
