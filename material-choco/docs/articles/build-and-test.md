# Build and test from source

How to run the app and the hub from a checkout, how the tests work, and what the release workflow does. Useful if you want to verify a claim on this site yourself.

## Layout

| Folder | What it holds |
| --- | --- |
| `core/` | CLI wrapper, bundled CLI setup, job runner, agent |
| `hub/` | HTTP server, sign in, jobs, schedules, store, `Dockerfile` |
| `desktop/` | Desktop shell: frameless window, the hub in-process, agent mode |
| `ui/` | The interface, shared by the desktop app and the hub |
| `shared/` | `choco-schema.json`, generated from the CLI source |
| `test/` | Unit, integration and end to end checks |
| `site/` | This site. `site/tools/generate.mjs` builds its pages from `docs/` |

## Run it for development

Any platform with Node.js 22:

```
cd material-choco
npm ci
node scripts/gen-schema.mjs      # refresh the schema from the C# source
node scripts/build-vendor.mjs    # rebuild ui/vendor
npm run hub                      # hub on http://localhost:8080
npm start                        # desktop app
```

A development checkout has no built CLI inside it. Set `MATERIAL_CHOCO_BUNDLE` to a folder that contains `choco.exe`, or set `MATERIAL_CHOCO_ALLOW_SYSTEM=1` to let it use a Chocolatey found on the system.

## Tests

```
npm test             # unit and integration tests
npm run test:e2e     # end to end run in headless Chrome
```

- `npm test` starts a real hub and a real agent in-process and covers the schema, argument validation, sign in, pairing, jobs, read only agents, schedules and history.
- `npm run test:e2e` starts a hub and two agent processes, drives the real interface in headless Chrome, asserts outcomes, and saves the screenshots under `docs/screenshots`.

Both use `test/fixtures/fake-choco.js`, a small stand-in for `choco.exe`, because the checks run on Linux. Package names and versions in the screenshots come from that stand-in. The numbers of tests and checks, and their last recorded results, are in [HANDOFF.md](../../HANDOFF.md).

## Build on Windows

`build.bat` builds the CLI from the repository root, installs the npm packages and starts the app. `build-installer.bat` produces the Squirrel.Windows installer in `dist\squirrel-windows`. Both accept `/s`, `--silent` or `SILENT=1`.

> These two scripts were written on Linux and have **not been run on Windows yet**.

## The release workflow

`.github/workflows/material-choco-release.yml` does the same steps on a hosted Windows runner: it builds the CLI from this repository, packs it into the app, and publishes `Setup.exe`, `RELEASES` and the full `.nupkg` as a release whose tag starts with `material-choco-v`. It also builds and pushes the hub image. The installer is not code signed.

The handoff note records the first green run and the release it produced. It also records what that run does not prove: the installer was built, and was not installed or started.

## This site

```
node material-choco/site/tools/generate.mjs
```

rebuilds the pages from `docs/articles` and `docs/features`. `.github/workflows/material-choco-site.yml` runs it and publishes the result. Fonts are the vendored files from `ui/vendor/fonts`; the site makes no third-party requests apart from the lookup of the newest release.

## Known limits

- The app has not been built or run with `build.bat` on Windows.
- The end to end run needs Google Chrome on the machine (`CHROME_BIN` selects another binary).

## Related

- [Getting started on one PC](getting-started.md): the installed app
- [Every command and option](commands-and-options.md): the schema generator
- [Windows installer](../features/windows-installer.md): the feature page
- [Hub HTTP API](../features/hub-http-api.md): routes for your own tooling
