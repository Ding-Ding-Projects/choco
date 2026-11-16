# Context menus with a filter

Right click anything for its actions. Every menu opens with a filter field already focused.

## What it is

Package rows, machine rows, source rows and tabs have a menu of their own actions. It opens from the three dots on the row, a right click, or `Shift+F10`. Everything else opens a general menu: copy the text under the pointer, search everything, refresh the inventory, accessibility tools and settings. Text fields, code blocks and logs keep the browser's own menu, so copy, paste and spelling tools stay available. Every menu starts with a filter field, so typing narrows the items. Destructive items are coloured as such, and an item that has a keyboard shortcut shows it. The menu stays inside the window and returns focus to where it was opened.

## How to use it

Open a menu, type a few letters, press `Enter` to run the first match. Arrow keys move through the items. `Escape` clears the filter first and closes the menu on the second press.

## What was checked

End to end checks `row menu opens with a filter field focused`, `context menu opens on an element without its own` and `menus show the shortcuts that are registered`.

## Known limits

- Only rows, tabs and machines have actions of their own. Other elements get the general menu.
- The menu filter is plain text.

## Related

- [Installed packages](installed-packages.md)
- [Tabs](tabs.md)
- [Finding your way around](../articles/finding-your-way-around.md)
