# Overview

The first page: what needs attention across the selected machines, and one button to upgrade everything.

## What it is

A banner states how many updates are ready, or that everything is up to date, with the **Upgrade everything** button and whether jobs are running. Below it are four counts: machines enrolled and how many are online, packages installed, updates available, and jobs running now. **Needs attention** lists machines with outdated packages, offline machines and recent failed jobs, each with an action. **Recent jobs** shows the latest commands and a small live line of active jobs, sampled every 2 seconds.

## How to use it

Open the app: it starts here. Use the machine selector to narrow the counts. Each row in **Needs attention** has a button that takes you to the fix.

## What was checked

End to end checks `overview counts real updates` and `empty state is truthful before any machine`.

## Known limits

- The live line is a simple sparkline. It cannot be scrubbed or read out point by point.
- Counts come from the last inventory of each machine.

## Related

- [Updates](updates.md)
- [Machine selection and groups](machine-scope-and-groups.md)
- [Loading, empty, offline and error states](truthful-states.md)
