# Handoff: Material Choco

Date: 2026-11-16. Branch: `main`. This file states what exists, what was checked and with what result, and what was not checked. Nothing here is a claim beyond the row that makes it.

## What exists

- `material-choco/`: the desktop app, the hub, the agent, the shared interface, tests, documents and the landing site.
- `design/material-choco/`: the design canvas export, 27 boards with rendered frames. A larger pass that adds a board per required feature is in progress and is not published.
- Workflows `.github/workflows/material-choco-release.yml` and `.github/workflows/material-choco-site.yml`.
- Root files `README.md` (rewritten for this fork), `AGENTS.md` and `CLOSEOUT_PROMPT.md`.
- No file of the Chocolatey CLI itself was changed.

## Checks and their results

| Check | Result | When and by whom |
| --- | --- | --- |
| `npm test`: unit and integration tests with a real hub and a real agent in-process | 95 of 95 pass | 2026-11-16, run in the build session |
| `npm run test:e2e`: the real interface in headless Chrome against a real hub and agent processes, as admin, operator and viewer | 121 of 121 checks pass, with no browser console errors | 2026-11-16, run in the build session |
| Schema drift check against the C# source | matches | part of `npm test` |
| API reference and Postman collection match the route table | match | part of `npm test` |
| Hub image built with `docker build`, run as a container, reached on the LAN address, health check | healthy, runs as the non-root user `node` | 2026-11-15, earlier state of the hub |
| A real agent enrolled against that container and reported inventory | passed | 2026-11-15 |
| Desktop app launched on Linux under a virtual display | started, signed in automatically, bundled CLI check passed with the stand-in | 2026-11-15, once |
| Release workflow, run 43807632449 on `windows-latest` | green. The CLI was built from this repository and `choco.exe --version` printed `2.9.0-materialch-20261116-68069424` on the runner. `Setup.exe`, `RELEASES` and the full `.nupkg` were published as release `material-choco-v0.1.2`. The hub image was pushed to `ghcr.io/ding-ding-projects/material-choco-hub`. | 2026-11-16 |
| Later pushes | published later versions. The live site showed 0.1.5 as the newest at 10:38 local time on 2026-11-16. | 2026-11-16 |
| Landing site, assembled as the workflow does and served locally | see "Site checks" below | 2026-11-16 |
| `node test/e2e/demo.mjs`: the in-browser demo served under a sub-path, no hub | 24 of 24 checks pass, no request left the page | 2026-11-16 |
| `node test/e2e/clipping.mjs`: 20 pages at 6 widths, 3 scale factors, 2 text sizes | 15 of 36 sizes pass. One finding at 320 px wide (the bottom bar on Settings); every other finding is at 200 percent text. Not fixed. | 2026-11-16, one full run |
| `node scripts/fetch-deps.mjs` in a clean copy on Linux | 4 of 4 steps pass | 2026-11-16 |
| Landing site, live | reachable, and measured at phone widths with no sideways scroll | 2026-11-16 |
| Repository website field | reads back `https://ding-ding-projects.github.io/choco/` | 2026-11-16 |

In every automated check the CLI was `test/fixtures/fake-choco.js`, a stand-in, because the machines were Linux without .NET Framework. The only place the real CLI ran is the release workflow, where it printed its version.

The first workflow run (43807552624) failed on a YAML quoting error; the next commit fixed it.

### Site checks

The site was assembled into a scratch folder exactly as the workflow does, served with `python3 -m http.server` under `/choco/`, and driven with the repository's own Chrome driver. The numbers of the last run are in the closing report of the session that produced this file; in short: every internal link, image and fragment resolved, every page was measured at 320, 360, 390, 768 and 1360 px with no sideways scroll and no touch target under 44 px, and the palette, lightbox, theme toggle, phone menu, release lookup, its fallback and reduced motion were each exercised.

## History of this build

- 2026-11-15: first version. Desktop app, hub, agent, every CLI command from the generated schema, two key confirmation, three language modes.
- 2026-11-16: full-screen results for installs and upgrades.
- 2026-11-16: Base64 tools, pattern builder, bulk actions and exports, timed settings, custom logo and presets, changelog viewer, QR code for pairing, one list of keyboard shortcuts, general context menu, tab reordering, wider Cantonese coverage, update notice in the desktop layout.
- 2026-11-16: hub hardening. Passkeys with the password as fallback, users with admin, operator and viewer roles, per-machine command allow lists enforced in the hub and in the agent, status webhooks, secret option values and webhook addresses encrypted at rest.
- 2026-11-16: **authenticator codes removed by decision of the maintainer.** The built-in authenticator page is gone, and the hub has no one time code step: the route was removed, a hub upgraded from an earlier build deletes stored records at start and writes one history entry per affected user. Sign in is a password or a passkey.
- 2026-11-16: landing site with guides, a page per feature, gallery and command palette; one document per feature; these records rewritten and the feature inventory recounted strictly.

## Not verified

- **Nothing has been installed and run on Windows by a person.** The installer was built there. The installed app has never been started, and the app has never run the real `choco.exe`.
- `build.bat` and `build-installer.bat` have never been run.
- The installer is unsigned.
- Whether the CLI built from this repository unpacks its helper files correctly when `ChocolateyInstall` points at the app-owned folder.
- Automatic updates: the desktop shell is written to fetch a newer release. Only the notice in the interface was exercised, against a stand-in for the desktop shell.
- Passkeys were verified with a software passkey device in the unit tests and with Chrome's virtual passkey device in the end to end run. No real fingerprint reader, phone or security key was used.
- Status webhooks were delivered to receivers on the same computer only.
- HTTPS through `MATERIAL_CHOCO_TLS_CERT` and `MATERIAL_CHOCO_TLS_KEY` was not exercised in a recorded check.
- `--limit-output` row formats for `apikey list`, `template list` and `rule list` were written from the source, not from real output.
- Reduced motion, screen readers, display scaling and the larger text sizes were not captured or audited.
- The site was not tested on a physical phone, in landscape, or in browsers other than Chrome. Link previews in chat apps were not tested.
- The clipping findings at 200 percent text and at 320 px are known and open.
- The release workflow's code name, checksum table and timing job were dry-run locally with a stand-in for `gh`; see the release page for the first real result.
- `fetch-deps.bat` and the changed lines of `build.bat` were never run.
- The demo's schedules never fire, and the demo was not tried on a physical phone.
- Design Tweaks were not exercised inside the design tool.
- No independent security review.

## Remaining work

See `ROADMAP.md`. The next milestone is the Windows proof. The state of every required feature is in `docs/FEATURE-INVENTORY.md`: 14 done, 63 partial, 3 written and never run, 24 not built, 12 not applicable, 2 waived, of 118.

## Design pass notes

See `design/material-choco/README.md`.
