# Hub

A web app that manages many Windows machines from one place. The same server also runs inside the desktop app for the local PC.

## What it is

The hub serves the interface, keeps the list of machines, queues jobs, runs schedules and records history. It is one Node.js process with no runtime dependencies. Machines connect out to it as agents; the hub itself never runs `choco`.

It stores its data as files in one folder: the store, one log per job, and the history. Live updates reach the browser over a server-sent event stream, so pages change as machines and jobs change.

In the desktop app the same server runs in-process on `127.0.0.1` with the local PC as a built-in machine named **This PC**.

## How to use it

Run it in a container, open it in a browser, create the administrator, then pair machines. See [Running the hub in a container](../articles/hub-in-a-container.md).

## What was checked

`npm test` starts a real hub in-process for every test in `test/hub.test.js`. The end to end run starts the hub as a separate process and drives it through a browser. [HANDOFF.md](../../HANDOFF.md) records the results.

## Known limits

- Three fixed roles for users. There is no limiting of a user to some machines.
- The store is a set of files written by a single process. Running two hubs on the same data folder is not supported.
- The hub keeps the newest 2,000 jobs.

## Related

- [Hub container image](hub-container.md)
- [Sign in](sign-in.md)
- [Users and roles](users-and-roles.md)
- [Status webhooks](status-webhooks.md)
- [Hub HTTP API](hub-http-api.md)
