# Phone layout

The hub's interface works at phone width, so you can check on machines and start an upgrade from a phone.

## What it is

On narrow screens the tab strip moves behind a menu button and a bottom bar appears with Overview, Installed, Updates, Jobs and **More**, which opens the full list of pages. Cards stack in one column, and wide tables scroll inside their own area instead of pushing the page sideways.

## How to use it

Open the hub's address in the phone's browser and sign in. Everything available on a desktop is available here; the Console and option dialogs are long but complete.

## What was checked

End to end check `phone layout has no horizontal overflow`, at 390 by 844 with mobile emulation, on the Overview. Two phone captures are in the screenshots.

## Known limits

- One width and one page were checked for overflow. Other pages, landscape, tablets and larger text sizes were not.
- Checked in emulation, not on a physical phone.
- The desktop app is Windows only. On a phone you use a hub.

## Related

- [Tabs](tabs.md)
- [Hub](hub.md)
- [Accessibility tools](accessibility-tools.md)
