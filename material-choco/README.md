# Material Choco

A desktop app and a remote management hub for the Chocolatey CLI in this repository.

- **Desktop app (Windows):** manages Chocolatey on the PC it runs on. The Chocolatey CLI built from this repository ships inside the app. Nothing else has to be installed.
- **Hub (container):** a web app for managing many Windows machines from a browser, phone included. Each machine connects out to the hub as an agent.

**Install:** use the download button on the [site](https://ding-ding-projects.github.io/choco/), or take `Setup.exe` from the newest release whose tag starts with `material-choco-v` on the [releases page](https://github.com/Ding-Ding-Projects/choco/releases). The installer is **not code signed**, so Windows may show an unknown publisher warning.

**Hub:** `docker compose up -d` in this folder, then open `http://<host>:8080` and create the administrator.

**Status:** an early, unsigned build. The automated checks pass on Linux and on Windows, and the released app was installed on Windows 11 and used with its real Chocolatey CLI on 2026-11-16. Read [HANDOFF.md](HANDOFF.md) for exactly what was checked and what was not.

Contents: [What it does](#what-it-does) · [How it fits together](#how-it-fits-together) · [Security](#security) · [Build](#build) · [Tests](#tests) · [Documents](#documents) · [Size](#size) · [Licence](#licence)

![Overview page: a banner says 4 updates are ready, then counts of machines, packages, updates and running jobs, and a needs attention list.](docs/screenshots/06-overview.png)

Screenshots in `docs/screenshots` are captured from the real running hub and agents by `test/e2e/run.mjs`. In that run a small test fixture stands in for `choco.exe`, because the capture machine is Linux; package names and versions in the pictures come from that fixture.

## What it does

<details><summary>Every Chocolatey command and option</summary>

`scripts/gen-schema.mjs` reads the C# command classes under `src/chocolatey` and writes `shared/choco-schema.json`: 23 commands, 190 command options, 24 global options, 11 config settings and 30 features at the time of writing. The Console page builds a form for each command from that file, and a test fails when the file no longer matches the source. So an option added to the CLI appears in the app after the generator runs.

Every form shows the exact command before it runs, and the option dialogs have a dry run.
</details>

<details><summary>Pages</summary>

| Page | What it is for |
| --- | --- |
| Overview | Updates ready, counts, what needs attention, recent jobs |
| Machines | Paired machines, pairing codes with a QR code, bulk actions, per-machine policy |
| Installed | Packages per machine: upgrade, pin, uninstall, bulk actions, `packages.config` export and import |
| Discover | Search the sources of a machine and install, with every install option |
| Updates | Outdated packages per machine, upgrade one or everything |
| Sources | Package sources with enable switches, add, edit, remove |
| Config and features | Every CLI config setting and feature switch |
| Pins | Pinned packages |
| API keys | Which sources have a stored key; values are never shown |
| Cache and templates | Cache, templates, rules, licence and support readers |
| Package builder | `new`, `pack`, `push`, `export` |
| Console | Every command and option as a generated form |
| Base64 tools | Encode and decode text and files in the browser |
| Jobs | Live output, cancel, exit codes, logs |
| Schedules | Daily or weekly commands |
| History | Append-only record with export |
| Help | Offline articles, shortcuts, help of every CLI command |
| Settings | Language, appearance, accessibility, sound, focus modes, timed settings, sign in, data, about and changelog |
| Users and roles | Hub admins only |
| Status webhooks | Hub admins only |
</details>

<details><summary>Remote management</summary>

- Pair a machine with a one time code that expires after 10 minutes. The page also draws it as a QR code.
- Run any command on one machine, several, or all of them. Jobs for an offline machine wait up to 7 days.
- Live output, cancel, exit codes, exported logs.
- Daily or weekly schedules on the hub, for all machines, a group, or a chosen set.
- A read only agent refuses every command that changes the machine, and enforces this itself when it was paired that way.
- A machine can be limited to a list of allowed commands, by an admin in the hub or on the machine with `--allow`. The agent enforces its own list by itself.
- Users with three roles: admin, operator and viewer. The hub checks the role on every request.
- Status webhooks: a short message when a job fails, a machine stays offline or sign in is locked out. Job output is never sent.
- Append-only history with CSV, JSON and Markdown export.
</details>

<details><summary>Interface</summary>

Material Design 3 Expressive, themed from one seed colour, light and dark. English, Hong Kong Cantonese and bilingual modes, and a personal wording file. Tabs that can be closed, pinned and reordered. Command palette on Ctrl+Shift+F. Context menus with a filter. A pattern builder beside every regex switch. Bulk actions and exports on lists. A two key confirmation with a slider before destructive actions. Full-screen results when an install or upgrade finishes. Timed settings, a custom logo and presets. Loading, empty, offline, success and error states each have their own design and motion, and every animation has a reduced motion path. Accessibility tools for text size, contrast, motion, target size and focus ring.

There is no built-in authenticator and no authenticator code step at sign in. Both were removed on 2026-11-16 by decision of the maintainer.
</details>

## How it fits together

<details><summary>Folders</summary>

| Folder | What |
| --- | --- |
| `core/` | CLI wrapper (`choco.js`), bundled CLI setup (`bundle.js`), job runner, agent |
| `hub/` | HTTP server, sign in, passkeys, roles, jobs, schedules, webhooks, secrets at rest, store, `Dockerfile` |
| `desktop/` | Desktop shell: frameless window, the hub in-process on 127.0.0.1, agent mode |
| `ui/` | The interface, shared by the desktop app and the hub. `ui/vendor` is generated |
| `shared/` | `choco-schema.json`, generated from the CLI source |
| `scripts/` | Generators: schema, vendor bundle, API reference |
| `test/` | Unit, integration and end to end checks |
| `site/` | The landing site. `site/tools/generate.mjs` builds its pages from `site/tools/pages`, `docs/articles` and `docs/features`. The deploy workflow also publishes `ui/demo.html` as an in-browser demo at `demo/` |
| `docs/` | Feature documents, guides, API reference, screenshots, the feature inventory |
</details>

<details><summary>Headless agent</summary>

On a server without a desktop session:

```
MaterialChoco.exe --agent enroll --hub https://hub.example:8443 --code XXXX-XXXX
MaterialChoco.exe --agent run
```

`enroll` also takes `--name`, `--read-only`, `--allow-insecure` and `--allow list,outdated,upgrade`. `--agent status` and `--agent disconnect` complete the set. The agent stays in the foreground; no Windows service is installed.
</details>

<details><summary>Hub HTTP API</summary>

See [docs/api/README.md](docs/api/README.md) and the Postman collection [docs/api/material-choco.postman_collection.json](docs/api/material-choco.postman_collection.json). Both are generated from the route table, and a unit test fails when they no longer match.
</details>

## Security

<details open><summary>Read this before exposing a hub</summary>

- The hub can install software with administrator rights on every enrolled machine. Hub access is administrator access.
- Serve the hub over HTTPS (set `MATERIAL_CHOCO_TLS_CERT` and `MATERIAL_CHOCO_TLS_KEY`, or use a reverse proxy). Agents refuse plain HTTP to a remote hub unless started with `--allow-insecure`.
- Sign in is a password or a passkey. Passwords are stored as salted scrypt hashes. Failed sign ins lock out with growing delays. Sessions use an HttpOnly, SameSite=Strict cookie and cross-site requests are refused. There are no authenticator codes.
- Passkeys were verified with a software passkey device in the unit tests and with Chrome's virtual one in the end to end run. No person has signed in with a real device yet.
- Three roles. Job output and the history are readable by every role, viewers included.
- Agents hold a random token; the hub stores only its hash. Removing a machine revokes it.
- Commands are argument lists checked against the CLI option list and run without a shell.
- Source passwords and API keys are masked in job records and history. In the hub's data file, option values marked secret and webhook addresses are encrypted. The key lies in the same data folder unless you set `MATERIAL_CHOCO_KEY_FILE`, so anyone who can read the whole folder can decrypt them. Positional arguments, other options and job output are stored as they are.
- Not built: signed agent updates, limiting a user to some machines, signed webhook messages, rotation of the key.
- No independent security review has been done.

The longer version is the [security model](docs/articles/security-model.md).
</details>

## Build

<details><summary>Windows</summary>

`build.bat` in this folder builds the CLI from the repository root, installs npm packages, and starts the app. `build-installer.bat` produces the Squirrel.Windows installer in `dist\squirrel-windows`. Both accept `/s`, `--silent` or `SILENT=1`. The repository root already has the Chocolatey project's own `build.bat`, so these live here.

Both were run from a clean clone on Windows 11 on 2026-11-16 and work: `build-installer.bat` produced an unsigned installer and `build.bat` started the app. They use a checksum-verified Node.js 22 when the PATH has another version, and the CLI build needs the .NET SDK and the Visual Studio build tools, which they do not install. The release workflow does the same steps on a hosted Windows runner, and the released app was installed and used on Windows on the same day.
</details>

<details><summary>Any platform, for development</summary>

```
npm ci
node scripts/gen-schema.mjs      # refresh the schema from the C# source
node scripts/build-vendor.mjs    # rebuild ui/vendor and ui/changelog.md
node scripts/gen-api-docs.mjs    # refresh the API route table and the Postman collection
npm run hub                      # hub on http://localhost:8080
npm start                        # desktop app
node site/tools/generate.mjs     # rebuild the site pages
```
</details>

<details><summary>Release</summary>

`.github/workflows/material-choco-release.yml` runs on every push. On a hosted Windows runner it builds the CLI from this repository, packs it into the app, builds the installer and publishes `Setup.exe`, `RELEASES` and the full `.nupkg` as a release tagged `material-choco-v0.1.<run number>`. A second job pushes the hub image to `ghcr.io/ding-ding-projects/material-choco-hub`. Nothing is code signed. `.github/workflows/material-choco-site.yml` publishes the site.
</details>

## Tests

<details open><summary>What runs, and the last results</summary>

| Command | What it does | Result on 2026-11-16 |
| --- | --- | --- |
| `npm test` | Unit and integration tests. They start a real hub and a real agent in-process and cover the schema, argument validation, sign in, passkeys, roles, secrets at rest, webhooks, allow lists, jobs, schedules and history. | 95 of 95 pass |
| `npm run test:e2e` | Drives the real interface in headless Chrome against a real hub and agent processes, as admin, operator and viewer, and refreshes the screenshots. | 124 of 124 checks pass |

Both use `test/fixtures/fake-choco.js` in place of `choco.exe`. Neither proves anything about the real CLI on Windows.
</details>

## Documents

| | |
| --- | --- |
| [HANDOFF.md](HANDOFF.md) | What was checked, with results, and what was not |
| [ROADMAP.md](ROADMAP.md) | Checklist of what is done and what is next |
| [CHANGELOG.md](CHANGELOG.md) | Changes by version |
| [docs/FEATURE-INVENTORY.md](docs/FEATURE-INVENTORY.md) | State of each of the 118 required features: 14 done, 63 partial, 3 written and never run, 24 not built, 12 not applicable, 2 waived |
| [docs/features](docs/features/README.md) | One document per shipped feature |
| [docs/articles](docs/articles/README.md) | How-to guides |
| [docs/api](docs/api/README.md) | Hub HTTP API |
| [Design files](../design/material-choco/README.md) | 27 design boards and their rendered frames |

## Size

<details><summary>Line count and effort estimate</summary>

Hand-written app code, excluding `ui/vendor`, `shared/choco-schema.json`, `node_modules`, the site, the documents and the design export: **5,187 lines** (641,225 bytes), counted on 2026-11-16 with this command, run in this folder:

```
cat core/*.js hub/*.js desktop/*.js scripts/*.mjs test/*.js test/e2e/*.mjs test/fixtures/*.js ui/index.html ui/styles.css ui/js/*.js build*.bat | wc -l
```

Many lines are very long (the average is about 124 bytes), so the line count understates the amount of code. The site adds 1185 lines (`site/site.css`, `site/site.js`, `site/tools`), and the feature documents and guides add 2,954 lines of Markdown (`cat docs/features/*.md docs/articles/*.md | wc -l`).

Estimate for one experienced developer writing the app code by hand: at 60 to 120 finished, tested lines a day, 5187 / 120 to 5187 / 60 is about 43 to 86 working days. Because the lines are long, the upper end, or more, is the realistic one. This is an estimate, not a measurement.
</details>

## Licence

Apache-2.0, the same as the repository. Not affiliated with or endorsed by Chocolatey Software, Inc. "Chocolatey" is their trademark.
