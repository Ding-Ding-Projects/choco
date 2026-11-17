# Handoff: Material Choco

Date: 2026-11-16. Branch: `main`. This file states what exists, what was checked and with what result, and what was not checked. Nothing here is a claim beyond the row that makes it.

## What exists

- `material-choco/`: the desktop app, the hub, the agent, the shared interface, tests, documents and the landing site.
- `design/material-choco/`: the design canvas export with a board for every catalogue feature.
- Workflows `.github/workflows/material-choco-release.yml` and `.github/workflows/material-choco-site.yml`.
- Root files `README.md` (rewritten for this fork), `AGENTS.md` and `CLOSEOUT_PROMPT.md`.
- No file of the Chocolatey CLI itself was changed.

## The first run on Windows (2026-11-16)

Machine: a physical Windows 11 Pro computer (build 26200) that already had a system Chocolatey 2.7.3 with 26 packages, Node.js 26, Docker and several .NET SDKs. The app was run on a separate, hidden desktop and driven through its window; nothing ran elevated.

| Step | Result |
| --- | --- |
| Download release `material-choco-v0.1.16` and compare with the release notes | `Setup.exe`, the full `.nupkg` and `RELEASES` all match their published SHA-256 sums. `Get-AuthenticodeSignature` reports `NotSigned`. The release is a normal release (not draft, not prerelease). |
| Install with `Setup.exe` | Installed for the current user into `%LOCALAPPDATA%\MaterialChoco` with Start menu and desktop shortcuts, no administrator prompt. **The app did not open afterwards** (fixed, see below). |
| First run | The wizard ran all four steps with Next and Done. Step 1 reported "Bundled Chocolatey CLI 2.8.0-beta202611-20261116-c1baab2f is ready" from `%LOCALAPPDATA%\MaterialChoco\chocolatey\choco.exe`. |
| Helper files | The bundled CLI's `helpers` (35 PowerShell function files), `redirects`, `tools`, `config` and `logs` are in the app-owned folder; `lib` and `bin` appear with the first package. The Machine `ChocolateyInstall` variable still points at the system Chocolatey, and the system package list was byte for byte unchanged after every step. |
| Install from the Console | `choco install jq --version=1.7.1`: exit 0 in 33 s, the success takeover appeared, `jq.exe --version` printed `jq-1.7.1` from the app's own `bin`. |
| Upgrade from Installed | The row showed "1.8.2 available"; Upgrade: exit 0 in 36 s, success takeover, `jq-1.8.2`. |
| A failing install | `choco install` of a package that does not exist: exit 1, the failure takeover with the real CLI output, staying until closed. |
| Pin, unpin | Pin `jq` from the Pins page and Unpin: both exit 0; `choco pin list` agreed each time. |
| Source and feature | The community source off and on, and `showDownloadProgress` off and on, from their switches; `choco source list` and `choco feature list` agreed. **A second press while the first job ran queued the same command again** (fixed). |
| Uninstall | From the row menu with both keys and the slider: exit 0; `lib` and `bin` empty afterwards. |
| Personal wording file | Dropped on the window: the celebration showed, all entries were stored, and the role chip changed. |
| Automatic update | An installed 0.1.15 (sums checked) found 0.1.16 31 s after starting, downloaded it into `app-0.1.16` and showed "Update 0.1.16 has been downloaded and installs when the app restarts. This build is not code signed ...". The next start through the Start menu launcher ran 0.1.16. Restart itself was not pressed: **the notice had disappeared after 60 s** (fixed). |
| Hub | The published image `material-choco-hub:0.1.16` ran with the repository's Compose file, healthy, reporting version 0.1.16 and commit `c1baab2f` on the LAN address. The desktop app paired with a one time code (plain HTTP allowed for the LAN). From a browser at 375 px wide (an emulated phone), `choco install jq` was sent to the machine and finished with exit 0 in 34 s, with the success takeover on the phone layout. |
| Passkeys | Not tried with a real device. The hub reports passkeys unavailable over plain HTTP on a LAN address, which browsers require; this needs the hub on HTTPS with a certificate the phone trusts. |
| Uninstall the app | `Update.exe --uninstall` removed the install folder, both shortcuts and the uninstall entry; PATH, `ChocolateyInstall` and the system Chocolatey were unchanged. **The data folder `%APPDATA%\Material Choco` (settings, hub data, history) stays**, and the packages installed through the app are deleted with the install folder. |
| `scripts\fetch-deps.bat` in a clean clone | Failed at the schema check on a CRLF checkout (fixed); then 4 of 4 steps. |
| `build-installer.bat` in a clean clone | Failed five ways (fixed, see below); then built the CLI from source (version 2.3.0, its unit tests included), the schema, the npm packages and the UI bundle, and produced an unsigned `Material Choco Setup 0.1.0.exe`, the full package and `RELEASES` in 408 s. |
| `build.bat` in a clean clone | Built with a downloaded, checksum-verified Node.js 22 and started the app, whose first-run check passed. |

Every CLI call took about 25 seconds on this machine, even `pin add`; the automated checks with the stand-in hid that completely.

After these fixes were pushed, release `material-choco-v0.1.17` (built from `77d36440`; its three files matched their published SHA-256 sums) was installed on the same machine: it opened by itself when the installer finished, and after a restart it came back on the same local address with the first-run wizard still marked done. It was then uninstalled, and the machine matched the state recorded before the first install.

### Problems the Windows run found, fixed in this change

1. The app quit right after `Setup.exe`, because it treated `--squirrel-firstrun` as an install event.
2. Settings, the finished first-run wizard and the personal wording file were lost at every start: the built-in hub took a new port each time, and browser storage belongs to the origin. The port is now kept in the data folder and reused.
3. The source and feature switches snapped back while their job ran, so a second press queued the same command. They now show the requested state and stay locked until the inventory is read again.
4. The config page said "12 of 11": settings the machine reports beyond the schema are now counted in the total.
5. The hub link card kept saying "disconnected" after a successful pairing.
6. The update notice vanished after 60 seconds; it now stays until closed.
7. `build.bat` on a released commit: the CLI build took the release tag as its version and restore failed silently. A tagged commit is now built from a local copy without tags in `%LOCALAPPDATA%\mcb` (a short name, because the CLI's test files come close to the 260 character path limit).
8. `build.bat` then failed packing the CLI (`2.3.0-` is not a valid package version on a local `main` checkout). The packing steps are skipped; the app only needs `choco.exe`.
9. Node.js 26 left Electron unpacked during `npm ci`. `build.bat` now uses a portable Node.js 22, checked against its published SHA-256, when the PATH has another version.
10. npm 11 skips install scripts unless they are approved; `package.json` approves the Electron and esbuild versions in use.
11. Started from PowerShell 7, the CLI build failed in its script analyser (the module path of PowerShell 7 was inherited). `build.bat` clears that variable for the CLI build.
12. The schema, API reference and site `--check` modes failed on a checkout with CRLF line endings.
13. The tests could not run on Windows: the stand-in CLI is a Node.js script, now started through Node.js on Windows by a test-only switch (`MATERIAL_CHOCO_CLI_NODE`, set only by `test/fixtures/stand-in.js`). The end to end captures no longer follow the machine's dark or light theme.

## Checks and their results

| Check | Result | When |
| --- | --- | --- |
| `npm test` | 95 of 95 pass on Windows (before the fixes it was 76 of 81, with one test file not loading) | 2026-11-16 |
| `node test/e2e/run.mjs` (real interface in headless Chrome, real hub and agent processes, stand-in CLI) | 124 of 124 on Windows, including the three search checks below; the screenshots in `docs/screenshots` were retaken there | 2026-11-16 |
| Search guards: `every page that has something to search has a search with a Regex switch and a pattern builder`, `the Settings search finds a setting in a category other than the open one`, `the Console command search narrows the commands, and Regex applies a pattern`; on the site `site/tools/check-searches.mjs` | pass; each was seen failing with one search removed (the Sources search, a site search) and passing once it was restored | 2026-11-16 |
| `node test/e2e/demo.mjs` | 26 of 26 on Windows, including two new checks that failed on the old code: a schedule runs at its time (it did not run), and the banner on a phone is at most 80 px tall (it was 133 px) | 2026-11-16 |
| `node test/e2e/clipping.mjs` | 36 of 36 sizes on Windows; it was 15 of 36. See the note under "Not verified" | 2026-11-16 |
| Schema, API reference and site checks | match, on Linux and on a Windows CRLF checkout | 2026-11-16 |
| Release workflow | green for every push; newest release at the time of the Windows run was 0.1.16 | 2026-11-16 |
| Site feature index at 390 px wide | 4,820 px tall, was 10,301 px; no sideways scroll | 2026-11-16 |
| Public text scan for private wording | every changed text file and the commit messages pass | 2026-11-16 |

The earlier Linux results (95 of 95, 121 of 121, the site checks, the hub container and the first workflow runs) are in the history of this file.

### Search on every page (2026-11-16)

Every page and category that lists something now has a search with its own Regex switch and pattern builder (the list is in `docs/features/filters-and-regex.md`); Settings searches across all its categories. Only Base64 tools has none, because it shows no list. The work was done by four implementers with separate files, then reviewed in three rounds per area from three angles (function, accessibility and language, layout). The review did not run dry: the third round still found 11 to 18 issues per area, none rated high, and they were fixed, but those last fixes were not reviewed again. The full check run after them passed everything listed above. 139 new sentences were translated into Cantonese.

## Not verified

- A build on a Windows machine with nothing installed: the machine used already had the .NET SDK and the Visual Studio build tools that the CLI build needs, and `build.bat` does not install them.
- Pressing Restart in the update notice (it vanished before it could be pressed; it now stays). Delta updates do not exist.
- Passkeys with a real device, and the hub on HTTPS through `MATERIAL_CHOCO_TLS_CERT` and `MATERIAL_CHOCO_TLS_KEY`.
- A physical phone: the phone checks used a browser at phone width on the same computer.
- Working without a network, and packages that run a system installer (they need Restart as administrator, which was not used).
- The clipping check finds only things that are too wide. At 200 percent text the top bar's labels overlapped the row below; that was found by looking at a capture and fixed, not by the check.
- On a phone at 200 percent text the bottom bar labels are shortened ("Ov…"); the buttons keep their full names for screen readers.
- Screen readers, display scaling beyond the checked factors, and reduced motion by audit.
- Status webhooks to a real chat service; an independent security review.
- `--limit-output` row formats for `apikey list`, `template list` and `rule list` were written from the source, not seen.
- Every push to any branch publishes a normal release that the installed apps update to. A work-in-progress branch therefore cannot be pushed as a backup without shipping it.

## Remaining work

See `ROADMAP.md`. The state of every required feature is in `docs/FEATURE-INVENTORY.md`: 16 done, 64 partial, 24 not built, 12 not applicable, 2 waived, of 118. The largest open items are the features that do not exist at all: the per-element appearance editor, element locks with the recovery desk, extension support, the other built-in tools, Status Hub registration, screen recording, and the project board and discussions (manual steps in `docs/REPOSITORY-SETUP.md`).

## History of this build

- 2026-11-15: first version. Desktop app, hub, agent, every CLI command from the generated schema, two key confirmation, three language modes.
- 2026-11-16: full-screen results for installs and upgrades; Base64 tools, pattern builder, bulk actions and exports, timed settings, custom logo and presets, changelog viewer, QR code for pairing, keyboard shortcuts, context menu, tab reordering, Cantonese coverage, update notice.
- 2026-11-16: hub hardening: passkeys with password fallback, roles, per-machine allow lists, status webhooks, secrets encrypted at rest.
- 2026-11-16: **authenticator codes removed by decision of the maintainer**, and the matching QR code entry waived; both confirmed by the maintainer the same day.
- 2026-11-16: landing site, demo, release code names and checksums.
- 2026-11-16: first install and use on Windows; the fixes listed above; no clipping at any checked size.

## Design pass notes

See `design/material-choco/README.md`.
