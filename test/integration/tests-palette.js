// The snippet palette (key command), import from Quicktext, and settings.

import { handleCommand } from "../../src/background/background.js";
import { importText } from "../../src/options/import-ui.js";
import { getSnippet, saveSettings } from "../../src/tb/store.js";
import { check, assert, waitFor, compose, typeIn, bodyText, closeCompose, paletteView, key } from "./util.js";

const QUICKTEXT = `<?xml version="1.0"?><quicktext version="2"><filetype>templates</filetype><menu><title><![CDATA[Imported]]></title><texts>
<text shortcut="" type="0"><name><![CDATA[Quote thanks]]></name><keyword><![CDATA[qt1]]></keyword>
<body><![CDATA[Dear [[TO=firstname]], thanks for quote [[INPUT=Quote|text|Q-1]].]]></body></text></texts></menu></quicktext>`;

export async function paletteTests() {
  await check("palette: the key command opens it over the compose window; search and Enter inserts", async () => {
    const tab = await compose();
    await handleCommand("open-snippets");
    const v = await paletteView();
    assert(v.location.search.includes(`tab=${tab.id}`), `no compose tab: ${v.location.search}`);
    const input = v.document.getElementById("input");
    input.value = "today";
    input.dispatchEvent(new v.Event("input"));
    await waitFor(() => v.document.querySelector(".tk-list li .badge")?.textContent === "today", "today first");
    key(v, "Enter", input);
    const year = String(new Date().getFullYear());
    await waitFor(async () => (await bodyText(tab)).includes(year), "date in the message");
    await closeCompose(tab);
  });

  await check("import: Quicktext templates become snippets that expand", async () => {
    const msg = await importText(QUICKTEXT, "templates.xml");
    assert(/Imported 1 snippet from Quicktext/.test(msg), msg);
    assert((await getSnippet("qt1")).body === "Dear {{to.first}}, thanks for quote {{Quote|Q-1}}.", "converted body");
    const tab = await compose();
    await typeIn(tab, "qt1", "Tab");
    const v = await paletteView((d) => d.querySelector(".tk-form input"));
    key(v, "Enter", v.document.querySelector(".tk-form input"));
    await waitFor(async () => (await bodyText(tab)).includes("Dear Ann, thanks for quote Q-1."), "imported snippet expanded");
    await closeCompose(tab);
  });

  await check("settings: expanding with Space instead of Tab", async () => {
    await saveSettings({ expandKey: "Space" });
    try {
      const tab = await compose();
      await new Promise((r) => setTimeout(r, 300));
      await typeIn(tab, "sig", " ");
      await waitFor(async () => (await bodyText(tab)).includes("Best regards"), "expanded on Space");
      await closeCompose(tab);
    } finally {
      await saveSettings({ expandKey: "Tab" });
    }
  });
}
