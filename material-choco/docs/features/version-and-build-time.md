# Version and build time

The version and the build time of the running copy are on the first screen and on every page.

## What it is

The sign in screen, the top bar, the first-run wizard and **Settings**, **About and changelog** show the version and when that copy was built. The values are read from a file written by the release build, not from the time the app was started. A copy that did not come from the release build says **build time unavailable** instead of inventing a time.

The **About** tab also holds the [changelog viewer](changelog-viewer.md).

## How to use it

Look under the product name in the top bar. Quote the version and build time when you report a problem.

## What was checked

Visible in the screenshots, which were taken from a development copy and therefore read "build time unavailable".

## Known limits

- Outside a release build the version is the one in the app's package file and the build time is unavailable.

## Related

- [Changelog viewer](changelog-viewer.md)
- [Windows installer](windows-installer.md)
- [Settings that explain themselves](settings.md)
