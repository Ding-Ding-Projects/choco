# Schedules

Run a command every day, or on chosen days of the week, on all machines, a group, or a chosen set.

## What it is

A schedule belongs to the hub. It has a name, a command, a target, a time of day and optional days of the week. At that time the hub creates one job per target machine, once per day.

## How to use it

Open **Schedules**, **New schedule**:

- **What to run:** upgrade all packages, or refresh the inventory. To schedule any other command, build it in the Console and press **Schedule** there.
- **Where:** all machines, including ones paired later; the machines selected right now; or a group.
- **Time of day** is in the hub's time zone, which the form names. No day selected means every day.

Each schedule has a switch to pause it and shows when it last ran. Offline machines get the job when they return, within 7 days. Read only machines are skipped for commands that change them.

## What was checked

Test `schedules create jobs at their time, once per day` in `test/hub.test.js`.

## Known limits

- One time per day per schedule. No intervals and no cron expressions.
- The time follows the hub's clock. Around a daylight saving change a schedule can run an hour off or be skipped that day.
- If the hub is down at the scheduled minute, that day's run is missed and is not made up.

## Related

- [Console](console.md)
- [Offline job queue](offline-job-queue.md)
- [Machine selection and groups](machine-scope-and-groups.md)
