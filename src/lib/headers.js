/*
 * Header actions of a snippet (pure, unit tested): what inserting it does to
 * the message's subject, recipients and custom headers.
 *
 *   { field: "subject", mode: "replace" | "prepend" | "append", value }
 *   { field: "to" | "cc" | "bcc" | "replyTo", mode: "add" | "replace" | "remove", value }
 *   { field: "custom", name: "X-Order", mode: "replace", value }
 *
 * Values may use fields and built-ins like the text ({{PONUMBER}}, {{to.email}});
 * several addresses are separated by commas or semicolons.
 */

import { person } from "./context.js";

export const ADDRESS_FIELDS = ["to", "cc", "bcc", "replyTo"];
export const FIELD_LABELS = { subject: "Subject", to: "To", cc: "Cc", bcc: "Bcc", replyTo: "Reply-To", custom: "Header" };
export const MODES = {
  subject: { replace: "set to", prepend: "add before", append: "add after" },
  address: { add: "add", replace: "replace with", remove: "remove" },
  custom: { replace: "set to" },
};
export const CUSTOM_NAME = /^X-[A-Za-z0-9-]+$/;

export const modesFor = (field) => MODES[field === "subject" || field === "custom" ? field : "address"];

// Drop anything malformed (imports, old data); keeps the order.
export function cleanHeaders(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((h) => h && FIELD_LABELS[h.field] && modesFor(h.field)[h.mode])
    .map((h) => ({ field: h.field, mode: h.mode, value: String(h.value ?? ""), ...(h.field === "custom" ? { name: String(h.name ?? "").trim() } : {}) }));
}

// The first problem with a snippet's header actions, or "".
export function checkHeaders(list = []) {
  for (const h of list) {
    if (h.field === "custom" && !CUSTOM_NAME.test(h.name ?? "")) return "Custom header names start with X- and use letters, digits and -, e.g. X-Order";
    if (h.mode !== "replace" && !String(h.value ?? "").trim()) return `${FIELD_LABELS[h.field]}: nothing to ${modesFor(h.field)[h.mode]}`;
  }
  return "";
}

// "Ann <a@x.se>, "Lee, Bo" <b@x.se>; c@x.se" → three addresses.
export function splitAddresses(text) {
  const out = [];
  let cur = "";
  let quoted = false;
  let angle = false;
  for (const ch of String(text ?? "")) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "<" && !quoted) angle = true;
    else if (ch === ">" && !quoted) angle = false;
    if ((ch === "," || ch === ";") && !quoted && !angle) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

// Compose details keep contacts as strings or { id, type } references.
const emailOf = (entry) => (typeof entry === "string" ? person(entry).email.toLowerCase() : null);

function changeAddresses(current, mode, value) {
  const list = Array.isArray(current) ? current : current ? [current] : [];
  const given = splitAddresses(value);
  if (mode === "replace") return given;
  const emails = new Set(given.map(emailOf));
  if (mode === "remove") return list.filter((e) => !emails.has(emailOf(e)));
  const have = new Set(list.map(emailOf));
  return [...list, ...given.filter((a) => !have.has(emailOf(a)) && have.add(emailOf(a)))];
}

function changeSubject(subject, mode, value) {
  if (mode === "replace") return value;
  if (!value) return subject;
  if (mode === "prepend") return subject.startsWith(value) ? subject : `${value} ${subject}`.trim();
  return subject.endsWith(value) ? subject : `${subject} ${value}`.trim();
}

// The compose.setComposeDetails() patch for `actions` on a message with
// `details`; fill(value) renders a value's fields. Only changed parts are set.
export function headerPatch(details, actions, fill = (v) => v) {
  const patch = {};
  const now = (key, fallback) => (key in patch ? patch[key] : (details?.[key] ?? fallback));
  for (const h of cleanHeaders(actions)) {
    const value = String(fill(h.value) ?? "").trim();
    if (h.field === "subject") patch.subject = changeSubject(now("subject", ""), h.mode, value);
    else if (h.field === "custom") {
      const rest = now("customHeaders", []).filter((x) => x.name.toLowerCase() !== h.name.toLowerCase());
      patch.customHeaders = value ? [...rest, { name: h.name, value }] : rest;
    } else patch[h.field] = changeAddresses(now(h.field, []), h.mode, value);
  }
  return patch;
}

// One line per action for previews: "To: add boss@x.se".
export function describeHeaders(actions, fill = (v) => v) {
  return cleanHeaders(actions).map((h) => {
    const label = h.field === "custom" ? h.name : FIELD_LABELS[h.field];
    return `${label}: ${modesFor(h.field)[h.mode]} ${String(fill(h.value) ?? "").trim() || "(empty)"}`;
  });
}
