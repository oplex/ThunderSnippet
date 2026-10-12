<p align="center"><img src="icons/thundersnippet.svg" alt="ThunderSnippet logo" width="112"></p>

# ThunderSnippet

Canned replies for Thunderbird. In a message, type a short key like `po1` and
press **Tab**:

> Hello Ann!
>
> Thanks for your quote, here is PO **4711**.

ThunderSnippet asks for the PO number in a small form, fills in the
recipient's first name, your name and today's date, and puts the caret where
you want to keep typing. It belongs to the same family as
[ThunderJump](https://github.com/oplex/thunderjump): same look, same keys
editor, and tested inside real Thunderbird builds from 91 to the newest
release.

## Install

Download the `.xpi` for your Thunderbird from the
[latest release](https://github.com/oplex/thundersnippet/releases/latest),
then in Thunderbird open **Add-ons and Themes → ⚙ → Install Add-on From
File…**. Updates install automatically after that.

- Thunderbird 140 or newer: `thundersnippet-<version>.xpi`
- Thunderbird 91–139: `thundersnippet-<version>-tb91-139.xpi`

## Using it

| How | What happens |
| --- | --- |
| Type a key, then **Tab** | The key is replaced by the snippet (or the form opens first, if it has fields) |
| **Alt+Shift+S** | The snippet palette: type part of a key, name or text, **Enter** |
| Snippet button in the compose toolbar | The same palette as a popup |
| **Esc** on the form | Puts the typed key back |

Space can expand keys instead of Tab, or expansion can be turned off (only
the palette), in the settings.

## Writing snippets

Open the settings (⚙ in the palette, or Add-ons Manager → ThunderSnippet →
Options). Each snippet has a **key** (what you type, e.g. `po1`), a name and
the text. A live preview shows the result.

| In the text | Becomes |
| --- | --- |
| `{{PONUMBER}}` | A field you fill in when inserting |
| `{{PONUMBER\|12345}}` | A field with a default |
| `{{GREETING\|Hi\|Hello\|Dear}}` | A choice (the first is the default) |
| `{{to.first}}` `{{to.last}}` `{{to.name}}` `{{to.email}}` | The first recipient |
| `{{me.first}}` `{{me.name}}` `{{me.email}}` | You (the sender) |
| `{{to.first\|there}}` | With a fallback when the value is empty |
| `{{subject}}` | The message subject |
| `{{date}}` `{{time}}` | Today, in your format |
| `{{date:YYYY-MM-DD}}` `{{date:dddd D MMMM}}` | A date format (`YYYY YY MMMM MMM MM M DD D dddd ddd HH H mm ss`) |
| `{{snip:sig}}` | Another snippet, by key (its fields are asked too) |
| `{{cursor}}` | Where the caret goes afterwards |

Fields remember what you typed last time (a setting), so recurring values are
one Enter away. Snippets can be plain text or HTML.

Example snippets are added on first install, `po1` among them:

```
Hello {{to.first|there}}!

Thanks for your quote, here is PO {{PONUMBER}}.
Delivery to {{ADDRESS|our main office}} by {{DATE}}.

Best regards,
{{me.name}}
```

## Import and export

Settings → *Import and export* reads:

- **Quicktext** templates (`.xml`, from Quicktext's settings → Export). Groups,
  keywords and HTML are kept, and Quicktext's codes become ThunderSnippet's:
  `[[TO=firstname]]` → `{{to.first}}`, `[[FROM=fullname]]` → `{{me.name}}`,
  `[[INPUT=PO]]` → `{{PO}}`, `[[INPUT=Speed|select|A;B]]` → `{{Speed|A|B}}`,
  `[[DATE]]`, `[[TIME]]`, `[[SUBJECT]]`, `[[CURSOR]]`, and `[[TEXT=group|name]]`
  → `{{snip:key}}`. Codes without an equivalent (scripts, files) are kept as
  text and listed after the import.
- **CSV** with a header naming the key (`key`, `abbreviation` or `keyword`)
  and text (`text`, `body` or `snippet`) columns, optionally a name.
- ThunderSnippet's own **export** (JSON).

Imported keys that are already taken get a number added (`po1-2`), so an
import never overwrites your snippets.

## The Thunder suite

ThunderSnippet, [ThunderJump](https://github.com/oplex/thunderjump) and
ThunderExportImport share one design kit (`src/kit/`: theme, dialogs, keys
editor, fuzzy search) and find each other when installed together (`kit/suite.js`).
Each one answers `getConfig`/`setConfig`, so the whole suite's settings can be
backed up in one file.

## Permissions

- `compose`: read the recipient and subject of the message you're writing,
  and insert the snippet where the caret is
- `storage`: keep your snippets and settings
- `scripting` (Thunderbird 140+): how the compose part is loaded there

ThunderSnippet makes no network requests and collects nothing.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md).

## License

MIT © 2026 oplex.se
