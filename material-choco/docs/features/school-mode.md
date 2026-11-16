# School mode

A plain mode for shared or public screens: English only, no playful options, with an optional PIN.

## What it is

When the mode is on, the interface is forced to English, playful message variants and dialog emoji are off, the personal wording file is ignored, and the Cantonese narration voice is not used. The mode can be renamed, and the new name is shown wherever the mode is mentioned. A PIN can be set that is asked for when turning the mode off.

## How to use it

**Settings**, **Language**: turn the mode on, optionally rename it and set a PIN. To turn it off, flip the switch and enter the PIN if one is set.

## What was checked

No dedicated named check. The behaviour is implemented in `ui/js/i18n.js` and `ui/js/pages2.js`.

## Known limits

- It is a convenience lock and not a security feature. The setting and the PIN live in the browser's storage, and clearing the site's storage resets both.
- It applies to one browser. It is not pushed from the hub to other devices.

## Related

- [Language modes](language-modes.md)
- [Personal wording file](personal-wording-file.md)
- [Focus modes](focus-modes.md)
