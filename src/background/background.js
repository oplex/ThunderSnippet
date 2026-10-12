// ThunderSnippet background: registers the compose script, opens the
// snippet palette over a compose window, and fills in snippets.

import { registerComposeScript, findComposeTab, insertSnippet, insertText, followAttachments } from "../tb/compose.js";
import { getSnippet, seedPresets, rememberValues, getSnippets, getSettings, saveSettings, saveSnippets } from "../tb/store.js";
import { fieldsOf } from "../lib/template.js";
import { serveSuite } from "../kit/suite.js";
import { snippetsWithFiles } from "../options/import-ui.js";
import { addSnippets } from "../tb/store.js";

const WIDTH = 640;
const HEIGHT = 480;
// Inline expansions waiting for the form: windowId → { tabId, typed }.
const pending = new Map();

// Open the palette for compose tab `tabId` (null: none), optionally straight
// at the form for snippet `key`.
export async function openPalette(tabId, { key = "", typed = "" } = {}) {
  const params = new URLSearchParams({ mode: "window", tab: tabId ?? "", key, typed });
  const anchor = tabId != null ? (await browser.tabs.get(tabId)).windowId : null;
  const parent = anchor != null ? await browser.windows.get(anchor) : await browser.windows.getLastFocused().catch(() => null);
  const geometry = { width: WIDTH, height: HEIGHT };
  if (parent?.width) {
    geometry.left = Math.round(parent.left + (parent.width - WIDTH) / 2);
    geometry.top = Math.round(parent.top + Math.max(40, (parent.height - HEIGHT) / 4));
  }
  const win = await browser.windows.create({ type: "popup", url: browser.runtime.getURL(`src/palette/palette.html?${params}`), allowScriptsToClose: true, ...geometry });
  if (geometry.left != null) await browser.windows.update(win.id, { left: geometry.left, top: geometry.top }).catch(() => {});
  if (typed && tabId != null) pending.set(win.id, { tabId, typed });
  return win;
}

// A key typed in a message: expand right away, or ask for the fields first.
export async function expand(tabId, key, typed) {
  const snippet = await getSnippet(key);
  if (!snippet) return insertText(tabId, typed);
  if (fieldsOf(snippet, await getSnippets()).length) return openPalette(tabId, { key, typed });
  return insertSnippet(tabId, snippet);
}

export async function handleCommand(command) {
  if (command === "open-snippets") return openPalette((await findComposeTab())?.id ?? null);
}

browser.commands.onCommand.addListener((command) => handleCommand(command));
followAttachments();
// The main window's toolbar button opens the snippet list and settings.
(browser.action ?? browser.browserAction)?.onClicked.addListener(() => browser.runtime.openOptionsPage());

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "ts-expand" && sender.tab) return expand(sender.tab.id, msg.key, msg.typed);
  if (msg?.type === "ts-insert-snippet") {
    pending.delete(msg.windowId);
    return getSnippet(msg.key).then(async (s) => {
      if (!s) throw new Error(`No snippet “${msg.key}”`);
      await rememberValues(msg.values ?? {});
      return insertSnippet(msg.tabId, s, msg.values ?? {});
    });
  }
  return undefined;
});

// Closing the form of an inline expansion puts the typed key back.
browser.windows.onRemoved.addListener((windowId) => {
  const p = pending.get(windowId);
  if (!p) return;
  pending.delete(windowId);
  insertText(p.tabId, p.typed).catch(() => {});
});

serveSuite({
  ping: () => "pong",
  listSnippets: async () => (await getSnippets()).map(({ key, name, group }) => ({ key, name, group })),
  getConfig: async () => ({ snippets: await snippetsWithFiles(), settings: await getSettings() }),
  setConfig: async ({ snippets, settings }) => {
    if (Array.isArray(snippets)) {
      await saveSnippets([]);
      await addSnippets(snippets);
    }
    if (settings) await saveSettings(settings);
    return true;
  },
});

browser.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "install") await seedPresets();
});

export const ready = (async () => {
  await seedPresets();
  await registerComposeScript();
})();
