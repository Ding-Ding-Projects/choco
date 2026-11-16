# Required-feature inventory

The maintainer's shared catalogue lists 117 feature ids; its category table adds up to 118 entries, which is the number counted here. This is the honest state of each for Material Choco 0.1.0, written by hand on 2026-11-15. "Done" means it works in the running app and was exercised. "Partial" names what is missing. "Written, not run" means the code exists and has never been executed on Windows.

Count by catalogue entry: 28 done, 33 partial, 1 written and not run, 48 not built, 8 not applicable. Several rows below stand for more than one entry and say how many.

## Language, voice and personalisation

| Feature | State | Notes |
| --- | --- | --- |
| Language modes: English, Cantonese, bilingual | Partial | Navigation, headings, common actions and job messages are translated. Most page body text is English only. |
| Funny-level sliders and dialog emoji switch | Partial | Two sliders, shipped at 5. Six messages have playful variants. The emoji switch works. |
| Personal wording file upload | Partial | Upload, full validation with the size and depth limits, replace, clear. Applies to translated strings only. |
| Drop a personal wording file anywhere | Done | Validated with the same rules, celebration headline, sounds, reduced motion path. |
| School mode | Partial | Forces English, hides playful features, renamable, PIN to turn off. Not shared with other apps. |
| Spoken narrator with voice pickers | Partial | Narrates job results only. Off by default. Voice pickers, rate, pitch. |
| Action sounds with a switch | Done | |
| Scheduled and external settings sources | Not built | |
| Renaming the app | Partial | Title bar and tab title. Recorded in history. Not yet used in notifications. |
| Focus modes (five separate toggles) | Partial | All five work, in simple forms. No documentation of interactions with school mode. |
| Startup food surprise and its public photo source | Not built | Two catalogue items. |
| Job document label | Not applicable | Not a job-related product. |

## Design, appearance and layout

| Feature | State | Notes |
| --- | --- | --- |
| Material Design 3 Expressive conformance | Partial | Buttons, fields, switches, checkboxes, chips, sliders and selects are Material Web components. Cards, tables, tabs, menus and sheets are hand-written CSS on the same tokens. No per-surface component register. |
| Destinations instead of one long page, frameless desktop window | Done | Window verified on Linux under a virtual display only. |
| Motion with a complete reduced-motion path | Done | Enter, press, hover, page change, loading, success and error motion, plus full-screen takeovers for every install and upgrade result. Reduced motion checked by rule, not by capture. |
| Live charts | Partial | One live line of active jobs. No scrub, no keyboard scrubbing. |
| Per-element appearance editor | Not built | |
| Infinite colour picker and translator | Partial | Continuous hue and vividness field, keyboard path, HEX input, HEX, RGB, HSL and OKLCH readouts, contrast figure. No CMYK, LAB, named colours or rainbow. |
| Logo customisation | Not built | |
| Overlays and panels | Partial | Menus and sheets stay inside the viewport and scroll. Not resizable or draggable. |
| Collapsible filters | Done | State persists per page and shows the count of active filters when closed. |
| Accessibility tools and layout without clipping | Partial | Tools menu, text size, contrast, motion, target size, focus ring. No formal audit, no screen reader pass, no scale matrix. |
| Working controls and truthful empty states | Done | No sample data ships. Empty, offline and error states say what is true. |

## Navigation, search and commands

| Feature | State | Notes |
| --- | --- | --- |
| First-run wizard that does real setup | Done | |
| Extension support | Not built | |
| Browser-style tabs | Partial | Left strip, every tab open by default, close, pin, reopen, persisted. No drag reorder, groups or docking to other edges. |
| Regex on every search surface | Partial | Every filter and the palette have a regex switch with safe compile. No regex builder. |
| Command palette on Ctrl+Shift+F | Done | Pages, commands, every CLI command, settings, shortcuts, machines. Live switches for on or off settings. Jumps to and highlights the setting. |
| Context menu on every element | Partial | Package rows, machine rows, source rows, tabs. Every menu opens with a filter. Not on every element. |
| Shortcuts shown in menus | Partial | Shown where a shortcut exists. Few shortcuts exist. |
| Rich controls wherever a value is shown | Partial | Source and feature switches act in place. |
| Guided forms | Partial | Forms are generated from the CLI with previews and dry run. No step-by-step guides. |
| Info button per control | Partial | Every CLI option has one. Other controls do not. |
| Settings that explain themselves | Done | Each setting has an explanation and says whether the value is the built-in default. |
| Presets for blank editors | Not built | |

## Safety, locks and sign in

| Feature | State | Notes |
| --- | --- | --- |
| Two key confirmation for destructive actions | Done | Two keys, then a slider, emergency exit, Escape. Checked end to end. |
| Per-element locks, recovery desk, unlock ladder | Not built | Three catalogue items. |
| Built-in authenticator and QR pairing | Not built | The hub supports authenticator codes at sign in; it is not an authenticator itself. |
| Free and honest | Done | Nothing is paid or gated. |

## Records, history and messages

| Feature | State | Notes |
| --- | --- | --- |
| Local history | Done | Append-only log on the hub. |
| Export everything | Partial | History as CSV, JSON, Markdown. Job logs. packages.config. Settings. |
| Bulk actions | Partial | Installed packages only. |
| Changelog viewer | Partial | Shows the changelog file. No date filter, no commit links. |
| Offline documentation | Partial | Help page with CLI help text from source. Short app articles. |
| Notifications and their centre | Done | |
| Rendered provider text | Not built | |

## Built-in tools

| Feature | State | Notes |
| --- | --- | --- |
| File converter, Base64 tools, type generator, disk manager, game server tools, local model manager, external editor hand-off, download hand-off, forge publishing, drawing | Not built | Eleven catalogue items. None is started. |
| Progress where it started, recovery where it broke | Partial | Job states with recovery actions. |

## Completeness and evidence

| Feature | State | Notes |
| --- | --- | --- |
| This inventory | Done | |
| Version and build time on the first screen | Done | Shows "build time unavailable" outside a release build. |
| Real screenshots | Done | Captured from the running app by the end to end run. The CLI is a test fixture in those captures. |
| Screen recording | Not built | |
| Design reference parity | Partial | Built from the design files. Not compared frame by frame. |
| Design files in the repository | Done | `design/material-choco`. |
| Clipping matrix | Not built | One phone-width overflow check only. |
| Public screenshot gallery | Not built | |

## Site and shared links

| Feature | State | Notes |
| --- | --- | --- |
| Landing site, phone-friendly site, download button, feature articles, link preview image, homepage link | Not built | Six catalogue items. |
| Vendored fonts | Done | In the app. |
| Private wording only after sign in | Done | No private wording ships. A personal file stays in the browser. |

## Status reporting

| Feature | State | Notes |
| --- | --- | --- |
| Status hub, chat bridge, panic webhooks, display frames | Not built | Four catalogue items. |

## Build and install

| Feature | State | Notes |
| --- | --- | --- |
| Build entry points | Written, not run | `build.bat` and `build-installer.bat` in this folder. The repository root already has the CLI's own `build.bat`. |
| One build-and-run command, dependency fetcher | Partial | `build.bat` fetches a portable Node.js when needed. Not run on Windows. |
| Everything bundled | Partial | The workflow built the CLI from this repository and packed it into the installer. Not yet installed and started on Windows. |
| Squirrel.Windows installer | Partial | Built by the workflow: Setup.exe, RELEASES and the full .nupkg. Not yet installed on Windows. No delta packages. |
| Self-signing | Not built | Releases say they are unsigned. |
| Automatic updates | Not built | |
| Original icon | Done | `desktop/icon.ico`, multi-resolution. |

## Release pipeline

| Feature | State | Notes |
| --- | --- | --- |
| A release on every push | Done | `.github/workflows/material-choco-release.yml`, first green run published `material-choco-v0.1.2`. |
| Timing and line counts in release notes | Partial | Both are written by the workflow. |
| Photo references and code names in releases | Not built | Two catalogue items. |
| CI bootstrap, runner selection | Partial | Hosted runners only. |
| Encrypted public builder | Not applicable | This repository is public. |

## Repository records

| Feature | State | Notes |
| --- | --- | --- |
| README with folded sections | Done | `material-choco/README.md`. The root README is the Chocolatey project's own. |
| Effort estimate beside line counts | Done | |
| Agent vocabulary block in AGENTS.md | Done | |
| Sanitised instruction mirror, vocabulary hash lock | Not built | Two catalogue items. |
| Roadmap checklist | Done | |
| One document per feature | Not built | This single inventory instead. |
| Postman collection | Done | Generated from the route table. |
| Handoff record and closeout prompt | Done | Files only. No issue section was posted. |
| Wiki sync, discussions, project board, operational skill | Not built | Four catalogue items. |

## Not applicable to this product

| Feature | State | Notes |
| --- | --- | --- |
| Items that apply only to the instructions repository (three), to games (two), or to private repositories (one) | Not applicable | |

## Waived by the maintainer

| Feature | Date | Notes |
| --- | --- | --- |
| Built-in authenticator, and authenticator codes at hub sign in | 2026-11-16 | The maintainer decided this app has no authenticator codes. Sign in is passkey or password. |
