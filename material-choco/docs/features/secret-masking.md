# Secret masking

Source passwords and API keys are replaced with `********` wherever a command is recorded or displayed.

## What it is

The command schema marks the options that carry secrets. When the hub builds the display form of a command it replaces the values of those options. That masked form is what appears in the preview, the job list, notifications, the history and exported logs' headers. The **API keys** page lists sources and never values, and secret config values show as **set**.

## How to use it

Nothing to turn on. Type a secret into its field in a form and check the preview: it shows `********`.

## What was checked

- Test `secrets are masked in the recorded command` in `test/core.test.js`.
- Test `history is recorded and secrets stay out of it` in `test/hub.test.js`.

## Known limits

- The real value travels through the hub in memory. While the job waits it is stored encrypted, and the agent receives the real value. See [secrets at rest](secrets-at-rest.md) for the limits of that encryption.
- Masking applies to option values the schema marks as secret. A secret typed as a positional argument, or printed by the CLI or a package script in its output, is not masked.

## Related

- [Secrets at rest](secrets-at-rest.md)
- [Security model](../articles/security-model.md)
- [API keys](api-keys.md)
- [Sources](sources.md)
