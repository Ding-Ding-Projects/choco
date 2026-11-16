# Handoff: Material Choco 0.1.0

Date: 2026-11-15. Branch: `feature/material-choco`.

## What changed

- New folder `material-choco/`: desktop app, hub, agent, shared UI, tests, docs.
- New folder `design/material-choco/`: the design canvas export (17 artboards, rendered frames, review notes).
- New workflow `.github/workflows/material-choco-release.yml`.
- New root files `AGENTS.md` and `CLOSEOUT_PROMPT.md`.
- No file of the Chocolatey CLI itself was changed.

## Checks that were run, and their results

| Check | Result |
| --- | --- |
| `npm test` (22 unit and integration tests, real hub and real agent in-process) | 22 passed |
| `npm run test:e2e` (real UI in headless Chrome, real hub, two agent processes) | all checks passed, 0 browser console errors |
| Hub image built with `docker build`, run as a container, reached on the LAN address, health check | healthy, runs as non-root user `node`, 242 MB |
| Real agent enrolled against that container and reported inventory | passed |
| Desktop app launched on Linux under a virtual display, window captured | started, signed in automatically, bundled CLI check passed |
| Schema drift check against the C# source | matches |

In all of these the CLI was `test/fixtures/fake-choco.js`, a stand-in, because the machine was Linux without .NET Framework.

## Not verified

- Nothing has run on Windows. Not the installer, not the real `choco.exe` under the app, not `build.bat`, not `build-installer.bat`.
- The release workflow has never run. In particular the step that finds `choco.exe` under `code_drop` is a search, because the exact output folder was not confirmed.
- Whether the CLI built from this repository unpacks its helper files correctly when `ChocolateyInstall` points at the app-owned folder.
- `--limit-output` row formats for `apikey list`, `template list` and `rule list` were written from the source, not from real output. Those pages show raw output where no parser applies.
- Reduced motion, screen readers and display scaling were not captured or audited.

## Remaining work

See `ROADMAP.md`. 0.2 is the Windows proof.

## Design pass notes

See `design/material-choco/README.md`.
