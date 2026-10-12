import { test } from "node:test";
import assert from "node:assert/strict";
import { render, fieldsOf, parseToken } from "../src/lib/template.js";
import { formatDate } from "../src/lib/dates.js";
import { person, composeContext } from "../src/lib/context.js";

const now = new Date(2026, 2, 7, 14, 5, 9);
const context = composeContext({ to: ["Ann Lee <ann@example.com>"], from: "Pat Sender <pat@example.com>", subject: "Quote 42" });
const snippets = [
  { key: "sig", body: "Best,\n{{me.first}}" },
  { key: "addr", body: "{{STREET|Main St 1}}, {{CITY}}" },
];

test("the po1 example: fields, recipient, sender", () => {
  const body = "Hello {{to.first}}! Thanks for your quote, here is PO {{PONUMBER}}.\n{{snip:sig}}";
  assert.deepEqual(fieldsOf(body, snippets).map((f) => f.name), ["PONUMBER"]);
  const r = render(body, { context, values: { PONUMBER: "4711" }, snippets, now });
  assert.equal(r.text, "Hello Ann! Thanks for your quote, here is PO 4711.\nBest,\nPat");
  assert.equal(r.cursor, null);
});

test("defaults, choices, fallbacks and fields from nested snippets", () => {
  const body = "{{GREETING|Hi|Hello}} {{to.first|there}} {{snip:addr}}";
  const fields = fieldsOf(body, snippets);
  assert.deepEqual(fields, [
    { name: "GREETING", default: "Hi", choices: ["Hi", "Hello"] },
    { name: "STREET", default: "Main St 1", choices: [] },
    { name: "CITY", default: "", choices: [] },
  ]);
  const r = render(body, { context: {}, values: { CITY: "Oslo" }, snippets, now });
  assert.equal(r.text, "Hi there Main St 1, Oslo");
});

test("dates, time, subject, cursor and unknown snippets", () => {
  const r = render("{{date:YYYY-MM-DD}} {{date:dddd D MMMM}} {{subject}}: {{cursor}}x {{snip:nope}}", { context, now });
  assert.equal(r.text, "2026-03-07 Saturday 7 March Quote 42: x {{snip:nope}}");
  assert.equal(r.cursor, "2026-03-07 Saturday 7 March Quote 42: ".length);
  assert.equal(formatDate(now, "HH:mm:ss YY M/D"), "14:05:09 26 3/7");
});

test("snippets that include themselves stop instead of looping", () => {
  const loop = [{ key: "a", body: "x{{snip:a}}" }];
  assert.equal(render("{{snip:a}}", { snippets: loop }).text.startsWith("xxxxx"), true);
  assert.equal(parseToken(" to.First | x ").kind, "builtin");
});

test("people from addresses", () => {
  assert.deepEqual(person("Ann Lee <ann@example.com>"), { name: "Ann Lee", first: "Ann", last: "Lee", email: "ann@example.com" });
  assert.deepEqual(person('"Lee, Ann" <ann@example.com>'), { name: "Ann Lee", first: "Ann", last: "Lee", email: "ann@example.com" });
  assert.deepEqual(person("john.smith@x.org"), { name: "John Smith", first: "John", last: "Smith", email: "john.smith@x.org" });
  assert.equal(person("").first, "");
});
