# Guides

How-to guides for Material Choco. They are the source of the guide pages on the [project site](https://ding-ding-projects.github.io/choco/articles/): `site/tools/generate.mjs` turns each file here into a page.

| Guide | What it covers |
| --- | --- |
| [Getting started on one PC](getting-started.md) | Install the desktop app and manage Chocolatey on the PC it runs on |
| [Running the hub in a container](hub-in-a-container.md) | Start the hub, create the administrator, turn on HTTPS |
| [Pairing and remote agents](pairing-and-remote-agents.md) | Connect Windows machines to a hub, with or without a desktop session |
| [Security model](security-model.md) | What the hub can do, how it is protected, and what is not built |
| [Every command and option](commands-and-options.md) | The Console, the generated forms, preview and dry run |
| [Jobs, schedules and history](jobs-schedules-and-history.md) | What happens after you press Run |
| [Confirming destructive actions](confirming-destructive-actions.md) | Two keys and a slider |
| [Install result takeovers](install-result-takeovers.md) | Full-screen success and failure screens |
| [Languages and accessibility](languages-and-accessibility.md) | Language modes, wording, text size, contrast, motion |
| [Finding your way around](finding-your-way-around.md) | Tabs, the command palette, menus, filters, the phone layout |
| [Build and test from source](build-and-test.md) | Development setup, tests, what the release workflow does |

Each shipped feature also has its own reference page under [../features](../features/README.md).

Honest status of everything described here: the automated checks run against a test stand-in for `choco.exe`, on Linux and on Windows. The released app was also installed on Windows 11 and used with its real CLI on 2026-11-16. See [HANDOFF.md](../../HANDOFF.md).
