# Closeout prompt

```text
Repository: Ding-Ding-Projects/choco, branch main (feature/material-choco is merged).
Read AGENTS.md, material-choco/README.md, material-choco/HANDOFF.md, material-choco/ROADMAP.md and material-choco/docs/FEATURE-INVENTORY.md first.

State on 2026-11-16: Material Choco 0.1.0 is built: a desktop app, a hub that runs in a container, and a remote agent for the Chocolatey CLI, with the CLI built from this repository bundled inside the app. On Linux, 22 unit and integration tests and 31 end to end checks pass, the hub image builds and runs, and the desktop app starts. A test fixture stood in for choco.exe in every check.

The release workflow is green (run 43807632449): it built the CLI from this repository on Windows, bundled it, built the Squirrel.Windows installer and published release material-choco-v0.1.2, and pushed the hub image to GHCR. The installed app has not been started on Windows yet. Next:
1. Download Setup.exe from the latest material-choco release.
2. Install it on a clean Windows machine. Run a real install, upgrade and uninstall through the app. Confirm the bundled CLI works with ChocolateyInstall pointing at the app-owned folder.
3. Run material-choco/build.bat and build-installer.bat on Windows.
4. Recapture the screenshots on Windows with the real CLI, then update HANDOFF.md, ROADMAP.md and the inventory with real results.
5. Continue with ROADMAP 0.2 and 0.3. Do not tick a box until the item works and was exercised.

The design pass used a pinned copy of the Stageshow skill because a fresh install was blocked; its craft, framing, rehearse and review references were not read in full. Redo that part of the design review when a fresh install is possible.
```
