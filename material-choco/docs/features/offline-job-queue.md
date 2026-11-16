# Offline job queue

A command for a machine that is switched off waits for it, for up to 7 days.

## What it is

Jobs are queued on the hub per machine. An agent takes its next job when it connects. If a machine stays offline, its jobs stay queued. A job that has waited 7 days is marked **expired** with the note that the machine did not come online.

## How to use it

Nothing special: run a command as usual. The Jobs page says of a queued job either that it is waiting for the agent to pick it up, or that the machine is offline and the job waits up to 7 days. **Cancel** removes a queued job. Removing a machine from the hub cancels its queued jobs.

Inventory shown for an offline machine is the last one it reported, labelled with its time.

## What was checked

The queue is exercised by every job test in `test/hub.test.js`, since each job is queued before an agent takes it. The 7 day expiry is implemented in `hub/server.js` and has no dedicated named check.

## Known limits

- The expiry has not been exercised by a test.
- Queued jobs are stored in the hub's data folder until taken. Option values marked secret are encrypted there; everything else in a job is stored as it is. See [secrets at rest](secrets-at-rest.md).
- Jobs run in the order queued. There is no priority.

## Related

- [Jobs and live output](jobs-and-live-output.md)
- [Schedules](schedules.md)
- [Secret masking](secret-masking.md)
