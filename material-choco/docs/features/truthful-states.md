# Loading, empty, offline and error states

Every page says what is actually true: loading, nothing here yet, offline, or failed and why.

## What it is

- **No sample data.** Before a machine is paired, pages say nothing is enrolled and offer the button to pair one.
- **Loading** shows placeholder rows while an inventory or a command result is on its way.
- **Offline** machines keep their last inventory, labelled with its time and a note that it may be stale. When the live connection to the hub itself drops, the page reconnects by itself and reloads its data when the link returns.
- **Errors** appear in place: a panel with what failed, the exit code or message, the output where there is one, and a way to retry. A page that throws shows the error and the rest of the app keeps working.
- **CLI not available** is its own state on a machine card, with the reason from the agent.

## How to use it

Nothing to set up. When you see an error panel, its buttons are the recovery actions: try again, open the full log, refresh the inventory.

## What was checked

End to end checks `empty state is truthful before any machine`, `failed job shows exit code and output` and `no browser console errors during the run`.

## Known limits

- The states were checked in the situations the end to end run creates. Network failures in the middle of a request were not simulated.

## Related

- [Overview](overview.md)
- [Jobs and live output](jobs-and-live-output.md)
- [Notifications](notifications.md)
