# Language modes

English, Hong Kong Cantonese, or both at once, with a separate tone setting for each language.

## What it is

Three modes: **English**; **Hong Kong Cantonese**, which shows Cantonese where a translation exists; and **Bilingual**, which shows English first with a compact Cantonese line beneath. A string without a Cantonese entry falls back to English.

Each language has a **funny level** from 1 to 5, shipped at 5. At 4 and 5, messages that have a playful variant use it. The facts in a message are identical at every level. A switch controls the decorative emoji in dialog titles.

## How to use it

**Settings**, **Language**: choose the mode, move the two sliders, flip the emoji switch. The first-run wizard offers the mode too.

## What was checked

End to end checks `bilingual mode shows the Cantonese line`, `Cantonese mode translates a new page`, `every sentence passed to the translation helper has a Cantonese entry` and `playful wording changes the voice and keeps the facts`.

## Known limits

- Navigation, headings, actions, messages and the sentences of the newer pages have Cantonese entries. A sentence without an entry stays English, so some older page text can still appear in English.
- Playful variants exist for a limited set of messages.
- Help text of CLI commands comes from the CLI source and is English.
- The vendored fonts cover Latin text. Cantonese text uses a font from your device.

## Related

- [Personal wording file](personal-wording-file.md)
- [School mode](school-mode.md)
- [Languages and accessibility](../articles/languages-and-accessibility.md): the guide
