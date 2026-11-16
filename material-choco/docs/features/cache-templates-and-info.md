# Cache, templates, rules, licence and support

A page of small readers for the remaining CLI commands.

## What it is

The **Cache and templates** page has one card per command. Each runs on the first online machine in the selection and shows the output in place:

- **HTTP cache:** `choco cache list`, plus **Remove expired** and **Remove all**.
- **Templates:** `choco template list`.
- **Package rules:** `choco rule list`.
- **Licence:** `choco license info`.
- **Support:** `choco support`.

## How to use it

Press the button on a card. **Remove all** on the cache asks for the [two key confirmation](two-key-confirmation.md) and runs on every selected machine.

## What was checked

No dedicated named check. The cards use the same run-and-show path as package information.

## Known limits

- Output is shown as the CLI printed it. The row formats of `template list` and `rule list` were written from the source and not confirmed against real output.
- Exercised with the test stand-in only.

## Related

- [Console](console.md)
- [Package builder](package-builder.md)
