# Console

One page that offers every Chocolatey command with every one of its options, as a form.

## What it is

The Console lists all commands from the [command schema](command-schema.md). Selecting one builds a form: subcommands as buttons, a field for positional arguments, a switch for each flag, a text field for each option that takes a value, and a folded section with the global options. Each option has an information button showing its description and accepted spellings from the CLI source. A filter field appears when a command has more than six options.

## How to use it

1. Open **Console** and pick a command on the left. The palette entry `choco <name>` opens the same place.
2. Fill in arguments and options. **Command that will run** updates as you type.
3. Tick the machines under **Run on**.
4. **Run** queues the job. **Copy** copies the command text. **Schedule** opens a new schedule with this command.

`uninstall`, `unpackself` and any `remove` or `unset` subcommand ask for the [two key confirmation](two-key-confirmation.md).

## What was checked

End to end checks `console preview shows the exact command` and `failed job shows exit code and output` in `test/e2e/run.mjs`.

## Known limits

- The form does not know which options conflict. The CLI reports such errors in the job output.
- Arguments are split on spaces; use double quotes around an argument that contains a space.
- Exercised with the test stand-in only.

## Related

- [Command preview and dry run](command-preview-and-dry-run.md)
- [Every command and option](../articles/commands-and-options.md): the guide
- [Schedules](schedules.md): run a Console command on a timetable
