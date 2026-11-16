# Timed settings

Let settings switch by the clock: a dark theme in the evening, quieter results at night.

## What it is

Two things, both following the clock of your device:

- **Switch theme by time of day**, under **Settings**, **Appearance**: the dark theme between two times and the light theme for the rest of the day.
- **Timed settings**, its own tab in Settings: rules for theme, density, motion, contrast, action sounds and full-screen install results. A rule has a value, a start, an end and optional weekdays.

While a rule is active it wins over the stored setting. The stored setting is never changed and returns when the rule ends. When two active rules set the same setting, the one lower in the list wins. A rule whose end is earlier than its start runs past midnight, and its weekdays name the day it starts on. Rules are checked every minute, and the page lists what is in force right now.

## How to use it

Open **Settings**, **Timed settings**, choose the setting, the value, the times and the days, and press **Add rule**. Each rule has a switch to pause it and a delete button. The list can be exported.

## What was checked

End to end checks `timed settings start with nothing in force`, `a timed rule with equal start and end is refused`, `an active timed rule replaces the setting without changing the stored value`, `timed windows handle midnight and weekdays`, `deleting the rule returns the stored setting`, `theme switches by time of day and leaves the theme choice alone` and `turning the theme schedule off returns the chosen theme`.

## Known limits

- Rules exist for the six settings named above, not for every setting.
- Rules follow the device clock and are stored per browser. They only act while the app is open.
- Settings cannot be loaded from an outside source such as a file on a server.

## Related

- [Theme and seed colour](theme-and-seed-colour.md)
- [Settings that explain themselves](settings.md)
- [Focus modes](focus-modes.md)
