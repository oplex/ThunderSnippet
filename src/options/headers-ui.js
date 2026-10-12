// Snippet editor: the list of header changes (subject, recipients, X- headers).

import { FIELD_LABELS, modesFor } from "../lib/headers.js";

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function select(options, value, title) {
  const s = el("select", { title });
  for (const [v, label] of Object.entries(options)) s.append(el("option", { value: v }, label));
  s.value = value;
  return s;
}

// Draw `list` (edited in place) into `ul`; onChange() after every edit.
export function drawHeaders(ul, list, onChange) {
  const redraw = () => {
    drawHeaders(ul, list, onChange);
    onChange();
  };
  ul.replaceChildren(
    ...list.map((h, i) => {
      const field = select(FIELD_LABELS, h.field, "What to change");
      const name = el("input", { type: "text", value: h.name ?? "", placeholder: "X-Order", title: "Header name (starts with X-)", className: "hname" });
      name.hidden = h.field !== "custom";
      const mode = select(modesFor(h.field), h.mode, "How");
      const placeholder = h.field === "subject" ? "PO {{PONUMBER}}" : h.field === "custom" ? "{{PONUMBER}}" : "boss@example.com, Ann <ann@example.com>";
      const value = el("input", { type: "text", value: h.value ?? "", placeholder, title: "Value (fields allowed)" });
      field.addEventListener("change", () => {
        const modes = modesFor(field.value);
        list[i] = { ...h, field: field.value, mode: modes[h.mode] ? h.mode : Object.keys(modes)[0] };
        redraw();
      });
      mode.addEventListener("change", () => {
        list[i] = { ...list[i], mode: mode.value };
        onChange();
      });
      name.addEventListener("input", () => {
        list[i] = { ...list[i], name: name.value };
        onChange();
      });
      value.addEventListener("input", () => {
        list[i] = { ...list[i], value: value.value };
        onChange();
      });
      const remove = el("button", { textContent: "Remove", type: "button" });
      remove.addEventListener("click", () => {
        list.splice(i, 1);
        redraw();
      });
      return el("li", {}, field, name, mode, value, remove);
    }),
  );
}

// A new row (the most common change: someone on Cc).
export const newHeader = () => ({ field: "cc", mode: "add", value: "" });
