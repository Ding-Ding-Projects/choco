# Installed packages

A list of the packages on each machine, with status, single actions, bulk actions, and `packages.config` export and import.

## What it is

The **Installed** page shows one card per selected machine. Each row has the package, its installed version, whether an update is available or it is current, and whether it is pinned. The data is the inventory the machine's agent last reported, with the time it was read.

## How to use it

- **Upgrade** on a row upgrades that package.
- The row menu (three dots, right click or `Shift+F10`) offers upgrade with options, pin or unpin, package information, reinstall with `--force`, copy the package id, uninstall with options, and uninstall.
- Tick rows to get the bulk bar: upgrade, pin, save the selection as `packages.config`, uninstall, clear.
- The export button writes the list as CSV, JSON or Markdown.
- **Export all** downloads a `packages.config` of everything on that machine.
- **Import packages.config** uploads a file of at most 512 KB and runs `choco install` with it on that machine.
- The filter bar narrows by text, **Outdated only** and **Pinned**.

Uninstalling asks for the [two key confirmation](two-key-confirmation.md).

## What was checked

- Test `packages.config import writes a temp file on the agent` in `test/hub.test.js`.
- End to end checks `inventory refreshes after a change`, `row menu opens with a filter field focused` and `uninstall runs only after both keys and the slider`.

## Known limits

- The list is as fresh as the last inventory. For an offline machine it is labelled as possibly stale.
- Bulk pin queues one job per package.
- Exercised with the test stand-in only.

## Related

- [Updates](updates.md)
- [Pins](pins.md)
- [Context menus](context-menus.md)
