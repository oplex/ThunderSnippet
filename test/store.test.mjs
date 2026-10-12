import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { makeFakeBrowser } from "./helpers/fake-browser.mjs";

let fake;
beforeEach(() => {
  fake = makeFakeBrowser();
  globalThis.browser = fake.browser;
});
const store = await import("../src/tb/store.js");
const { insertSnippet } = await import("../src/tb/compose.js");

test("presets on first run only; put, rename, delete", async () => {
  assert.equal(await store.seedPresets(), true);
  assert.ok((await store.getSnippet("PO1")).body.includes("{{PONUMBER}}"));
  await store.saveSnippets([]);
  assert.equal(await store.seedPresets(), false, "an emptied list stays empty");
  await store.putSnippet({ key: "A1", body: "x" });
  await store.putSnippet({ key: "b1", body: "y" }, "a1");
  assert.deepEqual((await store.getSnippets()).map((s) => s.key), ["b1"]);
  await store.deleteSnippet("B1");
  assert.deepEqual(await store.getSnippets(), []);
});

test("imports never overwrite: taken keys get a number", async () => {
  await store.putSnippet({ key: "po1", body: "mine" });
  await store.addSnippets([{ key: "po1", body: "theirs" }, { key: "po1", body: "again" }]);
  assert.deepEqual((await store.getSnippets()).map((s) => [s.key, s.body]), [["po1", "mine"], ["po1-2", "theirs"], ["po1-3", "again"]]);
});

test("insertSnippet fills in the compose context and sends HTML with the caret", async () => {
  await store.saveSnippets([{ key: "sig", body: "– {{me.first}}" }]);
  const text = await insertSnippet(7, { key: "po1", body: "Hi {{to.first}}, PO {{PO}}{{cursor}}\n{{snip:sig}}" }, { PO: "12" });
  assert.equal(text, "Hi Ann, PO 12\n– Pat");
  assert.deepEqual(fake.sent, [[7, { type: "ts-insert", plain: false, before: "Hi Ann, PO 12", after: "<br>– Pat" }]]);
});

test("remembered values only when the setting is on", async () => {
  await store.rememberValues({ PO: "1" });
  assert.deepEqual(await store.getLastValues(), { PO: "1" });
  await store.saveSettings({ rememberValues: false });
  await store.rememberValues({ PO: "2" });
  assert.deepEqual(await store.getLastValues(), { PO: "1" });
});

test("files: attached with field-filled names; {{attachments}} lists them", async () => {
  const { storeFile } = await import("../src/tb/files.js");
  const { fieldsOf } = await import("../src/lib/template.js");
  const file = await storeFile("PO {{PONUMBER}} – terms.pdf", "application/pdf", new Uint8Array([37, 80, 68, 70]));
  const snippet = { key: "po2", body: "PO {{PONUMBER}}, attached: {{attachments}} ({{attachments.count}})", files: [file] };
  assert.deepEqual(fieldsOf(snippet).map((f) => f.name), ["PONUMBER"]);
  const text = await insertSnippet(7, snippet, { PONUMBER: "4711" });
  assert.deepEqual(fake.attached, [{ tabId: 7, name: "PO 4711 – terms.pdf", size: 4, type: "application/pdf" }]);
  assert.equal(text, "PO 4711, attached: PO 4711 – terms.pdf (1)");
});

test("files survive export and import (as data) and are removed with the snippet", async () => {
  const { storeFile } = await import("../src/tb/files.js");
  const { snippetsWithFiles } = await import("../src/options/import-ui.js");
  const { readImport, buildExport } = await import("../src/lib/backup.js");
  await store.saveSnippets([{ key: "t", body: "x", files: [await storeFile("a.txt", "text/plain", new TextEncoder().encode("hi"))] }]);
  const json = JSON.stringify(buildExport(await snippetsWithFiles(), {}));
  await store.deleteSnippet("t");
  assert.equal(Object.keys(fake.storage).filter((k) => k.startsWith("file:")).length, 0, "file data left behind");
  await store.addSnippets(readImport(json).snippets);
  const [back] = await store.getSnippets();
  assert.equal(back.files[0].name, "a.txt");
  const { fileBytes } = await import("../src/tb/files.js");
  assert.equal(new TextDecoder().decode(await fileBytes(back.files[0].id)), "hi");
});
