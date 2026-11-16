# Required-feature inventory

The maintainer keeps a catalogue of features that every app of theirs is expected to have. It has 118 entries in 14 categories. This file gives the honest state of each one for Material Choco, recounted by hand on 2026-11-16 against the source, the tests and the end to end run. The entries are described here in plain words.

## How to read it

| State | Meaning |
| --- | --- |
| **Done** | It meets the intent of the entry for this app, and it was exercised. The check or the evidence is named. |
| **Partial** | Something real exists and works, but the entry asks for more. The row says exactly what is missing. A feature that works but that no check exercises is also Partial. |
| **Written, never run** | The code exists and has never been executed where it matters (on Windows). |
| **Not built** | Nothing exists. |
| **Not applicable** | The entry cannot apply to this product. The row says why. |
| **Waived** | The maintainer decided on 2026-11-16 that this app does not have it. |

This count is deliberately strict. "Done" does not mean "something with that name exists". Shipped features that go beyond the catalogue, such as roles, passkeys and command allow lists, are documented under [features](features/README.md) and are not counted here.

Every check named below ran against a test stand-in for `choco.exe`, on Linux. Nobody has installed the app on Windows and run a real install through it. That limit applies to every row.

## Totals

| State | Entries |
| --- | --- |
| Done | 14 |
| Partial | 58 |
| Written, never run | 3 |
| Not built | 29 |
| Not applicable | 12 |
| Waived | 2 |
| **Total** | **118** |

Per category (Done + Partial + Written + Not built + Not applicable + Waived = entries):

| Category | Done | Partial | Written | Not built | N/A | Waived | Entries |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Language, voice and personalisation | 0 | 10 | 0 | 2 | 1 | 0 | 13 |
| Design, appearance and layout | 1 | 9 | 0 | 1 | 0 | 0 | 11 |
| Navigation, search and commands | 1 | 10 | 0 | 1 | 0 | 0 | 12 |
| Safety, locks and sign in | 2 | 0 | 0 | 3 | 0 | 2 | 7 |
| Records, history and messages | 0 | 6 | 0 | 1 | 0 | 0 | 7 |
| Built-in tools and hand-off | 0 | 2 | 0 | 8 | 2 | 0 | 12 |
| Completeness and evidence | 1 | 5 | 0 | 2 | 0 | 0 | 8 |
| Site and shared links | 2 | 6 | 0 | 0 | 1 | 0 | 9 |
| Status reporting | 0 | 0 | 0 | 3 | 1 | 0 | 4 |
| Build and install | 0 | 3 | 3 | 1 | 1 | 0 | 8 |
| Release pipeline | 1 | 4 | 0 | 2 | 1 | 0 | 8 |
| Repository records | 6 | 3 | 0 | 5 | 0 | 0 | 14 |
| Deliverables of the instructions repository | 0 | 0 | 0 | 0 | 3 | 0 | 3 |
| Games | 0 | 0 | 0 | 0 | 2 | 0 | 2 |
| **Total** | **14** | **58** | **3** | **29** | **12** | **2** | **118** |

Column sums: 0+1+1+2+0+0+1+2+0+0+1+6+0+0 = 14. 10+9+10+0+6+2+5+6+0+3+4+3+0+0 = 58. 0+0+0+0+0+0+0+0+0+3+0+0+0+0 = 3. 2+1+1+3+1+8+2+0+3+1+2+5+0+0 = 29. 1+0+0+0+0+2+0+1+1+1+1+0+3+2 = 12. 0+0+0+2+0+0+0+0+0+0+0+0+0+0 = 2. And 14+58+3+29+12+2 = 118.

## Language, voice and personalisation (13)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 1 | Product wording for job documents | Not applicable | Applies to products about job applications. |
| 2 | Three language modes | Partial | English, Hong Kong Cantonese and bilingual work (`bilingual mode shows the Cantonese line`, `Cantonese mode translates a new page`). Text of the newer pages is fully covered; several older pages still hold English sentences that do not go through the translation helper. |
| 3 | Tone sliders per language and the dialog emoji switch | Partial | Both sliders and the switch work (`playful wording changes the voice and keeps the facts`). Playful variants exist for a limited set of messages, not for every message. |
| 4 | Personal wording file upload | Partial | Upload, whole-file validation, replace and clear work (`invalid personal wording file is refused whole`, `clearing the wording file restores the original wording`). It changes text that goes through the wording helpers only. |
| 5 | Drop a personal wording file anywhere | Partial | Implemented with the same validation. The checks call the validation and apply path; no check performs the drop gesture itself. |
| 6 | School mode | Partial | Forces English, hides playful features, renamable, optional PIN (`school mode suspends the wording file`). It is not shared with other apps on the computer. |
| 7 | Spoken narrator with voice pickers | Partial | Narrates job results only. No check can assert speech. |
| 8 | Action sounds with a switch | Partial | Sounds and the switch exist. No check exercises them. |
| 9 | Settings that change on a schedule or from an outside source | Partial | Timed rules for six settings and a theme schedule (`an active timed rule replaces the setting without changing the stored value`, `timed windows handle midnight and weekdays`). Not for language, colour or fonts, and no outside source. |
| 10 | Renaming the app | Partial | Title bar, top bar and tab title. Not used in notifications. |
| 11 | Five separate focus modes | Partial | All five switches exist in simple forms. No check exercises them. |
| 12 | Food surprise at startup | Not built | |
| 13 | Public photo source for that surprise | Not built | |

0 Done + 10 Partial + 2 Not built + 1 Not applicable = 13.

## Design, appearance and layout (11)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 14 | Material Design 3 Expressive conformance | Partial | Buttons, fields, switches, checkboxes, chips, sliders and selects are Material Web components. Cards, tables, tabs, menus and dialogs are hand-written on the same tokens. There is no register of components per surface. |
| 15 | Separate destinations and working window controls | Partial | Every page is its own destination and the end to end run navigates all of them. The frameless desktop window and its controls have only been started once on Linux and never on Windows. |
| 16 | Motion with a complete reduced motion path | Partial | Motion in every state, a motion setting and timed rules for it. The reduced motion path was written by rule and never captured or reviewed. |
| 17 | Live charts | Partial | One live line of active jobs. No scrubbing, no keyboard reading of points. |
| 18 | Appearance editor for every element | Not built | |
| 19 | Continuous colour picker with a translator | Partial | Hue and vividness field, keyboard path, HEX input, readouts in four notations with a contrast figure. No named colours, CMYK or LAB input. |
| 20 | Logo customisation | Partial | Custom picture upload checked by content, with reset (`a logo file that is not a picture is refused by its content`, `an uploaded logo is shown in the top bar from local storage`). No set of ready-made logos and no conversion of other formats. |
| 21 | Overlays that stay inside the window | Partial | Menus and dialogs paint their own surface, stay in the viewport and scroll. Not draggable or resizable. |
| 22 | Collapsible filters | Partial | Filter bars fold, remember it per page and show the number of active filters. No check exercises folding. |
| 23 | Accessibility tools and layout without clipping | Partial | Tools menu for text size, contrast, motion, targets, focus ring and theme. No audit, no screen reader pass, no check of the larger sizes. |
| 24 | Working controls and truthful empty states | Done | No sample data ships. `empty state is truthful before any machine`, `webhooks start empty and say so`, and the five checks whose names begin `no browser console errors`, one per run (admin, operator, viewer, passkey, desktop stand-in). |

1 Done + 9 Partial + 1 Not built = 11.

## Navigation, search and commands (12)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 25 | First-run wizard that does real setup | Partial | Four steps that do real work, with Back, Next and Skip (`first run wizard opens after setup`). Only the first step is exercised, progress is not saved, and it is not fully translated. |
| 26 | Extension support | Not built | |
| 27 | Browser-style tabs | Partial | Every tab open at first, close, pin, reopen, reorder by drag and by keyboard, persisted (`a tab can be moved with the keyboard and the order persists`, `a tab can be moved by drag and drop`). No groups, no docking to another edge, no overflow surface, no tab search. |
| 28 | Full regex workbench on every search | Partial | A regex switch on every filter and a five-part pattern builder with live preview (`pattern builder composes an anchored pattern and previews matches`). Far from a full workbench: no replace, no explanation of a pasted pattern, no flavours. |
| 29 | Command palette on Ctrl+Shift+F | Partial | Pages, commands, every CLI command, settings, shortcuts and machines, with live switches for on or off settings, a jump to the exact setting, two sizes and a pattern builder (`Ctrl+Shift+F opens the palette and filters`). Other setting types have no inline control, and help articles are not listed. |
| 30 | Context menu on every element | Partial | Rows, tabs and machines have their own menu and everything else a general one (`context menu opens on an element without its own`). The general menu has no element-specific actions. |
| 31 | Menus show the shortcuts that work | Done | One list feeds the key handler, the menus, the palette and Help (`menus show the shortcuts that are registered`, `help lists every keyboard shortcut`). |
| 32 | Real controls wherever a value is shown | Partial | Source, feature, webhook, user and timed rule switches act in place. Most table cells are still text. |
| 33 | Guided forms | Partial | Forms are generated from the CLI with previews and a dry run. No step by step guidance, and few fields offer real data to pick from. |
| 34 | Information button on every control | Partial | Every CLI option, every page filter and several cards have one (`every page filter has an info button that explains it in place`). Many controls do not. |
| 35 | Settings that explain themselves | Partial | Each setting has an explanation, says whether its value is the built-in default, and can be reset. No check asserts those lines. |
| 36 | Starting points for empty editors | Partial | Appearance presets with undo (`a preset writes exactly the settings it names`) and two schedule presets. Other dialogs open with plain defaults. |

1 Done + 10 Partial + 1 Not built = 12.

## Safety, locks and sign in (7)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 37 | Two key confirmation for destructive actions | Done | `slider is locked before both keys`, `one key and a full slider does not confirm`, `uninstall runs only after both keys and the slider`, `a passkey is deleted after the two key confirmation`. |
| 38 | Locks on individual elements | Not built | |
| 39 | Recovery desk for a locked-out person | Not built | |
| 40 | Play-your-way-out unlock steps | Not built | |
| 41 | Built-in authenticator for one time codes | Waived | Built, then removed on 2026-11-16 by decision of the maintainer. |
| 42 | QR code for registering a one time code | Waived | Confirmed by the maintainer on 2026-11-16. Follows from the row above: the hub has no one time code step. The QR code for pairing a machine is a different feature and exists. |
| 43 | Free, and honest about it | Done | Nothing is paid, gated or advertised; there is no payment code in the source. |

2 Done + 3 Not built + 2 Waived = 7.

## Records, history and messages (7)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 44 | Local version history of the person's records | Partial | An append-only history of actions on the hub (`history records actions`). No versions of settings, schedules or other records that could be restored. |
| 45 | Export everything | Partial | Lists export as CSV, JSON and Markdown; job logs, `packages.config` and settings export too (`machines export as CSV holds the selected rows`, `jobs export as JSON follows the list`, `history export honours the active filter`). Not every view, and three formats only. |
| 46 | Bulk actions on every list | Partial | Packages, machines, sources and jobs (`bulk refresh queues one inventory read per selected machine`, `bulk cancel reports the jobs it skipped and why`). Not history, notifications, schedules, users or webhooks. |
| 47 | Changelog viewer | Partial | Versions as folding sections with a filter and export (`changelog viewer shows version sections`). No dates, no commit links. |
| 48 | Offline documentation browser | Partial | Help holds short articles, the shortcuts and the help of every CLI command (`help has offline articles for the new tools`). The full feature documents are on the site and in the repository, not inside the app. |
| 49 | Text from providers shown as formatted text | Not built | The app shows no release notes or issue text. |
| 50 | Non-blocking notifications with a centre | Partial | Notifications with actions and a list behind the bell (`the notification centre shows the replaced wording`). The list is lost on reload and has no bulk actions. |

6 Partial + 1 Not built = 7.

## Built-in tools and hand-off (12)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 51 | File converter | Not built | |
| 52 | Base64 toolkit | Partial | Text and files, standard and URL-safe, strict decoding with the position of the fault (`base64 encodes UTF-8 text`, `base64 reports invalid input instead of guessing`). No MIME variant, no line length option, no lenient mode. |
| 53 | Type generator and JSON editor | Not built | |
| 54 | Virtual disk manager | Not built | |
| 55 | Game server creator and manager | Not built | |
| 56 | World generator for those servers | Not built | |
| 57 | Local AI model manager | Not built | |
| 58 | Hand-off to an external editor | Not built | |
| 59 | Download dialogs for a browser extension | Not applicable | Applies to browser extensions. |
| 60 | Publishing a repository to a code host | Not applicable | The app does not publish repositories. |
| 61 | Progress where an operation started, recovery where it broke | Partial | Jobs show live progress and failed jobs offer recovery actions (`failed job shows exit code and output`). Dialogs close when a job is queued instead of showing its progress in place. |
| 62 | Drawing and annotation | Not built | |

2 Partial + 8 Not built + 2 Not applicable = 12.

## Completeness and evidence (8)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 63 | This inventory, and every feature in every surface | Partial | The inventory exists and is recounted. The parity it asks for is what this file shows is not reached. |
| 64 | Version and build time on the first screen | Partial | Shown on the sign in screen and the top bar. Every observed copy says "build time unavailable", because no copy from the release build has been started. |
| 65 | Real screenshots wherever a surface is described | Partial | 44 real captures from the end to end run, used in both READMEs, the site and the guides. The CLI in them is a stand-in, not every state is captured, and they were not taken on Windows. |
| 66 | Screen recording | Not built | |
| 67 | Comparison of the build with the design reference | Partial | The design boards were rendered to pictures and two were compared with captures by eye. There is no tool that renders the reference and no frame by frame comparison. |
| 68 | Design files in the repository | Done | `design/material-choco`: 27 boards, each with accent and motion controls, plus rendered frames. A larger pass with a board per required feature is in progress and not published. |
| 69 | Clipping check at many sizes and scales | Not built | The app has one overflow check at one phone width. |
| 70 | Public screenshot gallery | Partial | The site has a gallery of every capture with a viewer. The entry asks for a separate public gallery, which does not exist. |

1 Done + 5 Partial + 2 Not built = 8.

## Site and shared links (9)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 71 | Landing site that carries every feature | Partial | Live at <https://ding-ding-projects.github.io/choco/> with download, guides, a page per feature, gallery, command palette and theme toggle. It has no language modes, tabs, settings page or the other app-wide features the entry asks a site to mirror. |
| 72 | Phone-friendly site | Partial | Measured at 320, 360, 390, 768 and 1360 px with no sideways scroll and 44 px targets. In emulation only: no real phone, no landscape, no larger text sizes. |
| 73 | Installer download button | Partial | Points at the release file and shows version, size and date. The address comes from a live lookup of the releases, not from a validated release manifest, and without scripts the button links to the releases page. |
| 74 | An article per feature on the site | Partial | 61 feature pages and 11 guides, each ending with related pages. English only. |
| 75 | Fonts vendored by a script | Partial | Fonts are copied from npm packages by `scripts/build-vendor.mjs` and served locally. Latin subset only, no manifest of hashes. |
| 76 | A real picture when a link is shared | Partial | Every page carries the tags and a card made from the real icon and a real capture. There is no copy of the card at the repository root, the repository's own preview picture has not been uploaded, and no chat app was tested. |
| 77 | Site linked from the repository | Done | The repository's website field reads back `https://ding-ding-projects.github.io/choco/` (read on 2026-11-16), and the root README links the site. |
| 78 | No private wording before sign in | Done | Neither the site nor the app ships private wording. A scan of every public text file of the site, the documents and the records against the maintainer's private word list finds 0 matches. |
| 79 | Landing site packaged as an app, for private repositories | Not applicable | This repository is public. |

2 Done + 6 Partial + 1 Not applicable = 9.

## Status reporting (4)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 80 | Registration with the maintainer's status hub | Not built | |
| 81 | Chat bridge for that hub | Not built | |
| 82 | Alarm dispatch through that hub | Not built | The app's own status webhooks are a different feature and exist. |
| 83 | Frames for a small display | Not applicable | Suspended in the catalogue by the maintainer. |

3 Not built + 1 Not applicable = 4.

## Build and install (8)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 84 | `build.bat` and `build-installer.bat` | Written, never run | They exist in `material-choco/`, because the repository root holds the CLI's own `build.bat`. Neither has been run. |
| 85 | One command that builds and runs on a fresh Windows | Written, never run | `build.bat` is written to do this. Never run. |
| 86 | Script that fetches every dependency | Not built | No separate script. `build.bat` is written to fetch Node.js itself. |
| 87 | Everything bundled in the installer | Partial | The release workflow builds the CLI from this repository and packs it into the installer. The installed app has never been started, so working offline is unproven. |
| 88 | Squirrel.Windows installer | Partial | `Setup.exe`, `RELEASES` and the full package are published by the workflow. No delta packages, and never installed. |
| 89 | Signing only where a format requires it | Not applicable | Nothing in the release requires a signature. Releases are unsigned and say so. |
| 90 | Automatic updates | Written, never run | The desktop shell is written to check the newest release, and the interface announces a downloaded update (`a downloaded update is announced as not code signed`, against a stand-in for the desktop shell). Never run on Windows. |
| 91 | Original icon, packaged | Partial | A multi-resolution icon is in the repository and the installer was built with it. Nobody has seen it installed. |

3 Partial + 3 Written, never run + 1 Not built + 1 Not applicable = 8.

## Release pipeline (8)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 92 | A release on every push | Done | `.github/workflows/material-choco-release.yml`. Run 43807632449 was green and published `material-choco-v0.1.2`; later pushes published later versions. |
| 93 | Workflow timing in the release notes | Partial | The notes state the build time in seconds. Not the start and end times the entry asks for. |
| 94 | Line counts in the release notes, counted by the workflow | Partial | The workflow counts and states one total. No counter script in the repository and no table by kind. |
| 95 | Photo references in releases | Not built | |
| 96 | Code names for releases | Not built | |
| 97 | Workflow jobs that set up their own tools | Partial | The jobs install what they need on hosted runners. There is no written inventory of those tools. |
| 98 | Choosing a runner by inspection | Partial | Hosted runners only, chosen in the file. Nothing is inspected first. |
| 99 | Encrypted builder for private repositories | Not applicable | This repository is public. |

1 Done + 4 Partial + 2 Not built + 1 Not applicable = 8.

## Repository records (14)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 100 | README with folded sections | Done | The root README and `material-choco/README.md`. |
| 101 | Estimate of the time a person would need | Done | In `material-choco/README.md`, beside the line count and the command that produced it. |
| 102 | Sanitised copy of the shared instructions | Not built | |
| 103 | Agent vocabulary block in `AGENTS.md` | Done | |
| 104 | Lock tied to the private word list | Not built | |
| 105 | Roadmap as a checklist | Done | `ROADMAP.md`. |
| 106 | One document per feature | Done | `docs/features`: 61 documents and an index, each with what it is, how to use it, what was checked and known limits. |
| 107 | Postman collection | Done | Generated from the route table; a unit test fails when it no longer matches. |
| 108 | Wiki and site kept current | Partial | The site source is current. There is no wiki. |
| 109 | Handoff record | Partial | `HANDOFF.md` is current. No handoff section was posted to an issue. |
| 110 | Closeout prompt | Partial | `CLOSEOUT_PROMPT.md` is current in the working tree. The entry also asks for proof that it reached the remote, which this pass did not do. |
| 111 | Discussions as a running record | Not built | |
| 112 | Project board | Not built | |
| 113 | Operational skill for the repository | Not built | |

6 Done + 3 Partial + 5 Not built = 14.

## Deliverables of the instructions repository (3)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 114 to 116 | Three files that only the maintainer's instructions repository has | Not applicable | This is not that repository. |

3 Not applicable = 3.

## Games (2)

| # | Entry | State | Notes |
| --- | --- | --- | --- |
| 117, 118 | Two entries about game content | Not applicable | This product is not a game. |

2 Not applicable = 2.

## What changed since the first count

The first count, on 2026-11-15, read 28 done, 33 partial, 1 written and not run, 48 not built and 8 not applicable. Much was built since, yet "Done" fell from 28 to 14, because this count applies a stricter rule: an entry is Done only when it meets the intent of the catalogue for this app and a named check exercised it. Many rows that were "Done" are now "Partial" with the missing part named. "Not built" fell from 48 to 29.
