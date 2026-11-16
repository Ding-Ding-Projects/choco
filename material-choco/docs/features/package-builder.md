# Package builder

Forms for the commands that create and publish packages: `new`, `pack`, `push` and `export`.

## What it is

The **Package builder** page has four cards. Each opens the generated form for its command with a preview and a machine choice.

## How to use it

- **New package from a template** runs `choco new`. Give the package name and, if needed, `--output-directory`.
- **Pack a nuspec into a nupkg** runs `choco pack` on a `.nuspec` path.
- **Push a nupkg to a source** runs `choco push`.
- **Export installed packages** runs `choco export` on the machine.

Paths are paths on the target machine, not on the device you are browsing from. To get a `packages.config` into your browser, use **Export all** on the Installed page.

## What was checked

Test `secrets are masked in the recorded command` covers the API key of `push`. The page has no dedicated named check.

## Known limits

- There is no file browser for the remote machine. You type paths.
- Exercised with the test stand-in only.

## Related

- [API keys](api-keys.md)
- [Installed packages](installed-packages.md)
- [Console](console.md)
