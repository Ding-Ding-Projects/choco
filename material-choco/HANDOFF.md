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

| Release workflow, run 43807632449 on `windows-latest` | green. The CLI was built from this repository, found at `code_drop\temp\_PublishedApps\choco_merged\choco.exe`, and `choco.exe --version` printed `2.9.0-materialch-20261116-68069424` on the runner. `Material Choco Setup 0.1.2.exe` (126 MB), `RELEASES` and the full `.nupkg` were published as release `material-choco-v0.1.2`. The hub image job pushed to GHCR. |

In every check except the last row the CLI was `test/fixtures/fake-choco.js`, a stand-in, because the machine was Linux without .NET Framework.

The first workflow run (43807552624) failed on a YAML quoting error in the file; the second commit fixed it.

## 2026-11-16: install result takeovers

Added full-screen success and failure takeovers for install and upgrade jobs, with a setting. End to end run: 31 of 31 checks passed, including that the failure takeover stays until dismissed and that installs started outside the current browser also trigger it. `npm test`: 22 passed. Reduced motion for the takeovers was written by rule and not captured. Merged to `main`.

## Not verified

- The installer has been built on Windows but never installed or started there. The app has not run the real `choco.exe` yet. `build.bat` and `build-installer.bat` have not been run.
- The installer is unsigned.
- Whether the CLI built from this repository unpacks its helper files correctly when `ChocolateyInstall` points at the app-owned folder.
- `--limit-output` row formats for `apikey list`, `template list` and `rule list` were written from the source, not from real output. Those pages show raw output where no parser applies.
- Reduced motion, screen readers and display scaling were not captured or audited.

## Remaining work

See `ROADMAP.md`. 0.2 is the Windows proof.

## Design pass notes

See `design/material-choco/README.md`.
