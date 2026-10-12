// Header changes and live attachment names in real compose windows.

import { putSnippet, getSnippet } from "../../src/tb/store.js";
import { insertSnippet } from "../../src/tb/compose.js";
import { check, assert, waitFor, compose, bodyText, closeCompose } from "./util.js";

const emails = (list) => (list ?? []).map((a) => (typeof a === "string" ? a : "")).join(", ");

export async function headerTests() {
  const major = parseInt((await browser.runtime.getBrowserInfo()).version, 10);

  await check("headers: subject before, Cc added, To replaced, Reply-To, X- header", async () => {
    await putSnippet({
      key: "hdr",
      body: "Order {{PO}} attached.",
      headers: [
        { field: "subject", mode: "prepend", value: "[PO {{PO}}]" },
        { field: "cc", mode: "add", value: "boss@example.com; Ann Lee <ann@example.com>" },
        { field: "to", mode: "replace", value: "orders@example.com" },
        { field: "replyTo", mode: "add", value: "me@example.com" },
        { field: "custom", name: "X-Order", mode: "replace", value: "{{PO}}" },
      ],
    });
    const tab = await compose();
    await insertSnippet(tab.id, await getSnippet("hdr"), { PO: "4711" });
    const d = await browser.compose.getComposeDetails(tab.id);
    assert(d.subject === "[PO 4711] Quote 42", `subject: ${d.subject}`);
    assert(/orders@example\.com/.test(emails(d.to)) && !/ann@/.test(emails(d.to)), `to: ${emails(d.to)}`);
    assert(/boss@example\.com/.test(emails(d.cc)) && /ann@example\.com/.test(emails(d.cc)), `cc: ${emails(d.cc)}`);
    assert(/me@example\.com/.test(emails(d.replyTo)), `reply-to: ${emails(d.replyTo)}`);
    if (major >= 102) {
      const h = (d.customHeaders ?? []).find((x) => x.name.toLowerCase() === "x-order");
      assert(h?.value === "4711", `X-Order: ${JSON.stringify(d.customHeaders)}`);
    }
    assert((await bodyText(tab)).includes("Order 4711 attached."), "body not inserted");
    // Inserting again doesn't add the subject prefix or the Cc twice.
    await insertSnippet(tab.id, await getSnippet("hdr"), { PO: "4711" });
    const again = await browser.compose.getComposeDetails(tab.id);
    assert(again.subject === "[PO 4711] Quote 42", `subject twice: ${again.subject}`);
    assert(emails(again.cc).match(/boss@/g).length === 1, `cc twice: ${emails(again.cc)}`);
    await closeCompose(tab);
  });

  await check("{{attachments}} follows files added and removed after inserting", async () => {
    await putSnippet({ key: "att", body: "Files: {{attachments|none}} ({{attachments.count}})" });
    const tab = await compose();
    await insertSnippet(tab.id, await getSnippet("att"));
    await waitFor(async () => (await bodyText(tab)).includes("Files: none (0)"), "empty list");
    const file = new File(["hello"], "quote-4711.txt", { type: "text/plain" });
    const a = await browser.compose.addAttachment(tab.id, { file });
    await waitFor(async () => (await bodyText(tab)).includes("Files: quote-4711.txt (1)"), "the added file's name");
    await browser.compose.removeAttachment(tab.id, a.id);
    await waitFor(async () => (await bodyText(tab)).includes("Files: none (0)"), "the name gone again");
    await closeCompose(tab);
  });
}
