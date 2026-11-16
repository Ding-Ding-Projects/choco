# Material Choco roadmap

A box is ticked only when the item works and was exercised. Every tick below was exercised with a test stand-in for `choco.exe`, on Linux, unless the line says otherwise. See `docs/FEATURE-INVENTORY.md` for the required-feature catalogue.

## 0.1: first working build

- [x] Schema of every CLI command and option generated from the C# source, with a drift test
- [x] CLI wrapper with validated arguments and no shell
- [x] Hub: setup, sign in with a password, lockout, sessions
- [x] Agents: one time pairing, long polling, live output, cancel, read only mode
- [x] Job queue for offline machines (the 7 day expiry is written and has no test)
- [x] Schedules
- [x] Pages for installed, discover, updates, sources, config, features, pins, API keys, cache and templates, package builder, console, jobs, history, help, settings
- [x] Two key confirmation for destructive actions
- [x] Three language modes, theme from a seed colour, command palette, accessibility tools
- [x] Full-screen results for installs and upgrades
- [x] Hub container image built and run locally, agent connected to it
- [x] Desktop app started once on Linux under a virtual display
- [x] Design files in `design/material-choco`

## 0.2: prove it on Windows

- [x] Release workflow green: CLI built from this repository, installer and hub image published (run 43807632449, release `material-choco-v0.1.2`, later versions since)
- [x] Install from `Setup.exe` on Windows and run a real install, upgrade and uninstall with the bundled CLI (Windows 11, 2026-11-16; the machine was not a clean one: it already had Chocolatey, which the app left untouched)
- [x] Confirm the bundled CLI unpacks its helper files into the app-owned folder on first run
- [x] Run `build.bat` and `build-installer.bat` on Windows, from a clean clone (five fixes were needed; see HANDOFF.md)
- [ ] Recapture every screenshot on Windows with the real CLI (the end to end captures were retaken on Windows with the stand-in CLI; four captures of the installed app with the real CLI were added)
- [x] See an automatic update download and install on Windows (0.1.15 to 0.1.16; the next start ran 0.1.16)
- [ ] Press Restart in the update notice and see the new version start (the notice used to vanish after a minute; it now stays)
- [ ] Build on a Windows machine with nothing installed
- [ ] Run a headless agent on Windows, and decide whether to install it as a service (the desktop app's own agent was paired with a hub and ran a job)

## 0.3: hub hardening

- [x] Passkeys with password fallback (verified with a software passkey device and Chrome's virtual one, not a real device)
- [x] More than one user, with admin, operator and viewer roles
- [x] Per-machine command allow list, enforced in the hub and in the agent
- [x] Encrypt secret option values and webhook addresses at rest (the key lies in the data folder unless moved)
- [x] QR code for pairing a machine
- [x] Status webhooks for failed jobs, offline machines and sign in lockouts
- [x] Pair a Windows machine with the published hub image and run a job on it from a phone-width browser (2026-11-16)
- [ ] Sign in with a passkey on a real device, by a person (needs the hub on HTTPS: over plain HTTP on a LAN address browsers do not offer passkeys)
- [ ] Deliver a webhook to a real chat service
- [ ] Limit a user to some machines
- [ ] Signed agent updates
- [ ] Rotation of the key for secrets at rest
- [ ] Exercise HTTPS through the two certificate variables in a recorded check
- [ ] Independent security review

## 0.4: interface

- [x] Pattern builder beside every regex switch
- [x] Tabs: close, pin, reorder by drag and by keyboard
- [x] General context menu on elements without their own
- [x] One list of keyboard shortcuts, shown in menus, the palette and Help
- [x] Bulk actions on packages, machines, sources and jobs; export of lists as CSV, JSON and Markdown
- [x] Timed settings for six settings, and a theme schedule
- [x] Custom logo and appearance presets with undo
- [x] Changelog viewer with a filter
- [x] Base64 tools
- [x] Personal wording file reaches notifications, error panels and full-screen results
- [ ] Translate the older pages that still hold English sentences
- [ ] Tab groups and docking
- [x] No clipping at 6 widths, 3 scale factors and text at 100 and 200 percent (36 of 36 sizes, 2026-11-16)
- [ ] Screen reader pass
- [ ] Teach the clipping check to find overlaps, not only things that are too wide
- [ ] Capture and review the reduced motion path

## Site and documents

- [x] Landing site live, with a download button that finds the newest installer, guides, a page per feature, a gallery and a command palette
- [x] Site measured at 320 to 1360 px in emulation with no sideways scroll
- [x] Site split into separate pages (features, screens, remote hub, download, guides, status, demo), with a copy button on every code block
- [x] In-browser demo assembled into the site at `demo/` and loaded locally with no outside requests (its behaviour is checked by the app's own tests, not by the site checks)
- [x] One document per shipped feature, and how-to guides
- [x] Repository website field points at the site
- [x] Demo schedules run at their time, and the demo banner takes one line on a phone (checked by `test/e2e/demo.mjs`)
- [x] Feature index: a category bar, and on a phone 4,820 px instead of 10,301 px (measured at 390 px wide)
- [ ] Test the site on a physical phone and in other browsers
- [ ] Upload the link preview picture as the repository's own preview, and test a shared link in a chat app
- [ ] Language modes on the site

## Decided against

- **Authenticator codes.** The built-in authenticator and the one time code step at sign in were built and then removed on 2026-11-16 by decision of the maintainer. Sign in is a password or a passkey.
- A root-level `build.bat` for this app: the repository root already has the Chocolatey CLI's own `build.bat`.

## Later: the rest of the required-feature catalogue

Not started: extension support, per-element appearance editor and locks, the recovery desk and unlock steps, the file converter and the other built-in tools, a screen recording, status reporting integrations, release code names. The inventory lists each one.
