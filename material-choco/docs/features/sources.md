# Sources

The package sources of each machine, with a switch to enable or disable each one.

## What it is

The **Sources** page lists every source the machine reported: name, location, priority, flags such as authenticated, certificate or bypass proxy, and whether it is enabled.

## How to use it

- Flip the switch on a row to run `choco source enable` or `disable`.
- **Add source** opens the form for `choco source add` with all of its options, including user, password and certificate.
- The row menu offers **Edit**, which re-adds the source under the same name with the fields filled in, **Copy location**, and **Remove**.

Tick several sources to enable or disable them together; see [bulk actions and exports](bulk-actions-and-exports.md). Removing a source asks for the [two key confirmation](two-key-confirmation.md). A source password is masked in the recorded command.

## What was checked

Test `secrets are masked in the recorded command` in `test/core.test.js` covers source passwords. The page is captured by the end to end run and has no dedicated named check.

## Known limits

- Editing is a re-add, because that is how the CLI updates a source. Fields the inventory does not report, such as the password, have to be entered again.
- Exercised with the test stand-in only.

## Related

- [Discover and install](discover-and-install.md)
- [Secret masking](secret-masking.md)
- [API keys](api-keys.md)
