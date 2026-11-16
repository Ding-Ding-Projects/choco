# Material Choco roadmap

A box is ticked only when the item works and was exercised. See `docs/FEATURE-INVENTORY.md` for the required-feature catalogue.

## 0.1: first working build

- [x] Schema of every CLI command and option generated from the C# source, with a drift test
- [x] CLI wrapper with validated arguments and no shell
- [x] Hub: setup, sign in, authenticator codes, lockout, sessions
- [x] Agents: one time pairing, long polling, live output, cancel, read only mode
- [x] Job queue for offline machines, 7 day expiry
- [x] Schedules
- [x] Pages for installed, discover, updates, sources, config, features, pins, API keys, cache and templates, package builder, console, jobs, history, help, settings
- [x] Two key confirmation for destructive actions
- [x] Three language modes, theme from a seed colour, command palette, accessibility tools
- [x] Hub container image built and run locally, agent connected to it
- [x] Desktop app started on Linux under a virtual display
- [x] Design files in `design/material-choco`

## 0.2: prove it on Windows

- [x] First green run of the release workflow (run 43807632449, release `material-choco-v0.1.2`)
- [ ] Install from `Setup.exe` on a clean Windows machine and run a real install, upgrade and uninstall with the bundled CLI
- [ ] Confirm the bundled CLI unpacks its helper files into the app-owned folder on first run
- [ ] Run `build.bat` and `build-installer.bat` on Windows
- [ ] Recapture every screenshot on Windows with the real CLI
- [ ] Automatic updates from the Squirrel feed

## 0.3: hub hardening

- [ ] Passkeys with password fallback
- [ ] More than one user, with roles
- [ ] Per-machine command allow list
- [ ] Encrypt queued job secrets at rest
- [ ] QR code for pairing and for authenticator setup

## Later: required-feature catalogue

- [ ] Full translation of every page, and playful variants for every message
- [ ] Regex builder beside every search
- [ ] Tab groups, drag reorder, docking
- [ ] Context menu, info button and guide on every control
- [ ] Per-element appearance editor and locks
- [ ] Scheduled settings
- [ ] Landing site with a verified download button
- [ ] Status reporting integrations
- [ ] The built-in tools set

## Deliberately not doing

- A root-level `build.bat` for this app: the repository root already has the Chocolatey CLI's own `build.bat`.
