# Command palette

Press `Ctrl+Shift+F` anywhere to search every page, command and setting, and act on the result.

## What it is

A search dialog over everything in the app: pages, commands such as **Upgrade everything** and **Refresh inventory**, every Chocolatey command (opening in the Console), every setting, keyboard shortcuts, and paired machines. On or off settings appear with a live switch that works inside the palette. Choosing a setting opens Settings on the right tab, scrolls to the setting and highlights it.

## How to use it

- Open it with `Ctrl+Shift+F` or the search field in the top bar.
- Type. Arrow keys move, `Enter` opens, `Escape` closes.
- **Regex** switches the query to a regular expression, and the palette has its own [pattern builder](pattern-builder.md). An invalid pattern shows its error.
- **Full window** and **Card size** switch the size; the choice is remembered.

## What was checked

End to end checks `Ctrl+Shift+F opens the palette and filters` and `the palette has its own pattern builder`.

## Known limits

- It searches names and short descriptions, not package lists or job output.
- Results are capped at 60.
- The shortcut works after sign in.

## Related

- [Finding your way around](../articles/finding-your-way-around.md): the guide
- [Settings](settings.md)
- [Filters and regex](filters-and-regex.md)
