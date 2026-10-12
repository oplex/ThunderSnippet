/*
 * ThunderSnippet's template language (pure, unit tested).
 *
 *   {{PONUMBER}}              a field: asked when the snippet is inserted
 *   {{PONUMBER|12345}}        …with a default
 *   {{GREETING|Hi|Hello}}     …with choices (the first is the default)
 *   {{to.first}} {{to.last}} {{to.name}} {{to.email}}   first recipient
 *   {{me.first}} {{me.name}} {{me.email}}                the sender
 *   {{subject}} {{date}} {{time}} {{date:YYYY-MM-DD}}    (see dates.js)
 *   {{to.first|there}}        built-ins take a fallback for empty values
 *   {{attachments}}           names of the message's attachments ("a.pdf, b.png")
 *   {{attachments.count}}     how many there are
 *   {{snip:sig}}              another snippet, by its key
 *   {{cursor}}                where the caret goes afterwards
 */

import { formatDate, localDate, localTime } from "./dates.js";

const TOKEN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const PEOPLE = /^(to|me)\.(name|first|last|email)$/i;
const MAX_DEPTH = 5;

// One {{…}} token → { kind: builtin|field|snip|cursor, name, options }.
export function parseToken(raw) {
  const [head, ...options] = raw.split("|").map((s) => s.trim());
  const lower = head.toLowerCase();
  if (lower === "cursor") return { kind: "cursor", name: "cursor", options };
  if (lower.startsWith("snip:")) return { kind: "snip", name: head.slice(5).trim().toLowerCase(), options };
  if (PEOPLE.test(head) || ["subject", "date", "time", "attachments", "attachments.count"].includes(lower) || /^(date|time):/i.test(head)) {
    return { kind: "builtin", name: head, options };
  }
  return { kind: "field", name: head, options };
}

const byKey = (snippets, key) => snippets.find((s) => s.key.toLowerCase() === key);

// The fields a snippet asks for (nested snippets included), in order:
// [{ name, default, choices }]. Pass a snippet object to include the fields
// in its file names too.
export function fieldsOf(body, snippets = [], depth = 0, seen = new Map()) {
  if (body && typeof body === "object") {
    fieldsOf(body.body, snippets, depth, seen);
    for (const f of body.files ?? []) fieldsOf(f.name, snippets, depth, seen);
    return [...seen.values()];
  }
  for (const m of String(body).matchAll(TOKEN)) {
    const t = parseToken(m[1]);
    if (t.kind === "field" && !seen.has(t.name)) {
      seen.set(t.name, { name: t.name, default: t.options[0] ?? "", choices: t.options.length > 1 ? t.options : [] });
    } else if (t.kind === "snip" && depth < MAX_DEPTH) {
      const inner = byKey(snippets, t.name);
      if (inner) fieldsOf(inner.body, snippets, depth + 1, seen);
    }
  }
  return [...seen.values()];
}

function builtin(name, context, now) {
  const people = PEOPLE.exec(name);
  if (people) return context?.[people[1].toLowerCase()]?.[people[2].toLowerCase()] ?? "";
  const [kind, format] = name.split(/:(.*)/s);
  if (kind.toLowerCase() === "subject") return context?.subject ?? "";
  if (kind.toLowerCase() === "attachments") return (context?.attachments ?? []).join(", ");
  if (kind.toLowerCase() === "attachments.count") return String((context?.attachments ?? []).length);
  if (format) return formatDate(now, format);
  return kind.toLowerCase() === "date" ? localDate(now) : localTime(now);
}

// Fill in a snippet. Returns { text, cursor } where cursor is the index of
// the first {{cursor}} in text (or null). Unknown snippets in {{snip:…}}
// are left as they are, so mistakes are visible.
export function render(body, { context = {}, values = {}, snippets = [], now = new Date() } = {}, depth = 0) {
  let text = "";
  let cursor = null;
  let last = 0;
  const src = String(body);
  for (const m of src.matchAll(TOKEN)) {
    text += src.slice(last, m.index);
    last = m.index + m[0].length;
    const t = parseToken(m[1]);
    if (t.kind === "cursor") {
      if (cursor == null) cursor = text.length;
    } else if (t.kind === "snip") {
      const inner = depth < MAX_DEPTH ? byKey(snippets, t.name) : null;
      if (!inner) text += m[0];
      else {
        const r = render(inner.body, { context, values, snippets, now }, depth + 1);
        if (cursor == null && r.cursor != null) cursor = text.length + r.cursor;
        text += r.text;
      }
    } else if (t.kind === "builtin") {
      text += builtin(t.name, context, now) || (t.options[0] ?? "");
    } else {
      text += values[t.name] ?? t.options[0] ?? "";
    }
  }
  text += src.slice(last);
  return { text, cursor };
}
