# Config and features

Every Chocolatey config setting and every feature switch, per machine, with the description from the CLI source.

## What it is

The **Config and features** page shows two columns for each machine. On the left are the config settings: 11 in the schema at the time of writing, each with its description and current value or a **default** badge. On the right are the features: 30 at the time of writing, each as a switch with its description and the CLI default. Settings or features that a machine reports and the schema does not know are listed too.

## How to use it

- Flip a feature switch to run `choco feature enable` or `disable` on that machine.
- Open a setting, type a value and choose **Set**. **Unset** removes the stored value so the CLI default applies again, and asks for the [two key confirmation](two-key-confirmation.md).
- The filter narrows both columns by name and description.

Values of settings that the CLI marks as secret are shown as **set**, not as text.

## What was checked

End to end check `config page lists every CLI feature`.

## Known limits

- A change is one job per machine. To change many machines at once, use the [Console](console.md) with several machines ticked.
- Exercised with the test stand-in only.

## Related

- [Command schema](command-schema.md)
- [Console](console.md)
- [Filters and regex](filters-and-regex.md)
