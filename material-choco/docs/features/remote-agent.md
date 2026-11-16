# Remote agent

The part of the app that connects a Windows machine to a hub, runs the jobs it is given, and streams the output back.

## What it is

Once paired, the agent long-polls the hub. For each job it validates the request, runs the bundled `choco` without a shell, sends output while the command runs, reports the exit code, and re-reads the inventory after a command that changes the machine. It runs one job at a time.

The agent is part of the desktop app and also runs without a window:

```
MaterialChoco.exe --agent enroll --hub https://hub.example:8443 --code XXXX-XXXX
MaterialChoco.exe --agent run
MaterialChoco.exe --agent status
MaterialChoco.exe --agent disconnect
```

`enroll` also accepts `--name`, `--read-only`, `--allow-insecure` and `--allow` with a list of commands the agent will accept; see [command allow lists](command-allow-lists.md).

## How to use it

Pair the machine, then keep the app open or keep `--agent run` running. A machine is shown as online when the hub heard from it in the last 75 seconds.

The agent refuses `http://` hub addresses unless the hub is on the same computer or you opt in with `--allow-insecure`. If the hub stops accepting its token, the agent stops and says it must be enrolled again. If the hub is unreachable, it retries with a delay that grows to 30 seconds.

## What was checked

- Tests `a job runs on the agent, streams output and refreshes inventory`, `a failing command reports its exit code`, `invalid commands never reach an agent` and `removing a machine revokes its agent` in `test/hub.test.js`.
- End to end checks `two agents enrolled and reported inventory through the bundled CLI` and `unknown agent token is refused`.

## Known limits

- No agent has run on Windows against the real `choco.exe` yet. In the checks the agents ran on Linux with the test stand-in.
- `--agent run` stays in the foreground. No Windows service is installed.
- Agent updates are not signed.

## Related

- [Pairing](pairing.md)
- [Jobs and live output](jobs-and-live-output.md)
- [Bundled CLI](bundled-cli.md)
