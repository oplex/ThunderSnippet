import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSnippet, rankSnippets, textToHtml, preview, PRESETS } from "../src/lib/snippets.js";
import { insertPayload } from "../src/tb/compose.js";
import { render } from "../src/lib/template.js";

test("keys must be short words", () => {
  assert.equal(checkSnippet({ key: "po1", body: "x" }), "");
  assert.match(checkSnippet({ key: "po 1", body: "x" }), /no spaces/);
  assert.match(checkSnippet({ key: "po1", body: " " }), /empty/);
  assert.match(checkSnippet({ key: "PO1", body: "x" }, [{ key: "po1" }]), /already uses/);
});

test("search: exact key first, then key/name/text matches", () => {
  const ranked = rankSnippets(PRESETS, "po1").map((r) => r.snippet.key);
  assert.equal(ranked[0], "po1");
  assert.equal(rankSnippets(PRESETS, "follow")[0].snippet.key, "fu");
  assert.equal(rankSnippets(PRESETS, "zzzz").length, 0);
  assert.equal(rankSnippets(PRESETS, "").length, PRESETS.length);
});

test("plain text becomes safe HTML; HTML snippets turn into text for plain messages", () => {
  assert.equal(textToHtml("a < b\nc"), "a &lt; b<br>c");
  const plain = { key: "x", body: "Hi {{cursor}}there\nBye" };
  assert.deepEqual(insertPayload(plain, render(plain.body), false), { plain: false, before: "Hi ", after: "there<br>Bye" });
  const html = { key: "y", html: true, body: "<b>Hi</b><br>you &amp; me" };
  assert.deepEqual(insertPayload(html, render(html.body), true), { plain: true, before: "Hi\nyou & me", after: "" });
  assert.equal(preview({ body: "a\n\n b" }), "a b");
});
