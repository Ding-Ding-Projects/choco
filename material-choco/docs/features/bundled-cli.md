# Bundled Chocolatey CLI

The Chocolatey CLI built from this repository ships inside the app, so there is nothing to install before the first command.

## What it is

The installer carries a `choco.exe` that the release workflow builds from the source in this repository. On first use the app copies it to a folder it owns and runs every command with `ChocolateyInstall` pointing there:

- `%ProgramData%\MaterialChoco\chocolatey` when the app runs as administrator and can write there, or when that folder already exists.
- `%LOCALAPPDATA%\MaterialChoco\chocolatey` otherwise.

The copy is refreshed when the bundled file changes, for example after an app update. A Chocolatey you installed yourself is not touched. Because the build does not come from Chocolatey Software, the agent adds `--allow-unofficial-build` to every command.

## How to use it

You do not have to do anything. The first step of the first-run wizard starts the bundled CLI and shows its version, its path and the number of packages found. Every machine card shows the CLI version it reported.

If the CLI cannot be started, pages show **Chocolatey CLI is not available** with the reason and a **Try again** button, instead of an empty list.

## What was checked

- The release workflow built the CLI on a Windows runner and `choco.exe --version` printed a version there, as recorded in [HANDOFF.md](../../HANDOFF.md).
- Test `agent enrolls with a one time code and reports inventory from the bundled CLI` in `test/hub.test.js` and the end to end check `two agents enrolled and reported inventory through the bundled CLI` exercise the copy-and-run path, with the test stand-in in place of `choco.exe`.

## Known limits

- The installed app has not been started on Windows, so the real `choco.exe` has not yet been run by the app.
- Whether the CLI unpacks its helper files correctly when `ChocolateyInstall` points at the app-owned folder is unconfirmed.
- A development checkout has no bundled CLI. See [Build and test from source](../articles/build-and-test.md).

## Related

- [Getting started on one PC](../articles/getting-started.md): the first run
- [First-run wizard](first-run-wizard.md): where the CLI is checked
- [Windows installer](windows-installer.md): how the CLI gets into the installer
