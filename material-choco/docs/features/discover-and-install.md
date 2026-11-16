# Discover and install

Search the package sources of a machine and install from the results, with a single click or with every install option.

## What it is

The **Discover** page runs `choco search` on the first online machine in the current selection, against that machine's enabled sources, and lists package ids with their latest versions. Chips add `--prerelease` and `--exact`.

## How to use it

1. Open **Discover**, type a search and press Enter.
2. **Install** on a result installs it on the selected machines with the default options.
3. **Options** opens the full install form: version, source, parameters, checksums and every other option of `choco install`, with a preview and a dry run.
4. The information button shows `choco info` for the package.

When an install finishes, the [full-screen result](install-result-takeovers.md) appears.

## What was checked

The end to end checks `install failure takes over with exit code and output` and `upgrade success takes over the screen` cover installs queued through the same job path. The search page itself has no dedicated named check.

## Known limits

- Searches go through a machine, not through the hub, so at least one selected machine must be online.
- Results show id and version only. There are no descriptions, icons or download counts.
- Not yet run against real sources through the app.

## Related

- [Sources](sources.md)
- [Installed packages](installed-packages.md)
- [Command preview and dry run](command-preview-and-dry-run.md)
