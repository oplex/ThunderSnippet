/*
 * Snippets (pure): { key, name, body, html, group }.
 *   key    what you type before Tab, e.g. "po1" (letters, digits, - _ .)
 *   html   body is HTML (otherwise plain text; line breaks are kept)
 */

import { fold, matchTerm, splitTerms } from "../kit/fuzzy.js";

export const KEY_PATTERN = /^[\p{L}\p{N}_.-]{1,40}$/u;

export function normalizeKey(key) {
  return String(key ?? "").trim().toLowerCase();
}

// Returns an error message, or "" when the snippet can be saved.
export function checkSnippet(s, others = []) {
  const key = normalizeKey(s.key);
  if (!KEY_PATTERN.test(key)) return "The key may only have letters, digits, - _ and . (no spaces), e.g. po1";
  if (!String(s.body ?? "").trim()) return "The text is empty";
  if (others.some((o) => normalizeKey(o.key) === key)) return `Another snippet already uses “${key}”`;
  return "";
}

// Snippets matching a query: key first, then name, then text.
export function rankSnippets(snippets, query, limit = 50) {
  const terms = splitTerms(query ?? "");
  if (!terms.length) return snippets.slice(0, limit).map((s) => ({ snippet: s, score: 0 }));
  const out = [];
  for (const s of snippets) {
    let score = 0;
    for (const term of terms) {
      const k = matchTerm(term, s.key);
      const n = matchTerm(term, s.name ?? "");
      const b = fold(s.body ?? "").includes(fold(term)) ? { score: 1 } : null;
      const best = Math.max(k ? k.score + 40 : -1, n ? n.score + 20 : -1, b ? 1 : -1);
      if (best < 0) {
        score = -1;
        break;
      }
      score += best;
    }
    if (normalizeKey(query) === s.key) score += 1000;
    if (score >= 0) out.push({ snippet: s, score });
  }
  return out.sort((a, b) => b.score - a.score || a.snippet.key.localeCompare(b.snippet.key)).slice(0, limit);
}

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const escapeHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ESC[c]);

// Plain text → HTML for the HTML editor: escaped, line breaks kept.
export function textToHtml(text) {
  return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

// One-line preview of a snippet's text.
export function preview(s, length = 90) {
  const t = (s.html ? String(s.body).replace(/<[^>]+>/g, " ") : String(s.body)).replace(/\s+/g, " ").trim();
  return t.length > length ? `${t.slice(0, length - 1)}…` : t;
}

// Starter snippets, offered on first run (and in the options).
export const PRESETS = [
  {
    key: "po1",
    name: "Purchase order received",
    group: "Examples",
    body: "Hello {{to.first|there}}!\n\nThanks for your quote, here is PO {{PONUMBER}}.\nDelivery to {{ADDRESS|our main office}} by {{DATE}}.\n\nBest regards,\n{{me.name}}",
  },
  { key: "ty", name: "Thank you", group: "Examples", body: "Hi {{to.first|there}},\n\nThank you for your message. {{cursor}}\n\n{{snip:sig}}" },
  { key: "sig", name: "Signature", group: "Examples", body: "Best regards,\n{{me.name}}" },
  { key: "today", name: "Today's date", group: "Examples", body: "{{date:YYYY-MM-DD}}" },
  {
    key: "fu",
    name: "Follow-up",
    group: "Examples",
    body: "{{GREETING|Hi|Hello|Dear}} {{to.first|there}},\n\nI'm following up on “{{subject}}”. {{cursor}}\n\n{{snip:sig}}",
  },
];
