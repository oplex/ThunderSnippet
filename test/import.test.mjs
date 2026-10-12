import { test } from "node:test";
import assert from "node:assert/strict";
import { importQuicktext, importCsv, parseCsv } from "../src/lib/quicktext.js";
import { readImport, buildExport } from "../src/lib/backup.js";

const QT = `<?xml version="1.0"?>
<quicktext version="2">
  <filetype>templates</filetype>
  <menu>
    <title><![CDATA[Sales]]></title>
    <texts>
      <text shortcut="1" type="0">
        <name><![CDATA[PO reply]]></name>
        <body><![CDATA[Hello [[TO=firstname]]! Here is PO [[INPUT=PO number]].
[[INPUT=Speed|select|Normal;Express]] · [[DATE=long]] [[CURSOR]]
[[TEXT=Sales|Signature]] [[SCRIPT=foo]]]]></body>
        <keyword><![CDATA[po1]]></keyword>
        <attachments><![CDATA[/home/me/terms.pdf]]></attachments>
      </text>
      <text shortcut="" type="1">
        <name><![CDATA[Signature]]></name>
        <body><![CDATA[<b>[[FROM=fullname]]</b> &amp; team]]></body>
      </text>
    </texts>
  </menu>
</quicktext>`;

test("Quicktext templates become snippets, codes translated", () => {
  const { snippets, notes } = importQuicktext(QT);
  assert.deepEqual(snippets.map((s) => [s.key, s.name, s.group, s.html]), [
    ["po1", "PO reply", "Sales", false],
    ["signature", "Signature", "Sales", true],
  ]);
  assert.equal(
    snippets[0].body,
    "Hello {{to.first}}! Here is PO {{PO number}}.\n{{Speed|Normal|Express}} · {{date:dddd, D MMMM YYYY}} {{cursor}}\n{{snip:signature}} [[SCRIPT=foo]]",
  );
  assert.equal(snippets[1].body, "<b>{{me.name}}</b> &amp; team");
  assert.deepEqual(notes, ["attachments (add the files again in the snippet editor)", "[[SCRIPT]]"]);
});

test("CSV import with quotes and line breaks", () => {
  assert.deepEqual(parseCsv('a,"b, c","d ""e""\nf"\n'), [["a", "b, c", 'd "e"\nf']]);
  const { snippets } = importCsv('abbreviation,label,snippet\nty,Thanks,"Thank you,\nAnn"\n');
  assert.deepEqual(snippets, [{ key: "ty", name: "Thanks", body: "Thank you,\nAnn", group: "Imported" }]);
});

test("readImport recognises every format; export round-trips", () => {
  assert.equal(readImport(QT).kind, "Quicktext");
  assert.equal(readImport("key,text\nx,y", "a.csv").kind, "CSV");
  const exported = JSON.stringify(buildExport([{ key: "Po1", name: "P", body: "b" }], { expandKey: "Tab" }));
  const back = readImport(exported);
  assert.equal(back.kind, "ThunderSnippet");
  assert.deepEqual(back.snippets, [{ key: "po1", name: "P", body: "b", html: false, group: "", files: [] }]);
  assert.throws(() => readImport("hello"), /Unknown file/);
});
