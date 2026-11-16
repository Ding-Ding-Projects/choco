# First-run wizard

A four step setup that does real work on the first start, and can be skipped.

## What it is

The wizard opens once, after the first sign in on a hub or the first start of the desktop app.

1. **Chocolatey CLI.** On the desktop app it starts the bundled CLI and reports its version, path, package count and whether the app runs as administrator. On a hub it explains that the hub does not run `choco` itself.
2. **Hub link** on the desktop app (optional), or **First machine** on a hub, which creates a pairing code right there.
3. **Language and look.** Language mode and theme, applied as you choose.
4. **Finish.** The two shortcuts worth knowing.

## How to use it

**Next** and **Back** move between steps. **Skip for now** closes it at any step. Closing it in any way marks it as done; everything in it is also in Settings and on the Machines page.

## What was checked

End to end check `first run wizard opens after setup`. The desktop variant was captured once on Linux under a virtual display, as recorded in [HANDOFF.md](../../HANDOFF.md).

## Known limits

- The wizard does not reopen by itself. To see it again, reset the settings of the device under **Settings**, **Data and export**, and reload.
- Progress within the wizard is not saved if you close it halfway.

## Related

- [Getting started on one PC](../articles/getting-started.md)
- [Bundled CLI](bundled-cli.md)
- [Pairing](pairing.md)
