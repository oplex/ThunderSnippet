// The fill-in form for a snippet's fields, with a live preview.

import { fieldsOf, render } from "../lib/template.js";

function el(tag, attrs = {}, text) {
  const node = Object.assign(document.createElement(tag), attrs);
  if (text != null) node.textContent = text;
  return node;
}

// Shows the form for `snippet` in `box` and keeps `preview` updated.
// Returns { values(), focus() }.
export function showForm(box, preview, snippet, { snippets, context, lastValues, onSubmit }) {
  const fields = fieldsOf(snippet.body, snippets);
  box.replaceChildren();
  const inputs = new Map();
  for (const f of fields) {
    const id = `f-${inputs.size}`;
    const label = el("label", { htmlFor: id }, f.name);
    let input;
    if (f.choices.length) {
      input = el("select", { id });
      for (const c of f.choices) input.append(el("option", { value: c }, c));
      if (f.choices.includes(lastValues[f.name])) input.value = lastValues[f.name];
    } else {
      input = el("input", { id, type: "text", value: lastValues[f.name] ?? f.default, placeholder: f.default });
    }
    input.dataset.field = f.name;
    input.addEventListener("input", update);
    input.addEventListener("change", update);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        onSubmit();
      }
    });
    inputs.set(f.name, input);
    box.append(label, input);
  }
  const values = () => Object.fromEntries([...inputs].map(([name, input]) => [name, input.value]));
  function update() {
    const r = render(snippet.body, { context, values: values(), snippets });
    preview.textContent = snippet.html ? r.text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "") : r.text;
  }
  update();
  return { values, focus: () => inputs.values().next().value?.focus(), count: fields.length };
}
