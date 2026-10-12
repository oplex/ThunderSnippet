# Developing ThunderSnippet

```sh
npm test              # unit tests (Node 22, fake Thunderbird APIs)
npm run test:tb       # end-to-end inside real headless Thunderbird (140.7.1esr by default)
TB_BIN=/path/to/thunderbird node test/integration/run.mjs   # any version
npm run check-lines   # every file must stay under 300 lines
npm run check-kit     # src/kit must match src/kit/kit.json
npm run lint
npm run build         # dist/*.xpi
```

## Layout

```
manifest.json         Manifest V3 (Thunderbird 140+); scripts/manifest-mv2.mjs derives 91–139
src/lib/              pure logic: template language, dates, snippets, Quicktext/CSV import
src/tb/               Thunderbird APIs: storage, compose (insert, compose script registration)
src/compose/editor.js the compose script: inline expansion and inserting at the caret
src/background/       commands, palette window, filling in snippets, suite messages
src/palette/          the snippet palette and fill-in form
src/options/          settings page: editor, import/export, keys
src/kit/              the Thunder kit, shared by every Thunder add-on (see below)
test/                 unit tests; test/integration/ runs inside real Thunderbird
```

## The Thunder kit

`src/kit/` is identical in ThunderJump, ThunderSnippet and ThunderExportImport:
theme, dialogs, keyboard shortcut editor, key parsing, fuzzy search, and the
suite protocol. After changing it:

```sh
node scripts/kit.mjs stamp 1.1.0          # record the new version and hash
node scripts/kit.mjs sync ../thunderjump  # copy it to the other add-ons
```

CI fails when a kit copy differs from its `kit.json`.

## Cross-testing the suite

`TB_PARTNERS=../thunderjump:../thunderexportimport npm run test:tb` installs
the other Thunder add-ons next to ThunderSnippet in the same Thunderbird.

## Releasing

Bump the version in `manifest.json` and `package.json`, then Actions →
*Release* → *Run workflow*. It tests, builds and publishes the GitHub release
with `updates.json`, and uploads to addons.thunderbird.net when the
`JWTISSUER`/`JWTSECRET` secrets exist (see PUBLISHING.md).
