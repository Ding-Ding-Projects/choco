# Pairing

A one time code joins a Windows machine to a hub.

## What it is

On the **Machines** page the hub creates a code of the form `XXXX-XXXX`, drawn from an alphabet without look-alike characters. It works once and expires after 10 minutes. The hub stores only a hash of it. When a machine presents the code, the hub gives it a random token for all later requests and keeps only the token's hash.

## How to use it

1. On the hub: **Machines**, **New pairing code**. Turn on **Read only agent** first if the machine should refuse changes.
2. On the machine: in the app, **Machines**, **Connect this PC to a hub**, or on a server `MaterialChoco.exe --agent enroll --hub <address> --code <code>`.

The page shows the exact command, including the hub address. A fold under the code draws a QR code that holds the hub address and the code, so another device can read them without typing. It is drawn in the page and not sent to any service. The second step of the hub's first-run wizard also creates a code.

## What was checked

- Test `agent enrolls with a one time code and reports inventory from the bundled CLI` in `test/hub.test.js`.
- End to end checks `a pairing code works only once` and `pairing QR code is drawn`.

## Known limits

- The desktop app does not scan the QR code yet: type the code there.
- A code is not tied to one machine: whoever enters it first within 10 minutes is paired. Share it over a channel you trust.
- Repeated wrong codes from one address are locked out for a growing time.

## Related

- [Pairing and remote agents](../articles/pairing-and-remote-agents.md): the guide
- [Remote agent](remote-agent.md)
- [Read only agents](read-only-agents.md)
