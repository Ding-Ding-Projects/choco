# History

An append-only record of who did what on the hub, with export.

## What it is

The hub writes a line for each event: setup, sign ins and failed sign ins with the address, pairing codes created, machines enrolled, changed and removed, jobs created and how they ended, schedule changes and runs, password and passkey changes, user and role changes, and webhook deliveries. Lines are only ever added.

## How to use it

Open **History**. The table shows when, who, the action and its details, newest first. Filter by text or a regular expression. The export button saves it as CSV, JSON or a Markdown table, and follows the active filter.

## What was checked

- Test `history is recorded and secrets stay out of it` in `test/hub.test.js`.
- End to end checks `history records actions` and `history export honours the active filter`.

## Known limits

- Append-only describes how the hub writes the file. Someone with access to the hub's data folder can still edit it; the record is not signed or chained.
- The page loads the newest 2,000 entries.
- There is no retention setting. The file grows until whoever operates the hub archives it.

## Related

- [Secret masking](secret-masking.md)
- [Jobs and live output](jobs-and-live-output.md)
- [Sign in](sign-in.md)
