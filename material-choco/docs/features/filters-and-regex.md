# Filters and regex

A search on every page and in every category that lists something, each with its own regular expression switch and pattern builder beside it.

## What it is

Every page that lists things has a search: Overview (what needs attention, and recent jobs, each with its own search), Machines, Installed, Discover (a filter over the results, separate from the search of the package feed), Updates, Sources, Config and features, Pins, API keys (once keys are read), Cache and templates (cached entries, templates and rules, each with its own search), Package builder (its tools and their options), Console (the command list, and the options of the chosen command), Jobs, Schedules, History, Users, Status webhooks and Help. The Settings page has one search across all its categories: matching settings from every category are shown, each labelled with its category. Context menus, the New tab catalogue, the notification list, the changelog and the command palette have one too.

Next to every search are a **Regex** switch and a pattern builder button. Each search keeps its own text, regex choice and error, so changing one never changes another, and a page that redraws with new data keeps what was typed. Below the list a line says how many items are shown, and an empty result says so in words. Only the Base64 tools page has no search, because it shows no list.

Regular expressions are compiled safely: a pattern that does not compile shows its error and matches nothing, patterns longer than 200 characters are refused, and matching looks at the first 2,000 characters of each item. Matching ignores case.

The landing site has the same idea for its own lists: the feature index, the guides index, the screens gallery and the site's command palette each have a search with a regex switch and a pattern builder written for the site.

## How to use it

Type to filter. Turn on **Regex** for a pattern such as `^git|zip$`, or press the `(.*)` button beside the switch to open the [pattern builder](pattern-builder.md), which writes the pattern for you and fills the search it was opened from. Each page filter has an information button that explains it in place. Press `/` to jump to the filter of the current page. Click a filter bar's heading to fold it.

## What was checked

End to end checks `every page that has something to search has a search with a Regex switch and a pattern builder` (a hand-written list of every page, with the reason for each page that has nothing to search), `the Settings search finds a setting in a category other than the open one`, `the Console command search narrows the commands, and Regex applies a pattern`, `a built pattern filters the list it was opened from`, `every page filter has an info button that explains it in place` and `Ctrl+Shift+F opens the palette and filters`. On the site, `site/tools/check-searches.mjs` checks that the feature index, the guides index and the screens page each have a labelled search and a regex builder. Each of these checks was seen failing when a search was removed, and passing once it was put back. The clipping check passes at all 36 sizes with the new searches, including text at 200 percent on a 320 px screen.

## Known limits

- The pattern builder composes a pattern from parts and previews it; it is not a full regular expression workbench (no replace, no explanation of a pasted pattern, no choice of flavour).
- Filter text is kept while the app is open and cleared on reload.
- The API keys search appears once a machine's keys are read and keys exist.

## Related

- [Pattern builder](pattern-builder.md)
- [Command palette](command-palette.md)
- [Context menus with a filter](context-menus.md)
- [History](history.md)
