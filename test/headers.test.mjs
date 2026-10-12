import { test } from "node:test";
import assert from "node:assert/strict";
import { headerPatch, splitAddresses, cleanHeaders, checkHeaders, describeHeaders } from "../src/lib/headers.js";
import { render, fieldsOf } from "../src/lib/template.js";
import { checkSnippet } from "../src/lib/snippets.js";
import { importQuicktext } from "../src/lib/quicktext.js";
import { insertPayload } from "../src/tb/compose.js";

const details = { subject: "Quote 42", to: ["Ann Lee <ann@example.com>"], cc: [], bcc: [], replyTo: [], customHeaders: [{ name: "X-Keep", value: "1" }] };

test("addresses split on commas and semicolons, not inside quotes or <>", () => {
  assert.deepEqual(splitAddresses(`"Lee, Ann" <ann@x.se>, bo@x.se; Cy <c,y@x.se>`), [`"Lee, Ann" <ann@x.se>`, "bo@x.se", "Cy <c,y@x.se>"]);
  assert.deepEqual(splitAddresses(" , "), []);
});

test("recipients: add skips duplicates, replace and remove", () => {
  const p = headerPatch(details, [
    { field: "to", mode: "add", value: "ANN@example.com, boss@x.se" },
    { field: "cc", mode: "add", value: "boss@x.se" },
    { field: "bcc", mode: "replace", value: "archive@x.se" },
    { field: "replyTo", mode: "add", value: "orders@x.se" },
  ]);
  assert.deepEqual(p.to, ["Ann Lee <ann@example.com>", "boss@x.se"]);
  assert.deepEqual(p.cc, ["boss@x.se"]);
  assert.deepEqual(p.bcc, ["archive@x.se"]);
  assert.deepEqual(p.replyTo, ["orders@x.se"]);
  assert.deepEqual(headerPatch(details, [{ field: "to", mode: "remove", value: "ann@example.com" }]).to, []);
  // Contacts referenced by id are kept.
  assert.deepEqual(headerPatch({ to: [{ id: "c1", type: "contact" }] }, [{ field: "to", mode: "add", value: "a@x.se" }]).to, [{ id: "c1", type: "contact" }, "a@x.se"]);
});

test("subject: set, before and after (not twice), fields filled in", () => {
  const fill = (v) => render(v, { values: { PO: "77" } }).text;
  assert.equal(headerPatch(details, [{ field: "subject", mode: "prepend", value: "[PO {{PO}}]" }], fill).subject, "[PO 77] Quote 42");
  assert.equal(headerPatch({ subject: "[PO 77] Quote 42" }, [{ field: "subject", mode: "prepend", value: "[PO 77]" }]).subject, "[PO 77] Quote 42");
  assert.equal(headerPatch(details, [{ field: "subject", mode: "append", value: "(urgent)" }]).subject, "Quote 42 (urgent)");
  assert.equal(headerPatch(details, [{ field: "subject", mode: "replace", value: "New" }, { field: "subject", mode: "append", value: "!" }]).subject, "New !");
});

test("custom X- headers replace their earlier value", () => {
  const p = headerPatch(details, [{ field: "custom", name: "X-Order", mode: "replace", value: "77" }, { field: "custom", name: "x-keep", mode: "replace", value: "2" }]);
  assert.deepEqual(p.customHeaders, [{ name: "X-Order", value: "77" }, { name: "x-keep", value: "2" }]);
  assert.equal(checkHeaders([{ field: "custom", name: "Order", mode: "replace", value: "1" }]).startsWith("Custom header"), true);
  assert.equal(checkHeaders([{ field: "cc", mode: "add", value: " " }]), "Cc: nothing to add");
});

test("header-only snippets, malformed data dropped, fields found, previews", () => {
  const s = { key: "ccboss", body: "", headers: [{ field: "cc", mode: "add", value: "{{BOSS|boss@x.se}}" }, { field: "nope", mode: "add" }] };
  assert.equal(checkSnippet({ key: "x", body: "" }), "The text is empty");
  assert.equal(checkSnippet({ ...s, headers: cleanHeaders(s.headers) }), "");
  assert.deepEqual(cleanHeaders(s.headers), [{ field: "cc", mode: "add", value: "{{BOSS|boss@x.se}}" }]);
  assert.deepEqual(fieldsOf(s).map((f) => f.name), ["BOSS"]);
  assert.deepEqual(describeHeaders(s.headers, (v) => render(v).text), ["Cc: add boss@x.se"]);
});

test("{{attachments}} becomes a live span in HTML messages, plain text otherwise", () => {
  const snippet = { body: "Files: {{attachments|none}} ({{attachments.count}})" };
  const r = render(snippet.body, { context: { attachments: ["a&b.pdf"] }, mark: true });
  const html = insertPayload(snippet, r, false);
  assert.equal(html.before, 'Files: <span data-ts-att="attachments" data-fallback="none">a&amp;b.pdf</span> (<span data-ts-att="attachments.count" data-fallback="">1</span>)');
  assert.equal(insertPayload(snippet, r, true).before, "Files: a&b.pdf (1)");
  assert.equal(render(snippet.body, { context: { attachments: [] } }).text, "Files: none (0)");
});

test("Quicktext subject and [[HEADER=…]] become header changes", () => {
  const xml = `<quicktext><menu><title>W</title><texts><text type="0"><name>Order</name><keyword>ord</keyword>
    <subject><![CDATA[Order [[INPUT=PO]]]]></subject>
    <body><![CDATA[[[HEADER=cc|boss@x.se]]Hi[[HEADER=reply-to|orders@x.se]]]]></body></text></texts></menu></quicktext>`;
  const [s] = importQuicktext(xml).snippets;
  assert.equal(s.body, "Hi");
  assert.deepEqual(s.headers, [
    { field: "subject", mode: "replace", value: "Order {{PO}}" },
    { field: "cc", mode: "add", value: "boss@x.se" },
    { field: "replyTo", mode: "add", value: "orders@x.se" },
  ]);
});
