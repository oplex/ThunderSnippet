/*
 * Import from other snippet tools (pure):
 *   Quicktext's exported templates (XML, "quicktext" root), with its
 *   [[TO=firstname]], [[INPUT=…]], [[CURSOR]] … codes turned into ours;
 *   CSV with the columns key,name,text (TextExpander-style exports).
 */

import { normalizeKey } from "./snippets.js";

const decode = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
// Element text: CDATA is taken as it is, other text has its entities decoded.
function tag(xml, name) {
  const raw = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(xml)?.[1] ?? "";
  const c = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
  return c ? c[1].trim() : decode(raw.trim());
}

const PERSON = { firstname: "first", lastname: "last", fullname: "name", displayname: "name", email: "email" };

// One Quicktext code → our template text. `keyOf(group, name)` finds the key
// of another imported text for [[TEXT=group|name]].
function convertCode(code, keyOf, notes) {
  const [cmd, ...rest] = code.split("=");
  const arg = rest.join("=");
  const parts = arg.split("|");
  switch (cmd.trim().toUpperCase()) {
    case "TO":
    case "FROM": {
      const who = cmd.trim().toUpperCase() === "TO" ? "to" : "me";
      const field = PERSON[parts[0].trim().toLowerCase()];
      if (field) return `{{${who}.${field}}}`;
      break;
    }
    case "SUBJECT":
      return "{{subject}}";
    case "DATE":
      return parts[0].trim().toLowerCase() === "long" ? "{{date:dddd, D MMMM YYYY}}" : "{{date}}";
    case "TIME":
      return "{{time}}";
    case "CURSOR":
      return "{{cursor}}";
    case "INPUT": {
      const label = parts[0].trim() || "TEXT";
      if (parts[1]?.trim().toLowerCase() === "select") return `{{${[label, ...(parts[2] ?? "").split(";").map((x) => x.trim()).filter(Boolean)].join("|")}}}`;
      return parts[2] ? `{{${label}|${parts[2].trim()}}}` : `{{${label}}}`;
    }
    case "TEXT": {
      const key = keyOf(parts[0]?.trim(), parts[1]?.trim());
      if (key) return `{{snip:${key}}}`;
      break;
    }
  }
  notes.add(`[[${cmd.trim().toUpperCase()}]]`);
  return `[[${code}]]`;
}

const slug = (s) => normalizeKey(s).replace(/[^\p{L}\p{N}_.-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "snippet";

// Quicktext XML → { snippets, notes } (notes: codes kept as text).
export function importQuicktext(xml) {
  if (!/<quicktext[\s>]/.test(xml)) throw new Error("This isn't a Quicktext export (no <quicktext> root)");
  const raw = [];
  for (const menu of xml.matchAll(/<menu>([\s\S]*?)<\/menu>/g)) {
    const group = tag(menu[1], "title");
    for (const t of menu[1].matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const name = tag(t[2], "name");
      const keyword = tag(t[2], "keyword");
      const type = /type="(\d)"/.exec(t[1])?.[1];
      raw.push({ group, name, keyword, body: tag(t[2], "body"), html: type === "1", files: tag(t[2], "attachments") });
    }
  }
  const used = new Set();
  const unique = (k) => {
    let key = k;
    for (let i = 2; used.has(key); i++) key = `${k}${i}`;
    used.add(key);
    return key;
  };
  for (const r of raw) r.key = unique(slug(r.keyword || r.name));
  const keyOf = (group, name) => raw.find((r) => r.name === name && (!group || r.group === group))?.key;
  const notes = new Set();
  // Quicktext stores attachments as paths on disk, which add-ons can't read.
  if (raw.some((r) => r.files)) notes.add("attachments (add the files again in the snippet editor)");
  const snippets = raw.map((r) => ({
    key: r.key,
    name: r.name || r.key,
    group: r.group,
    html: r.html,
    body: r.body.replace(/\[\[([^\]]+)\]\]/g, (_, code) => convertCode(code, keyOf, notes)),
  }));
  return { snippets, notes: [...notes] };
}

// Minimal CSV (quotes, "" escapes, newlines inside quotes).
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") row.push(cell), (cell = "");
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell), rows.push(row), (row = []), (cell = "");
    } else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows.filter((r) => r.some((x) => x.trim()));
}

// CSV with a header row naming key/abbreviation, name/label and text/body.
export function importCsv(text) {
  const [head, ...rows] = parseCsv(text);
  const col = (...names) => head.findIndex((h) => names.includes(h.trim().toLowerCase()));
  const k = col("key", "abbreviation", "shortcut", "keyword");
  const n = col("name", "label", "title");
  const b = col("text", "body", "content", "snippet");
  if (k < 0 || b < 0) throw new Error("The CSV needs a header with key and text columns");
  return { snippets: rows.map((r) => ({ key: slug(r[k]), name: (n >= 0 && r[n]) || r[k], body: r[b] ?? "", group: "Imported" })), notes: [] };
}
