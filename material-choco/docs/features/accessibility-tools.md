# Accessibility tools

Text size, contrast, motion, target size and focus ring, one click from every page.

## What it is

A button in the top bar, also on `Ctrl+Shift+A`, opens a menu that cycles each of these in place:

| Setting | Choices |
| --- | --- |
| Text size | Small, Normal, Large, Larger, Largest. Scales text and spacing together |
| Contrast | Normal, High |
| Motion | System, Reduced, Full |
| Touch targets | Normal, Large (56 px) |
| Focus ring | Normal, Bold |
| Theme | System, Light, Dark |

The same settings are on **Settings**, **Accessibility tools**. Dialogs keep keyboard focus inside them and return it when they close. Every animation has a reduced motion variant, which applies when the system asks for reduced motion or when Motion is set to Reduced.

## How to use it

Open the menu and pick a line to step it to its next value. The button itself can be hidden in Settings; the settings stay reachable through the command palette.

## What was checked

There is no dedicated named check for these settings. The end to end run confirms that the phone layout has no horizontal overflow and that no browser console errors occur.

## Known limits

This is the least verified area of the app:

- No formal accessibility audit and no screen reader pass.
- Reduced motion was written by rule and not captured.
- Larger text sizes and display scaling were not checked page by page for clipping.

## Related

- [Languages and accessibility](../articles/languages-and-accessibility.md): the guide
- [Theme and seed colour](theme-and-seed-colour.md)
- [Focus modes](focus-modes.md)
