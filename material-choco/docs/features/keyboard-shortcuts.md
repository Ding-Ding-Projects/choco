# Keyboard shortcuts

One list of shortcuts that the key handler, the menus, the command palette and the Help page all read, so a shortcut that is shown is the shortcut that works.

## What it is

| Keys | Action |
| --- | --- |
| `Ctrl+Shift+F` | Open the command palette |
| `Ctrl+Shift+U` | Go to Updates |
| `Ctrl+Shift+J` | Go to Jobs |
| `Ctrl+Shift+M` | Go to Machines |
| `Ctrl+Shift+H` | Go to History |
| `Ctrl+Shift+S` | Go to Settings |
| `F1` | Open Help |
| `Ctrl+Shift+A` | Open accessibility tools |
| `Ctrl+Shift+E` | Refresh the inventory of the selected machines |
| `Ctrl+Shift+L` | Open notifications |
| `Alt+PageDown`, `Alt+PageUp` | Go to the next or previous open tab |
| `/` | Focus the filter of the current page, when not typing |
| `Alt+ArrowUp`, `Alt+ArrowDown` | Move the focused tab up or down in the tab strip |
| `Shift+F10` | Open the context menu of the focused element |
| `Escape` | Close the open dialog or menu |

This table is copied from `ui/js/keys.js`. If the two ever differ, the file is right.

## How to use it

Press the keys. The Help page lists them, menus show them beside the matching item, and the palette finds them by name.

## What was checked

End to end checks `Ctrl+Shift+M goes to Machines`, `menus show the shortcuts that are registered`, `help lists every keyboard shortcut` and `Ctrl+Shift+F opens the palette and filters`.

## Known limits

- Shortcuts cannot be changed.
- Some combinations are also browser shortcuts in some browsers, where the browser may win. In the desktop app there is no such conflict.
- Global shortcuts work after sign in.

## Related

- [Command palette](command-palette.md)
- [Context menus with a filter](context-menus.md)
- [Tabs](tabs.md)
