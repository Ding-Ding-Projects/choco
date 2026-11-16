# Theme and seed colour

Light and dark themes, both derived from one seed colour that you can change.

## What it is

The interface follows Material Design 3 Expressive. Every colour is computed from one hue and one vividness value, so changing the seed recolours the whole app consistently in light and dark. The default seed is a cocoa brown.

Settings under **Appearance**: **Theme** (light, dark, or follow the system), **Density** (comfortable or compact, which shrinks controls to 40 px), **Motion**, the **seed colour** field, **Vividness**, and a **Display name** shown in the title bar and the tab title. The same tab can [switch the theme by time of day](timed-settings.md) and holds the [logo and the presets](custom-logo-and-presets.md).

## How to use it

- Drag in the colour field, or focus it and use the arrow keys, to change hue and vividness. A hue slider sits beside it.
- Or type a HEX colour to take its hue.
- The readout shows the resulting primary colour as HEX, RGB, HSL and OKLCH, with its contrast against the text drawn on it.

## What was checked

End to end check `dark theme applies`.

## Known limits

- HEX is the only typed input. Named colours and other colour spaces are not accepted.
- Individual elements cannot be styled separately.
- The display name changes the title only. It does not rename files, ids or update feeds.
- Buttons, fields, switches, checkboxes, chips, sliders and selects are Material Web components; cards, tables, tabs, menus and dialogs are hand-written on the same colour tokens.

## Related

- [Accessibility tools](accessibility-tools.md)
- [Settings that explain themselves](settings.md)
- [Focus modes](focus-modes.md)
