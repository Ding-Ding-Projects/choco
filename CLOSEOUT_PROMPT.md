# Closeout prompt

```text
Repository: Ding-Ding-Projects/choco, branch main. A fork of the Chocolatey CLI; the CLI source is unchanged.
Read first: AGENTS.md, README.md, material-choco/README.md, material-choco/HANDOFF.md, material-choco/ROADMAP.md and material-choco/docs/FEATURE-INVENTORY.md.

State on 2026-11-16: Material Choco 0.1 is built: a desktop app, a hub that runs in a container, and a remote agent for the Chocolatey CLI, with the CLI built from this repository bundled inside the app. The hub has passkeys with password fallback, users with admin, operator and viewer roles, per-machine command allow lists, status webhooks, and encryption at rest for secret option values and webhook addresses. By decision of the maintainer there are no authenticator codes: the built-in authenticator and the one time code step at sign in were removed. On Linux, npm test passes 88 of 88 and the end to end run passes 117 of 117. A test fixture stood in for choco.exe in every check.

Published: the release workflow is green (first green run 43807632449, release material-choco-v0.1.2; later pushes published later versions). It builds the CLI on Windows, bundles it, builds the unsigned Squirrel.Windows installer and pushes the hub image to ghcr.io/ding-ding-projects/material-choco-hub. The landing site is live at https://ding-ding-projects.github.io/choco/ and the repository's website field points at it. The site pages are generated: edit material-choco/docs/articles or material-choco/docs/features, then run node material-choco/site/tools/generate.mjs.

Not proven: nothing has been installed and run on Windows by a person. Passkeys were verified with a software passkey device and Chrome's virtual one only. build.bat and build-installer.bat have never been run. Automatic updates have never run.

Feature inventory, counted strictly against the 118 required features: 14 done, 58 partial, 3 written and never run, 29 not built, 12 not applicable, 2 waived.

Next, in this order:
1. Download Setup.exe from the newest material-choco release and install it on a clean Windows machine. Run a real install, upgrade and uninstall through the app. Confirm the bundled CLI works with ChocolateyInstall pointing at the app-owned folder.
2. Run material-choco/build.bat and build-installer.bat on Windows.
3. Sign in to a hub with a passkey on a real device. Deliver a status webhook to a real receiver.
4. Recapture the screenshots on Windows with the real CLI. Add a caption for each new capture to SHOTS in material-choco/site/tools/generate.mjs and regenerate the site.
5. Record the real results in HANDOFF.md, tick ROADMAP.md only for what worked and was exercised, and update the inventory in the same change.
6. Continue with the open boxes in ROADMAP.md.

Open items outside the code: the design pass that adds a board per required feature is in progress and not published; the link preview picture (material-choco/site/og.png) has not been uploaded as the repository's own preview; the earlier design pass used a pinned copy of its design skill because a fresh install was blocked, so redo that part of the design review when a fresh install is possible.

Rules that bit before: write public files in ordinary professional English and scan them against the private word list before publishing; do not tick a roadmap box or mark an inventory row Done without a named check; do not change files under src/.
```
