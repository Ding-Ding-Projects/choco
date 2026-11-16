---
name: material-choco-ops
description: Run the Material Choco checks (unit tests, end to end run, clipping check, schema check, site generator and link check), understand how the release workflow produces a release, and verify a published release. Use when asked to test, check, build, release or verify anything under material-choco/.
---

# Material Choco operations

Everything below is run from the repository root unless a step says otherwise. The app lives in `material-choco/`. Do not change the CLI source under `src/` for app work.

## 1. Prepare a checkout

Needs Node.js 22 or newer.

```
cd material-choco
node scripts/fetch-deps.mjs
```

This runs `npm ci`, rebuilds `ui/vendor` with `scripts/build-vendor.mjs`, and runs `node scripts/gen-schema.mjs --check`. It prints a summary and exits non-zero when any step failed. `scripts/fetch-deps.sh` and `scripts\fetch-deps.bat` call the same script.

## 2. Unit and integration tests

```
cd material-choco
npm test
```

This runs `node --test test/*.test.js`. The tests start a real hub and agent in-process, with `test/fixtures/fake-choco.js` standing in for `choco.exe`. Report the exact pass and fail counts from the `# pass` and `# fail` lines.

## 3. End to end run

```
cd material-choco
npm run test:e2e
```

This runs `test/e2e/run.mjs`: a real hub and two real agents, driven through headless Chrome. Chrome is taken from `CHROME_BIN`, or `google-chrome` on the PATH. The run rewrites the screenshots in `docs/screenshots`; pass `--shots <folder>` to write them somewhere else. It ends with `N of M checks passed` and exits 1 when a check failed.

`node test/e2e/demo.mjs` checks the in-browser demo (`ui/demo.html`) the same way, without a hub.

## 4. Clipping check

```
cd material-choco
npm run test:clip
```

This runs `test/e2e/clipping.mjs`: every page in the tab strip at widths 320, 390, 768, 1024, 1360 and 1920, device scale factors 1, 1.5 and 2, and text at 100 and 200 percent. It fails when the document is wider than the viewport, or when a visible button or label holds more than fits and has no ellipsis. It prints one PASS or FAIL line per size and a list of distinct findings. Options: `--widths`, `--scales`, `--text`, `--pages` (comma separated) and `--json <file>`. Exit code 1 means findings, 2 means the run did not complete. The full run takes several minutes.

## 5. Generated files

| File | Refresh | Check only |
| --- | --- | --- |
| `shared/choco-schema.json`, from the C# source under `src/chocolatey` | `node scripts/gen-schema.mjs` | `node scripts/gen-schema.mjs --check` |
| `docs/api/README.md` route table and the Postman collection | `node scripts/gen-api-docs.mjs` | `node scripts/gen-api-docs.mjs --check` |
| `ui/vendor` | `node scripts/build-vendor.mjs` | none |
| Site pages under `site/` | `node site/tools/generate.mjs` | `node site/tools/generate.mjs --check` |

Run these from `material-choco/`. After a CLI option changes, refresh the schema.

## 6. Site and link check

The site pages are built from `site/tools/pages`, `docs/articles` and `docs/features`. The link check needs an assembled copy of the site, which `.github/workflows/material-choco-site.yml` builds in its "Assemble the site" step. To check locally, repeat that step into a temporary folder, then run:

```
node material-choco/site/tools/check-links.mjs <assembled folder>
```

It reports pages, internal references checked and problems, and exits 1 when a link does not resolve. External links are not followed. The site workflow runs on pushes to `main` that touch the site, the articles, the feature pages, the screenshots, `ui/` or `package.json`, and deploys to GitHub Pages.

## 7. How a release is produced

`.github/workflows/material-choco-release.yml` runs on every push and on manual dispatch, only in `Ding-Ding-Projects/choco`. It gates on no Material Choco tests, so run steps 2 to 4 before pushing.

1. Job `installer` (Windows): the version is `0.1.<run number>` and the tag is `material-choco-v0.1.<run number>`. It builds the CLI with `build.ps1`, copies it into `material-choco/choco-bundle`, runs `npm ci`, `gen-schema.mjs` and `build-vendor.mjs`, and builds the Squirrel.Windows installer with electron-builder into `dist/squirrel-windows`.
2. The same job publishes the release with `gh release create`. The title and the first lines of the notes carry a dim sum code name and a Wikimedia Commons search link from `scripts/release-name.mjs`. The notes also list each installer file with its size and SHA-256 sum and state that the files are not code signed.
3. Job `hub-image` (Linux) builds `hub/Dockerfile` and pushes `ghcr.io/ding-ding-projects/material-choco-hub` with the version tag and `latest`.
4. Job `release-timing` runs after both and appends the UTC start time, completion time, total duration and the hub image job result to the release notes.

To see the code name of a release without running the workflow: `node material-choco/scripts/release-name.mjs 0.1.<run number>`.

Local Windows builds: `material-choco\build.bat` builds and starts the app, and `material-choco\build-installer.bat` builds the installer. Nothing is code signed, and no signing step may be added.

## 8. Verify a release

1. Find the run: `gh run list --workflow material-choco-release.yml --limit 5`, then `gh run view <run id>` and confirm that all three jobs succeeded.
2. Read the release: `gh release view material-choco-v0.1.<run number>`. Confirm the title has the code name, the notes open with the code name and photo reference, the SHA-256 table lists every attached file, and the "Workflow run times (UTC)" section is present.
3. Download and compare sums: `gh release download material-choco-v0.1.<run number> --dir <folder>`, then `sha256sum <folder>/*` (or `Get-FileHash <file> -Algorithm SHA256` on Windows) and compare with the table in the notes.
4. Confirm the files are unsigned on Windows: `(Get-AuthenticodeSignature <Setup.exe>).Status` should print `NotSigned`.
5. Confirm the hub image: `docker pull ghcr.io/ding-ding-projects/material-choco-hub:0.1.<run number>`.
6. Installing and updating can only be verified on Windows. Say so plainly when it was not done.

## 9. Records

Record real results, with counts, in `material-choco/HANDOFF.md`, and update `material-choco/ROADMAP.md` and `material-choco/docs/FEATURE-INVENTORY.md` in the same change as the work they describe. Never report a check as passing without having run it. Repository settings that need a maintainer are listed in `material-choco/docs/REPOSITORY-SETUP.md`.
