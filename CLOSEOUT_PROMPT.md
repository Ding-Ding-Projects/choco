# Closeout prompt

```text
Repository: Ding-Ding-Projects/choco, branch main. A fork of the Chocolatey CLI; the CLI source is unchanged.
Read first: AGENTS.md, README.md, material-choco/README.md, material-choco/HANDOFF.md, material-choco/ROADMAP.md, material-choco/docs/FEATURE-INVENTORY.md and .claude/skills/material-choco-ops/SKILL.md.

State on 2026-11-16: Material Choco 0.1 is a desktop app, a hub that runs in a container, and a remote agent for the Chocolatey CLI, with the CLI built from this repository bundled inside the app. Newest release: material-choco-v0.1.17 ("Zi Ma Wu"), built from commit 77d36440, normal release, unsigned; its three files match the SHA-256 sums in its notes. Hub image ghcr.io/ding-ding-projects/material-choco-hub:0.1.17. Site: https://ding-ding-projects.github.io/choco/ (serves commit 77d36440).

Proven on a physical Windows 11 machine on 2026-11-16: 0.1.16 installed from Setup.exe and, with the real CLI inside the app, installed, upgraded, pinned, unpinned and uninstalled a package and turned a source and a feature off and on, with both full-screen results; the bundled CLI unpacked into the app's own folder and left an existing system Chocolatey untouched. 0.1.15 updated itself to 0.1.16. The published hub image paired with the app by a one time code and ran a job sent from a phone-width browser. build.bat and build-installer.bat work from a clean clone, also when started from PowerShell 7. Uninstalling restores the machine except the app's data folder, which stays by design. Release 0.1.17 then confirmed the two biggest fixes: it opens by itself after the installer, and a restart keeps settings.

Checks, on Windows, on commit 77d36440: npm test 95 of 95; test/e2e/run.mjs 121 of 121; test/e2e/demo.mjs 26 of 26; test/e2e/clipping.mjs 36 of 36 sizes; schema, API reference and site checks match; site link check 0 problems. Set CHROME_BIN to Chrome for the browser checks.

Feature inventory, counted strictly against the 118 required features: 16 done, 64 partial, 24 not built, 12 not applicable, 2 waived (both waivers confirmed by the maintainer).

Not proven: a build on a Windows machine with nothing installed (the .NET build tools are not fetched); pressing Restart in the update notice; passkeys on a real device (needs the hub on HTTPS, since browsers do not offer passkeys over plain HTTP on a LAN address); a physical phone; working offline; packages that need administrator rights; screen readers. The clipping check only finds things that are too wide, not overlaps.

Next, in this order:
1. Put the hub on HTTPS with MATERIAL_CHOCO_TLS_CERT and MATERIAL_CHOCO_TLS_KEY and sign in with a passkey from a real phone.
2. Build the features that do not exist, designing each on the design canvas first (boards exist for most): the per-element appearance editor, element locks with the recovery desk and unlock ladder, extension support, the built-in tools (file converter, type generator and JSON editor, virtual disks, game servers, world generator, local models, annotation), Status Hub registration, the startup dish surprise, rendered provider text, screen recording. The project board and discussions need the manual steps in material-choco/docs/REPOSITORY-SETUP.md.
3. Finish the partial inventory rows; each row names the missing part. Give the clipping check an overlap test.
4. Record real results in HANDOFF.md, tick ROADMAP.md only for what worked and was exercised, and update CHANGELOG.md and the inventory in the same change.

Rules that bit before: every push to any branch publishes a normal release that installed apps update to, so never push a work-in-progress branch as a backup; write public files in ordinary professional English and scan them against the private word list before publishing; do not tick a roadmap box or mark an inventory row Done without a named check; do not change files under src/; on Windows a checkout with core.autocrlf is fine.
```
