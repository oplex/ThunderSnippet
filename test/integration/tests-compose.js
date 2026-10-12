// Inline expansion in real compose windows (HTML and plain text).

import { saveSettings, getSnippet } from "../../src/tb/store.js";
import { check, assert, waitFor, compose, typeIn, bodyText, closeCompose, paletteView, key } from "./util.js";

export async function composeTests() {
  await saveSettings({ closeOnBlur: false });

  await check("presets are there on first run", async () => {
    assert((await getSnippet("po1"))?.body.includes("{{PONUMBER}}"), "po1 preset missing");
  });

  await check("inline: “ty” + Tab expands, with the recipient, sender and nested signature", async () => {
    const tab = await compose();
    await typeIn(tab, "ty", "Tab");
    const text = await waitFor(async () => ((await bodyText(tab)).includes("Thank you") ? bodyText(tab) : null), "expanded text");
    assert(text.includes("Hi Ann,"), `no recipient name: ${text}`);
    assert(text.includes("Best regards,\nPat Sender"), `no signature: ${text}`);
    assert(!/\bty\b/.test(text), `key left behind: ${text}`);
    await closeCompose(tab);
  });

  await check("inline: “po1” + Tab asks for PONUMBER, then inserts it", async () => {
    const tab = await compose();
    await typeIn(tab, "po1", "Tab");
    const v = await paletteView((d) => d.querySelector(".tk-form input"));
    const input = v.document.querySelector('.tk-form input[data-field="PONUMBER"]');
    assert(v.document.getElementById("preview").textContent.includes("Hello Ann!"), "preview without recipient");
    input.value = "4711";
    input.dispatchEvent(new v.Event("input"));
    key(v, "Enter", input);
    const text = await waitFor(async () => ((await bodyText(tab)).includes("4711") ? bodyText(tab) : null), "PO in the message");
    assert(text.includes("Hello Ann!") && text.includes("here is PO 4711."), `text: ${text}`);
    assert(text.includes("Delivery to our main office"), `default not used: ${text}`);
    await closeCompose(tab);
  });

  await check("inline: Esc on the form puts the typed key back", async () => {
    const tab = await compose();
    await typeIn(tab, "po1", "Tab");
    const v = await paletteView((d) => d.querySelector(".tk-form input"));
    key(v, "Escape");
    await waitFor(async () => (await bodyText(tab)).includes("po1"), "po1 back in the message");
    await closeCompose(tab);
  });

  await check("inline: a word that isn't a key is left alone", async () => {
    const tab = await compose();
    await typeIn(tab, "hello", "Tab");
    await new Promise((r) => setTimeout(r, 500));
    assert((await bodyText(tab)).includes("hello"), "text changed");
    await closeCompose(tab);
  });

  await check("plain-text message: “sig” + Tab inserts plain text with a line break", async () => {
    const tab = await compose({ isPlainText: true });
    await typeIn(tab, "sig", "Tab");
    const text = await waitFor(async () => ((await bodyText(tab)).includes("Best regards") ? bodyText(tab) : null), "signature");
    assert(/Best regards,\r?\nPat Sender/.test(text), `text: ${JSON.stringify(text)}`);
    await closeCompose(tab);
  });
}
