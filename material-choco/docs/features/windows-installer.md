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

- Installed, used, updated and uninstalled on Windows 11 on 2026-11-16. The installer needs no administrator rights; it installs for the current user into `%LOCALAPPDATA%\MaterialChoco`.
- Not code signed: `Get-AuthenticodeSignature` reports `NotSigned`. Compare the SHA-256 sums in the release notes instead.
- In 0.1.16 and earlier the app does not open by itself after installing; start it from the Start menu.
- Uninstalling removes the install folder, the shortcuts and the packages installed through the app. The app's data folder `%APPDATA%\Material Choco` stays.
- `build.bat` and `build-installer.bat` were run from a clean clone on Windows; see [Build and test](../articles/build-and-test.md).
- No delta packages.

## Related

- [Desktop app](desktop-app.md)
- [Bundled CLI](bundled-cli.md)
- [Build and test from source](../articles/build-and-test.md)
