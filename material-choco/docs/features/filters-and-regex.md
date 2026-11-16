# Filters and regex

A foldable filter bar on every list, with plain text by default and regular expressions on request.

## What it is

Machines, Installed, Config and features, Jobs, History and Help have a filter bar: a text field, a **Regex** switch, and chips specific to the page, such as **Outdated only**, **Online**, **Active** or **Failed**. Folding the bar is remembered per page, and a folded bar shows how many filters are active. The command palette has the same regex switch.

Regular expressions are compiled safely: a pattern that does not compile shows its error and matches nothing, patterns longer than 200 characters are refused, and matching looks at the first 2,000 characters of each item. Matching ignores case.

## How to use it

Type to filter. Turn on **Regex** for a pattern such as `^git|zip$`, or press the button beside the switch to open the [pattern builder](pattern-builder.md), which writes the pattern for you. Each filter has an information button that explains it in place. Press `/` to jump to the filter of the current page. Click the bar's heading to fold it.

## What was checked

End to end checks `a built pattern filters the list it was opened from`, `every page filter has an info button that explains it in place` and `Ctrl+Shift+F opens the palette and filters`.

## Known limits

- Filter bars keep plain text matching by default. Regular expressions are opt-in per filter.
- Filter text is kept while the app is open and cleared on reload.

## Related

- [Pattern builder](pattern-builder.md)
- [Command palette](command-palette.md)
- [Context menus with a filter](context-menus.md)
- [History](history.md)
