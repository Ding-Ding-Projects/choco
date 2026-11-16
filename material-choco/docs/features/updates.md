# Updates

What is out of date on each machine, and one button to upgrade it all.

## What it is

The **Updates** page lists, per machine, the packages for which the inventory reported a newer version: installed version, available version and whether the package is pinned. Pinned packages are shown and are not counted as ready. The **Overview** shows the same total in its banner.

## How to use it

- **Upgrade everything** runs `choco upgrade all` on every selected machine that has something to upgrade.
- The button on a machine card upgrades that machine only; **Upgrade** on a row upgrades one package.
- **Check again** asks the selected machines to re-read their inventory.
- **Upgrade all with options** opens the full upgrade form with a preview and a dry run.
- `Ctrl+Shift+U` opens this page from anywhere.

## What was checked

End to end checks `overview counts real updates`, `upgrade success takes over the screen` and `inventory refreshes after a change`.

## Known limits

- "Out of date" is what `choco outdated` reported at the last inventory read.
- Exercised with the test stand-in only.

## Related

- [Pins](pins.md): hold a package back
- [Schedules](schedules.md): upgrade every night
- [Install result takeovers](install-result-takeovers.md)
