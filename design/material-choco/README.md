# Material Choco design files

Export of the design canvas for Material Choco, made on 2026-11-15. The hosted canvas is a viewing surface; this folder is the record.

These files are a design. They are not the implementation and do not prove any behaviour. The running app is in `material-choco/` and its real screenshots are in `material-choco/docs/screenshots`.

## Contents

- `canvas.json`: the canvas index. One page per feature category, boards in rows.
- `*.dc.html`: one artboard per file. Each is self-contained HTML; open it in a browser to see it. The `support.js` line belongs to the design tool and is not needed for viewing.
- `frames/`: each artboard rendered to a PNG with headless Chrome, used for the review below.

## Pages and boards

| Page | Boards |
| --- | --- |
| Front door | `Main` (overview), `Onboarding` |
| Packages | `Installed`, `Install`, `Updates` |
| Configuration | `Config` |
| Console and authoring | `Console` |
| Remote fleet | `Machines`, `Job`, `PairQr` |
| Required features | `Settings`, `Palette` |
| States and errors | `StateLoading`, `StateError`, `StateSuccess`, `StateEmpty`, `InstallSuccess`, `InstallError` |
| Built-in tools | `Base64`, `Authenticator` |
| Search | `RegexBuilder` |
| Hub security | `PasskeySignIn`, `Users`, `Webhooks` |
| Landing site | `Site`, `SitePhone` |
| Phone | `Phone` |
| Desktop app | `Desktop` |

## Look

Material Design 3 Expressive. One seed colour (a burnt cocoa, `#8A3F0B`), teal and berry as supporting colours, neutral low-chroma surfaces, a dark hero block. Roboto Flex at 112% width for display text, Roboto for body, Roboto Mono for commands. Shapes are large and deliberately uneven on hero panels. Motion: staggered spring entrance, press squash, hover lift, a morphing shape, a live pulse, a wave progress bar, shimmer skeletons, an error shake with an alarm ring, a self-drawing tick with confetti. Every animation is disabled under `prefers-reduced-motion`.

A first version was more restrained. It was replaced the same day at the maintainer's request for a bolder look with motion in every state, error states included.

## Install result takeovers (added 2026-11-16)

`InstallSuccess` and `InstallError` are full-screen takeovers shown when an install or upgrade finishes. Success: the screen opens like an iris, rotating rays, expanding rings, a stamped and morphing medal with a self-drawing tick, a sprung headline, falling confetti; it closes on click, Escape, or after 5 seconds. Failure: a white flash, scan lines, a quake, a stamped cross, a glitching headline, the exit code and the last lines of output, and two actions; it stays until dismissed. Under reduced motion the rays, rings, confetti, flash and scan lines are removed and the panel appears in place. Both were rendered to `frames/` and compared with the real app captures `27` and `28` in `material-choco/docs/screenshots`. Difference: the app adds an emoji to the headline when the dialog emoji setting is on, and shows flying shards on failure.

## Second pass (2026-11-16)

Nine boards were added for surfaces that were being built at the same time: QR pairing, Base64 tools, the built-in authenticator, the regex builder, passkey sign in, users and roles, status webhooks, and the landing site on desktop and phone. They were rendered to `frames/` and reviewed; two findings were fixed (the logo inside the landing hero shape was drawn too small, and the sign-in fields were spread apart). The QR pattern on the boards is illustrative, not a scannable code. Text in square brackets on the landing boards marks values that the live page looks up. These boards were drawn while the code was written, so the built screens may differ; compare with `material-choco/docs/screenshots` before relying on them.

## Tweaks (added 2026-11-16)

Every board declares two working levers in the design tool's Tweaks tab, with the same names and defaults on all 28 boards:

| Tweak | Type | Default | Effect |
| --- | --- | --- | --- |
| `accent` | colour, with four swatches | `#8A3F0B` | Replaces the primary colour everywhere it is used on the board. |
| `motion` | switch | on | Off stills every animation and transition on the board. |

The board files therefore contain `{{accent}}` where the primary colour goes, and a wrapper with a `{{motionClass}}` class; the design tool fills these in. Opened directly in a browser without the tool, those two placeholders are not filled, so use `frames/` for a faithful picture. The frames were rendered before the placeholders were added and show the default values. The Tweaks were not exercised inside the design tool from the build session, so their behaviour there is unverified.

## Stageshow skill

The pass is required to install the Stageshow skill fresh and follow it. The fresh install was blocked in the build session, so the maintainer's pinned copy at upstream commit `299140fafd08df55a9c234e610c3f64af3f45531` was used, as the fallback rule allows. No comparison between a fresh install and the pinned copy could be made, so the pinned copy was not refreshed.

- Read: `SKILL.md` (the idea, failure modes, workflow, fault list, example index).
- Not read in full: `references/craft.md`, `references/framing.md`, `references/rehearse.md`, `references/review.md`. Only their headings were checked. This is a gap in the pass.
- Gold example copied: none. The skill's examples and kit are React marketing illustrations; these boards are static product screens in the design tool's own format.
- Rules applied: real words only where they carry meaning, clear hierarchy with one focal object per board, no decorative gradients, no purple, no sparkles, no made-up third-party logos, stroke icons instead of emoji, every motion has a cause.
- Rules not applicable: the cursor script, stage cropping and bleed, the phone frame kit, loop seams, poster frames. These are for animated marketing demos.

## Review from the rendered frames

Findings fixed in the canvas and re-rendered:

1. Status badges inside stat cards stretched to the full card width.
2. A button label in the attention table wrapped onto two lines.
3. The language switch stretched across its card.
4. The seed colour read-out showed the first version's colour code.

Open, and why:

- Frames are static, so motion was reviewed by reading the keyframes, not by filming.
- The frames were rendered without the design tool's runtime; fonts come from Google Fonts at render time.
- Sample machine and package names on the boards are illustrative.

## Differences between the design and the built app

- The app uses Material Web components for controls, so buttons, switches and fields differ slightly from the boards.
- The install board shows grouped option sections; the app shows all options in one filterable grid.
- The app adds pages the boards do not show: pins, API keys, cache and templates, package builder, schedules, history, help.
