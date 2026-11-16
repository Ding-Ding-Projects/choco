# Changelog viewer

The changes of each version, inside the app, with a filter and an export.

## What it is

**Settings**, **About and changelog** reads the changelog file that ships inside the build, so it works offline. Each version is a section that folds, with a count of its changes. A filter with a regex switch and the [pattern builder](pattern-builder.md) searches the versions and their changes and says how many are shown. **Export shown changes** writes what the filter left.

The same tab states the version, the build time, and the number of commands, options, settings and features in the CLI schema of this build.

## How to use it

Open the tab, type in **Filter changes**, fold or unfold a version.

## What was checked

End to end checks `changelog viewer shows version sections` and `changelog filter narrows the changes and says how many`.

## Known limits

- It shows the file that shipped with the build. It does not fetch newer notes from the network.
- There is no date picker and there are no links to commits.

## Related

- [Version and build time](version-and-build-time.md)
- [Bulk actions and exports](bulk-actions-and-exports.md)
