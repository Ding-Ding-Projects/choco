# Jobs and live output

Every command becomes a job with a state, live output, an exit code and a log you can export.

## What it is

A job is one command on one machine. Its states are queued, running, succeeded, failed, cancelled and expired. Output is streamed from the agent while the command runs and is kept by the hub as the job's log.

## How to use it

Open **Jobs** (`Ctrl+Shift+J`). The list on the left filters by text, **Active**, **Failed** and **Hide inventory reads**. Selecting a job shows:

- the command, who requested it, and when it was requested, started and ended;
- a panel for its state: live progress with **Cancel**, a success panel with the exit code, or a failure panel with **Run again**, **Copy output** and **Refresh inventory**;
- the output, with **Export log** and **Copy**.

Tick several jobs to cancel them together or save their logs. Notifications for your own jobs have an **Open** button that jumps here.

## What was checked

- Tests `a job runs on the agent, streams output and refreshes inventory` and `a failing command reports its exit code` in `test/hub.test.js`.
- End to end checks `job page shows the success state with exit code` and `failed job shows exit code and output`.

## Known limits

- A job is stopped after 240 minutes, and the hub keeps at most 2 MB of output per job.
- **Run again** opens the Console on the same command; the original options are not restored.
- If the hub restarts while a job runs, the job is marked failed with a note that its result is unknown.
- Cancelling stops the `choco` process. What a half-finished install leaves behind is up to the package.

## Related

- [Offline job queue](offline-job-queue.md)
- [Install result takeovers](install-result-takeovers.md)
- [Jobs, schedules and history](../articles/jobs-schedules-and-history.md): the guide
