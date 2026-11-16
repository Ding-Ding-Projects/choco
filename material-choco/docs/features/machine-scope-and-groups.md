# Machine selection and groups

Choose which machines the pages show and act on, and label machines with groups.

## What it is

The selector in the top bar reads **All machines** with a count. Its menu ticks machines on and off. Pages then show one card per selected machine, and commands run on the selection. Option dialogs and the Console have their own **Run on** list, pre-filled from the selection.

Each machine has a display name and up to 12 groups, which are free text labels. Schedules can target a group.

## How to use it

- Use the selector to narrow to one machine or a few. Choosing a machine in the command palette selects it and opens its packages.
- On **Machines**, open a machine's menu and choose **Rename, groups, policy** to edit the name and the groups, separated by commas. Admins also set read only and the [allowed commands](command-allow-lists.md) there.
- Tick machines in the table for [bulk actions](bulk-actions-and-exports.md): refresh, upgrade, make read only, allow changes, remove.
- The Machines table shows status, CLI version, package count, updates and groups, and can be filtered by text, **Online** and **Has updates**.

## What was checked

The end to end run uses two machines throughout, and the check `two agents enrolled and reported inventory through the bundled CLI` covers the table. Group targeting is covered by the schedule test `schedules create jobs at their time, once per day` only for the all-machines target.

## Known limits

- The selection lasts while the page is open. It is not saved between visits.
- Group targeting of schedules has no dedicated check.

## Related

- [Schedules](schedules.md)
- [Pairing](pairing.md)
- [Overview](overview.md)
