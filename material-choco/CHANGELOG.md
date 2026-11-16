# Changelog

## 0.1.0 (unreleased)

Releases are published by the workflow as 0.1.x, one per push. This file describes the 0.1 line as a whole.

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
