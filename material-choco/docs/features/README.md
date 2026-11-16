# Features

One page per feature that ships in Material Choco 0.1. Each page has the same four parts: what it is, how to use it, what was checked and how, and known limits. Only features that exist in the source are listed. Planned work is in the [roadmap](../../ROADMAP.md), and the state of every required feature, built or not, is in the [feature inventory](../FEATURE-INVENTORY.md).

These files are also the source of the [feature pages on the project site](https://ding-ding-projects.github.io/choco/features/).

Honest status that applies to every page here: the automated checks run against a test stand-in for `choco.exe`, on Linux and on Windows. The released app was also installed on Windows 11 and used with its real CLI on 2026-11-16. The installer is not code signed. See [HANDOFF.md](../../HANDOFF.md).

## Packages

| Feature | In one line |
| --- | --- |
| [Bundled Chocolatey CLI](bundled-cli.md) | The Chocolatey CLI built from this repository ships inside the app, so there is nothing to install before the first command. |
| [Command schema generated from the CLI source](command-schema.md) | Every command, option, config setting and feature the app offers is read from the C# source of the CLI in this repository, not typed in by hand. |
| [Console](console.md) | One page that offers every Chocolatey command with every one of its options, as a form. |
| [Command preview and dry run](command-preview-and-dry-run.md) | Every form shows the exact command before it runs, and the option dialogs can run it as a dry run first. |
| [Installed packages](installed-packages.md) | A list of the packages on each machine, with status, single actions, bulk actions, and `packages.config` export and import. |
| [Discover and install](discover-and-install.md) | Search the package sources of a machine and install from the results, with a single click or with every install option. |
| [Updates](updates.md) | What is out of date on each machine, and one button to upgrade it all. |
| [Sources](sources.md) | The package sources of each machine, with a switch to enable or disable each one. |
| [Config and features](config-and-features.md) | Every Chocolatey config setting and every feature switch, per machine, with the description from the CLI source. |
| [Pins](pins.md) | Hold a package at its current version so that upgrades skip it. |
| [API keys](api-keys.md) | See which sources have a stored API key on a machine, add one, or remove one, without the key value ever being shown. |
| [Cache, templates, rules, licence and support](cache-templates-and-info.md) | A page of small readers for the remaining CLI commands. |
| [Package builder](package-builder.md) | Forms for the commands that create and publish packages: `new`, `pack`, `push` and `export`. |
| [Bulk actions and exports](bulk-actions-and-exports.md) | Tick several rows and act on all of them, or export a list as CSV, JSON or Markdown. |

## Remote management

| Feature | In one line |
| --- | --- |
| [Hub](hub.md) | A web app that manages many Windows machines from one place. The same server also runs inside the desktop app for the local PC. |
| [Hub container image](hub-container.md) | The hub as a container image with a volume for its data, a health check and a non-root user. |
| [Sign in](sign-in.md) | Sign in to the hub with a password or a passkey, with lockout after failures, and sessions that expire. |
| [Passkeys](passkeys.md) | Sign in to the hub with a fingerprint, a face, a device PIN or a security key. The password stays as the fallback. |
| [Users and roles](users-and-roles.md) | More than one person can sign in to a hub, each with a role: admin, operator or viewer. |
| [Pairing](pairing.md) | A one time code joins a Windows machine to a hub. |
| [Remote agent](remote-agent.md) | The part of the app that connects a Windows machine to a hub, runs the jobs it is given, and streams the output back. |
| [Read only agents](read-only-agents.md) | A machine can be paired so that it reports everything and changes nothing. |
| [Command allow lists](command-allow-lists.md) | Limit a machine to a chosen set of Chocolatey commands, enforced by the hub and, when set on the machine, by the agent itself. |
| [Machine selection and groups](machine-scope-and-groups.md) | Choose which machines the pages show and act on, and label machines with groups. |
| [Jobs and live output](jobs-and-live-output.md) | Every command becomes a job with a state, live output, an exit code and a log you can export. |
| [Offline job queue](offline-job-queue.md) | A command for a machine that is switched off waits for it, for up to 7 days. |
| [Schedules](schedules.md) | Run a command every day, or on chosen days of the week, on all machines, a group, or a chosen set. |
| [History](history.md) | An append-only record of who did what on the hub, with export. |
| [Status webhooks](status-webhooks.md) | The hub posts a short message to an address of your choice when a job fails, a machine stays offline, or sign in is locked out. |
| [Secret masking](secret-masking.md) | Source passwords and API keys are replaced with `********` wherever a command is recorded or displayed. |
| [Secrets at rest](secrets-at-rest.md) | The hub encrypts the secret values it has to keep on disk, and is plain about what that does and does not protect. |
| [Hub HTTP API](hub-http-api.md) | The JSON API that the interface and the agents use, documented with a Postman collection. |

## Safety and feedback

| Feature | In one line |
| --- | --- |
| [Two key confirmation](two-key-confirmation.md) | Destructive actions need two separate keys and then a slider before they run. |
| [Install result takeovers](install-result-takeovers.md) | Every install or upgrade that finishes takes over the screen: a celebration on success, an alarm with the exit code and the last output on failure. |
| [Notifications](notifications.md) | Short messages that do not block your work, and a list of them behind the bell. |
| [Loading, empty, offline and error states](truthful-states.md) | Every page says what is actually true: loading, nothing here yet, offline, or failed and why. |

## Interface

| Feature | In one line |
| --- | --- |
| [Overview](overview.md) | The first page: what needs attention across the selected machines, and one button to upgrade everything. |
| [First-run wizard](first-run-wizard.md) | A four step setup that does real work on the first start, and can be skipped. |
| [Command palette](command-palette.md) | Press `Ctrl+Shift+F` anywhere to search every page, command and setting, and act on the result. |
| [Keyboard shortcuts](keyboard-shortcuts.md) | One list of shortcuts that the key handler, the menus, the command palette and the Help page all read, so a shortcut that is shown is the shortcut that works. |
| [Tabs](tabs.md) | Every page is a tab in a strip on the left. All are open at first; close, pin and reopen them as you like. |
| [Context menus with a filter](context-menus.md) | Right click anything for its actions. Every menu opens with a filter field already focused. |
| [Filters and regex](filters-and-regex.md) | A foldable filter bar on every list, with plain text by default and regular expressions on request. |
| [Pattern builder](pattern-builder.md) | Describe the text you are looking for, and the builder writes the regular expression. |
| [Settings that explain themselves](settings.md) | Each setting says what it does and whether its value is the built-in default, and can be reset on its own. |
| [Changelog viewer](changelog-viewer.md) | The changes of each version, inside the app, with a filter and an export. |
| [Help page](help-page.md) | Help that works offline: short articles, the keyboard shortcuts, and the help text of every Chocolatey command. |
| [Phone layout](phone-layout.md) | The hub's interface works at phone width, so you can check on machines and start an upgrade from a phone. |

## Built-in tools

| Feature | In one line |
| --- | --- |
| [Base64 tools](base64-tools.md) | Turn text or a file into Base64 and back, entirely in the browser. |

## Language, look and comfort

| Feature | In one line |
| --- | --- |
| [Language modes](language-modes.md) | English, Hong Kong Cantonese, or both at once, with a separate tone setting for each language. |
| [Personal wording file](personal-wording-file.md) | Load a JSON file that replaces words in the interface with your own, kept on your device. |
| [School mode](school-mode.md) | A plain mode for shared or public screens: English only, no playful options, with an optional PIN. |
| [Theme and seed colour](theme-and-seed-colour.md) | Light and dark themes, both derived from one seed colour that you can change. |
| [Custom logo and presets](custom-logo-and-presets.md) | Put your own mark in the top bar, and apply a named set of appearance settings with one click and an undo. |
| [Timed settings](timed-settings.md) | Let settings switch by the clock: a dark theme in the evening, quieter results at night. |
| [Accessibility tools](accessibility-tools.md) | Text size, contrast, motion, target size and focus ring, one click from every page. |
| [Sound and narration](sound-and-narration.md) | Short action sounds, and an optional voice that reads job results aloud. |
| [Focus modes](focus-modes.md) | Five separate switches that reduce what is on screen or add gentle structure. All are off by default. |

## Desktop app and delivery

| Feature | In one line |
| --- | --- |
| [Desktop app](desktop-app.md) | A Windows app that manages Chocolatey on the PC it runs on, and can also connect that PC to a hub. |
| [Windows installer](windows-installer.md) | A Squirrel.Windows `Setup.exe`, built by the release workflow with the repository's own Chocolatey CLI inside. It is not code signed. |
| [Version and build time](version-and-build-time.md) | The version and the build time of the running copy are on the first screen and on every page. |

## How to add a page

Add `<name>.md` here with a title, one lead paragraph and the four sections, add the name to `GROUPS` in `site/tools/generate.mjs`, add a row above, and run `node site/tools/generate.mjs`.
