// ThunderSnippet's export file, and reading any supported import (pure).

import { importQuicktext, importCsv } from "./quicktext.js";
import { normalizeKey } from "./snippets.js";

export const EXPORT_APP = "ThunderSnippet";

export function buildExport(snippets, settings, now = new Date()) {
  return { app: EXPORT_APP, format: 1, exported: now.toISOString(), snippets, settings };
}

const clean = (s) => ({ key: normalizeKey(s.key), name: String(s.name ?? s.key), body: String(s.body ?? ""), html: !!s.html, group: String(s.group ?? "") });

// Any supported file → { kind, snippets, settings?, notes }.
//   ThunderSnippet export (.json), a JSON array of snippets, Quicktext
//   templates (.xml) or CSV (key,name,text).
export function readImport(text, fileName = "") {
  const t = text.replace(/^﻿/, "").trim();
  if (t.startsWith("<")) return { kind: "Quicktext", ...importQuicktext(t) };
  if (t.startsWith("{") || t.startsWith("[")) {
    const data = JSON.parse(t);
    const list = Array.isArray(data) ? data : data.snippets;
    if (!Array.isArray(list)) throw new Error("No snippets found in this JSON file");
    return { kind: data.app === EXPORT_APP ? "ThunderSnippet" : "JSON", snippets: list.filter((s) => s?.key && s?.body).map(clean), settings: data.settings ?? null, notes: [] };
  }
  if (/\.csv$/i.test(fileName) || t.includes(",")) return { kind: "CSV", ...importCsv(t) };
  throw new Error("Unknown file: use a ThunderSnippet export, Quicktext templates (.xml) or CSV");
}
