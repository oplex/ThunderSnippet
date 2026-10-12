# Publishing ThunderSnippet on addons.thunderbird.net

1. First time, by hand: on <https://addons.thunderbird.net/developers/>,
   **Submit a New Add-on → On this site**, upload
   `thundersnippet-<version>-atn.xpi` from the latest GitHub release, answer
   **No** to source code (plain, unminified JavaScript), MIT license.
   After it's approved, **Upload New Version** with
   `thundersnippet-<version>.91-atn-tb91-139.xpi` for Thunderbird 91–139.
2. Then add the repository secrets `JWTISSUER` and `JWTSECRET` (the same ATN
   API key as ThunderJump works). From then on every release uploads both
   files automatically.

**Summary:** Canned replies for Thunderbird: type a key like po1 and press
Tab, or search your snippets. Fields like {{PONUMBER}}, recipient names,
dates, presets, Quicktext import.

**Categories:** Composition; Message and News Reading.

**Privacy policy:** ThunderSnippet makes no network requests and collects no
data. Snippets and settings stay in the add-on's storage in your Thunderbird
profile. It reads the recipient and subject of the message you're writing only
to fill in a snippet you insert.
