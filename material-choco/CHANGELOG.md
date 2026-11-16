# Changelog

## 0.1.0 (unreleased)

Releases are published by the workflow as 0.1.x, one per push. This file describes the 0.1 line as a whole.

### First run on Windows (2026-11-16)

The released app was installed on Windows 11 and used with the real Chocolatey CLI inside it. That run found these problems, now fixed:

- The app now opens after the installer finishes. It used to quit, because it treated the installer's first-run signal as an event to handle.
- Settings, the finished first-run wizard and the personal wording file now survive a restart. The built-in hub used to take a new port at every start, and the window's storage belongs to the address.
- The switches for sources and features stay on the requested state and locked while their job runs, so a second press cannot queue the same command again.
- The config page counts settings the machine reports beyond the schema in its total ("12 of 11" before).
- The hub link card shows the agent's state once it comes online, instead of "disconnected".
- The update notice stays until it is closed or Restart is pressed; it used to vanish after a minute.
- `build.bat` and `build-installer.bat` work from a clean clone on Windows: a tagged commit no longer gives the CLI build an invalid version, the CLI is not packed into packages the app does not use, a checksum-verified Node.js 22 is used when the PATH has another version, npm 11 is allowed to run the Electron and esbuild install scripts, and a start from PowerShell 7 no longer breaks the CLI build.
- The schema, API reference and site checks pass on a Windows checkout with CRLF line endings.
- The tests run on Windows, and screenshots no longer follow the machine's light or dark theme.

### Layout and the demo (2026-11-16)

- No clipping at any of the 36 checked sizes, including text at 200 percent on a 320 px screen: the phone bottom bar, long option names, page titles, buttons, setting rows and the top bar now fit.
- The clipping check names hidden causes too, inside component shadow parts and in text that runs past its box.
- Schedules run in the demo, as in the hub.
- The demo banner takes one line on a phone instead of a third of the screen.
- The site's feature index has a category bar, and on a phone it is less than half as long.

### Site, demo and releases

- The landing site is split into pages: home, features, screens, remote hub, download, guides and status.
- The real interface runs as a labelled demo in the browser against simulated machines. Nothing is installed and nothing leaves the browser.
- Every code block in the app and on the site has a copy button.
- Each release carries a dim sum code name, a link to public photos of the dish, SHA-256 sums of the installers and the run's timing.
- One script fetches every dependency. A clipping check covers many sizes, scale factors and text sizes.

### Packages

- Every Chocolatey CLI command and option is available, generated from the CLI source in this repository.
- The Chocolatey CLI built from this repository ships inside the app.
- Pages for installed packages, discovery, updates, sources, config and features, pins, API keys, cache and templates, the package builder and a console.
- Every form shows the exact command before it runs, and option dialogs have a dry run.
- Bulk actions on packages, machines, sources and jobs, and export of lists as CSV, JSON and Markdown.

### Hub

- Sign in with a password or a passkey. Lockout after failed attempts.
- Users with admin, operator and viewer roles.
- Pairing codes with a QR code, read only agents, and per-machine lists of allowed commands that the agent can also enforce by itself.
- Job queue for offline machines, schedules, append-only history.
- Status webhooks for failed jobs, offline machines and sign in lockouts.
- Secret option values and webhook addresses are encrypted in the hub's data file.
- Removed: authenticator codes at sign in. A hub upgraded from a build that had them deletes the stored records and writes a history entry for each affected user.

### Interface

- Every install or upgrade that finishes takes over the screen: a celebration on success, an alarm with the exit code and last output on failure. A setting turns it off.
- Three language modes, a personal wording file, and tone sliders.
- Theme from one seed colour, a custom logo, presets with undo, and settings that switch by the clock.
- Tabs that can be closed, pinned and reordered. Command palette. Context menus with a filter on everything. One list of keyboard shortcuts.
- A pattern builder beside every regex switch.
- Two key confirmation for destructive actions.
- Changelog viewer with a filter. Base64 tools.
- Accessibility tools.
- Removed: the built-in authenticator page.

### Desktop app

- First version of the desktop app, the hub and the remote agent.
- The app announces a downloaded update and says that the build is not code signed.
