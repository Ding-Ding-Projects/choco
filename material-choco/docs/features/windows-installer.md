# Windows installer

A Squirrel.Windows `Setup.exe`, built by the release workflow with the repository's own Chocolatey CLI inside. It is not code signed.

## What it is

`.github/workflows/material-choco-release.yml` runs on a hosted Windows runner. It builds the CLI from this repository, packs it into the app as a resource, and builds the installer for 64-bit Windows. It publishes `Setup.exe`, `RELEASES` and the full `.nupkg` as a GitHub release whose tag starts with `material-choco-v`. The same workflow builds and pushes the hub image.

On Windows, `build-installer.bat` in the `material-choco` folder is meant to produce the same installer locally in `dist\squirrel-windows`.

## How to use it

Download `Setup.exe` from the [project site](https://ding-ding-projects.github.io/choco/) or the [releases page](https://github.com/Ding-Ding-Projects/choco/releases) and run it. Windows may warn about an unknown publisher because the file is unsigned.

## What was checked

[HANDOFF.md](../../HANDOFF.md) records the first green run of the workflow, the version the freshly built `choco.exe` printed on the runner, and the release it published with the installer, `RELEASES` and the `.nupkg`.

## Known limits

- **Built, not installed.** Nobody has run the installer on Windows or started the installed app.
- Not code signed. There is no signature to verify; download only from the releases page of this repository.
- `build.bat` and `build-installer.bat` were written on Linux and have not been run on Windows.
- No delta packages.

## Related

- [Desktop app](desktop-app.md)
- [Bundled CLI](bundled-cli.md)
- [Build and test from source](../articles/build-and-test.md)
