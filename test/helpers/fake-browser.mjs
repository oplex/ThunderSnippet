// A small fake of the Thunderbird APIs ThunderSnippet uses in unit tests.

export function makeFakeBrowser({ manifestVersion = 3 } = {}) {
  const storage = {};
  const listeners = [];
  const sent = [];
  const attached = [];
  const compose = new Map([[7, { to: ["Ann Lee <ann@example.com>"], from: "Pat Sender <pat@example.com>", subject: "Quote 42", isPlainText: false }]]);
  const browser = {
    runtime: { getManifest: () => ({ manifest_version: manifestVersion, name: "ThunderSnippet", version: "1.0.0" }), id: "thundersnippet@oplex" },
    storage: {
      local: {
        get: async (key) => {
          const keys = key == null ? Object.keys(storage) : Array.isArray(key) ? key : [key];
          return Object.fromEntries(keys.filter((k) => k in storage).map((k) => [k, structuredClone(storage[k])]));
        },
        remove: async (keys) => {
          for (const k of [keys].flat()) delete storage[k];
        },
        set: async (obj) => {
          const changes = {};
          for (const [k, v] of Object.entries(obj)) {
            changes[k] = { newValue: v };
            storage[k] = structuredClone(v);
          }
          for (const l of listeners) l(changes, "local");
        },
      },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
    compose: {
      getComposeDetails: async (tabId) => structuredClone(compose.get(tabId)),
      addAttachment: async (tabId, { file }) => attached.push({ tabId, name: file.name, size: file.size, type: file.type }),
      listAttachments: async () => attached.map((a) => ({ name: a.name })),
    },
    tabs: {
      get: async (id) => ({ id, windowId: 3, type: "messageCompose" }),
      sendMessage: async (tabId, msg) => (sent.push([tabId, msg]), true),
    },
    windows: { update: async () => ({}) },
  };
  return { browser, storage, sent, compose, attached };
}
