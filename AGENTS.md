# Agent notes for this repository

This is a fork of the Chocolatey CLI. The `material-choco/` folder holds a desktop app and a remote management hub built on top of it; read `material-choco/README.md`, `material-choco/HANDOFF.md` and `material-choco/ROADMAP.md` before changing it. Design files live in `design/`.

- Do not change the CLI source under `src/` for app work. After a CLI option changes, run `node material-choco/scripts/gen-schema.mjs`.
- Run `npm test` and `npm run test:e2e` in `material-choco/` before pushing, and record the real results in `HANDOFF.md`.
- Update `ROADMAP.md`, `HANDOFF.md` and `docs/FEATURE-INVENTORY.md` in the same change as the work they describe.

## Agent conversation vocabulary

Agents working in this repository use the shared private conversation vocabulary defined in
the maintainer's canonical agent instructions for every reply, including chat prose, visible
reasoning, status lines, and task or session titles. Read those instructions and apply them
in full. They are deliberately not restated here, because this file is part of this
repository's public record.

That vocabulary never appears in anything published. Keep it out of commit messages, branch
names, code, code comments, test names, documentation, this file, issues, pull requests,
discussions, release notes, published sites, logs, and every other file in this repository.
Published writing uses ordinary professional English, and exact technical identifiers always
keep their literal spelling. The single documented public-safe exception is named in those
canonical instructions; do not infer any other.

Scan any text bound for a public surface against that vocabulary before publishing it. A
reviewer cannot tell a correct release note from a leaking one by reading it, so the scan is
a step, not a habit.
