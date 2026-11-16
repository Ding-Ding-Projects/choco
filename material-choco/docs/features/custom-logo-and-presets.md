# Custom logo and presets

Put your own mark in the top bar, and apply a named set of appearance settings with one click and an undo.

## What it is

**Logo**, under **Settings**, **Appearance**, replaces the mark in the top bar with your own picture: PNG, JPEG, WebP or SVG, up to 256 KB. The file is checked by its content, not its name, and must decode as a picture. It is stored in this browser only.

**Presets** on the same tab each write a small named set of settings, for example a seed colour and vividness, and leave everything else alone. The notification that follows names what was written and has **Undo**, which puts back exactly the values that were there before.

## How to use it

- Choose a picture under **Logo**. **Reset** brings the built-in mark back.
- Press a preset. Press **Undo** in the notification if you do not like it.

## What was checked

End to end checks `a logo file that is not a picture is refused by its content`, `a logo larger than 256 KB is refused`, `an uploaded logo is shown in the top bar from local storage`, `logo reset brings the built-in mark back`, `a preset writes exactly the settings it names` and `undo after a preset restores the earlier values`.

## Known limits

- The logo changes the top bar only. Installer, window and taskbar icons are not changed.
- The logo is per browser and is not sent to the hub, so other devices do not see it.
- Presets are built in. You cannot save your own as a named preset; use settings export instead.

## Related

- [Theme and seed colour](theme-and-seed-colour.md)
- [Settings that explain themselves](settings.md)
- [Timed settings](timed-settings.md)
