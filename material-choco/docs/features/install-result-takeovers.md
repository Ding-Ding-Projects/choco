# Install result takeovers

Every install or upgrade that finishes takes over the screen: a celebration on success, an alarm with the exit code and the last output on failure.

## What it is

When a `choco install` or `choco upgrade` job ends as succeeded or failed, a full-screen overlay shows the result, the command, the machine and the exit code. Dry runs with `--what-if` are left out.

- **Success** closes by itself after about five seconds, or with a click, `Escape`, `Enter` or `Space`. Further successes that arrive while it is open are counted on the same screen.
- **Failure** shows the last eight lines of output and stays until dismissed with **Close** or `Escape`. **Open the full log** jumps to the job. Several failures are shown one after another.

The trigger is the hub's live event stream, so installs started in another browser or by a schedule also take over.

## How to use it

It is on by default. To turn it off: **Settings**, **Appearance**, **Full-screen install results**. The focus mode **Low stimulation** also turns it off. Results then arrive as notifications.

## What was checked

End to end checks `upgrade success takes over the screen`, `success takeover closes with Escape`, `install failure takes over with exit code and output`, `failure takeover stays until dismissed`, `an install started elsewhere also gets the takeover`.

## Known limits

- With reduced motion the confetti and shards are not created. That path was written by rule and not captured.
- Install and upgrade only.

## Related

- [Install result takeovers](../articles/install-result-takeovers.md): the guide
- [Notifications](notifications.md)
- [Focus modes](focus-modes.md)
