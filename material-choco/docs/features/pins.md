# Pins

Hold a package at its current version so that upgrades skip it.

## What it is

The **Pins** page lists the pinned packages of each machine with their pinned version, and offers a selector of the installed packages that are not pinned yet.

## How to use it

- Choose a package under **Package to pin** and press **Pin**.
- **Unpin** on a row removes the pin.
- On the **Installed** page, the row menu and the bulk bar also pin and unpin.

A pinned package still appears on the Updates page, marked as pinned, and is left out of **Upgrade everything**.

## What was checked

The page is captured by the end to end run. Pinning uses the same job path as the checks `a job runs on the agent, streams output and refreshes inventory`; it has no dedicated named check.

## Known limits

- Pinning to a version other than the installed one is done from the [Console](console.md) with the `version` option of `choco pin add`.
- Exercised with the test stand-in only.

## Related

- [Updates](updates.md)
- [Installed packages](installed-packages.md)
