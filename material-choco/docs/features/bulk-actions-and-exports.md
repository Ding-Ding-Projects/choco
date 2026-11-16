# Bulk actions and exports

Tick several rows and act on all of them, or export a list as CSV, JSON or Markdown.

## What it is

Lists with a tick box in each row act on several rows at once: packages, machines, sources and jobs. A bar appears that names the count and the actions. Rows that an action cannot apply to are skipped, and the result says how many and why. Removing in bulk asks for the [two key confirmation](two-key-confirmation.md) once and names every affected item.

**Export** writes a list as CSV for spreadsheets (UTF-8), as JSON with one object per row, or as a Markdown table, or copies the Markdown. It holds the ticked rows, or every row that matches the filter when none is ticked. Passwords and API keys are never part of these exports.

## How to use it

- **Installed:** upgrade, pin, save as `packages.config`, uninstall.
- **Machines:** refresh inventory, upgrade everything, act on these only (sets the machine selector), make read only, allow changes, remove from hub.
- **Sources:** enable or disable the ticked sources.
- **Jobs:** cancel the ticked jobs, save their logs.
- Use the **Export** button on a list and choose the format.

## What was checked

End to end checks `machines can be selected for bulk actions`, `bulk refresh queues one inventory read per selected machine`, `machines export as CSV holds the selected rows`, `machines export as Markdown is a table`, `bulk disable changes the selected source through a real job`, `bulk cancel reports the jobs it skipped and why`, `jobs export as JSON follows the list` and `history export honours the active filter`.

## Known limits

- A bulk action is one job per row or per machine, not one transaction. Some can succeed while others fail; the Jobs page shows each.
- Selections are cleared when the page is reloaded.

## Related

- [Installed packages](installed-packages.md)
- [Machine selection and groups](machine-scope-and-groups.md)
- [History](history.md)
