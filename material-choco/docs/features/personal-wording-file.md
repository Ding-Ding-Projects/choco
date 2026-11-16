# Personal wording file

Load a JSON file that replaces words in the interface with your own, kept on your device.

## What it is

A file of the form:

```
{ "schemaVersion": 1, "name": "My wording", "entries": { "Machines": "Computers" } }
```

Each key in `entries` is a word or phrase to replace, matched as a whole word without regard to case; each value is the replacement. The file is validated completely before it is applied: at most 256 KiB, nested at most 8 levels, a numeric `schemaVersion`, an `entries` object, keys of at most 160 characters, text values of at most 1,000 characters. If any rule fails, the whole file is refused and nothing changes.

The file is stored in the browser and is never sent to the hub.

## How to use it

- Drop the file anywhere on the window, or use **Settings**, **Language**, **Personal wording**, **Choose file**.
- A banner confirms the file by its name. **Replace file** and **Clear** are on the same page.
- A refused file gives a message with the reason.

## What was checked

End to end check `invalid personal wording file is refused whole`.

## Known limits

- Replacement applies to text that goes through the app's wording helpers, which includes navigation, headings, actions, messages and the full-screen install results. Text outside them is not changed. Commands, exit codes and output are never changed.
- It does not apply while school mode is on.

## Related

- [Language modes](language-modes.md)
- [School mode](school-mode.md)
