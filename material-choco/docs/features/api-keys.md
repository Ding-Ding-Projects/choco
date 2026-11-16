# API keys

See which sources have a stored API key on a machine, add one, or remove one, without the key value ever being shown.

## What it is

The **API keys** page runs `choco apikey list` on the first online machine in the selection and shows the sources that have a key, each marked **stored, hidden**. Keys are kept by the CLI on the machine. The hub does not show or keep the values.

## How to use it

- **List keys** reads the list.
- **Add a key** opens the form for `choco apikey add`.
- **Remove a key** opens the form for `choco apikey remove` and asks for the [two key confirmation](two-key-confirmation.md).

## What was checked

Test `secrets are masked in the recorded command` in `test/core.test.js`.

## Known limits

- A key you add passes through the hub in memory and waits in the job queue until the agent takes the job. It is encrypted in the hub's data file while it waits, and removed from the stored job when the job ends; see [secrets at rest](secrets-at-rest.md) for what that does and does not protect.
- The row format of `apikey list` was written from the source and not confirmed against real output. If it does not parse, the page shows the raw output.

## Related

- [Secret masking](secret-masking.md)
- [Package builder](package-builder.md): pushing a package
- [Security model](../articles/security-model.md)
