/*
 * The {{to.*}} / {{me.*}} / {{subject}} values for a compose window, from
 * compose.getComposeDetails (pure).
 */

// "Ann Lee <ann@example.com>" → { name, first, last, email }.
export function person(address) {
  const s = typeof address === "string" ? address.trim() : "";
  if (!s) return { name: "", first: "", last: "", email: "" };
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(s);
  const email = (m ? m[2] : s).trim();
  let name = m ? m[1].trim() : "";
  let first = "";
  let last = "";
  if (name.includes(",")) {
    [last, first] = name.split(",").map((x) => x.trim()); // "Lee, Ann"
    name = `${first} ${last}`.trim();
  } else if (name) {
    const parts = name.split(/\s+/);
    first = parts[0];
    last = parts.length > 1 ? parts[parts.length - 1] : "";
  } else {
    // No display name: "ann.lee@…" → Ann Lee.
    const words = email.split("@")[0].split(/[._-]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1));
    first = words[0] ?? "";
    last = words.length > 1 ? words[words.length - 1] : "";
  }
  return { name: name || [first, last].filter(Boolean).join(" "), first, last, email };
}

export function composeContext(details = {}) {
  const to = Array.isArray(details.to) ? details.to : [details.to];
  return { to: person(to.find((x) => typeof x === "string")), me: person(details.from), subject: details.subject ?? "" };
}
