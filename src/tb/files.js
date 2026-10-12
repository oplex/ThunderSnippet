// Files that snippets attach, kept in storage.local apart from the snippet
// list (which stays small): "file:<id>" → { name, type, data (base64) }.

const toBase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// Store a file; returns its metadata for a snippet: { id, name, type, size }.
export async function storeFile(name, type, bytes, id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`) {
  await browser.storage.local.set({ [`file:${id}`]: { name, type, data: toBase64(bytes) } });
  return { id, name, type: type || "application/octet-stream", size: bytes.length };
}

export async function fileBytes(id) {
  const f = (await browser.storage.local.get(`file:${id}`))[`file:${id}`];
  if (!f) throw new Error("A file of this snippet is missing");
  return fromBase64(f.data);
}

export async function fileData(id) {
  return (await browser.storage.local.get(`file:${id}`))[`file:${id}`]?.data ?? null;
}

export async function removeFiles(ids) {
  if (ids.length) await browser.storage.local.remove(ids.map((id) => `file:${id}`));
}

export { toBase64, fromBase64 };
