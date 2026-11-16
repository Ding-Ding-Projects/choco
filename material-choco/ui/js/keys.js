// One list of keyboard shortcuts. The key handler, the menus, the command palette and the Help
// page all read it, so a shortcut that is shown is the shortcut that works.
export const KEYS = [
  { id: 'palette', keys: 'Ctrl+Shift+F', label: 'Open the command palette' },
  { id: 'updates', keys: 'Ctrl+Shift+U', label: 'Go to Updates', page: 'updates' },
  { id: 'jobs', keys: 'Ctrl+Shift+J', label: 'Go to Jobs', page: 'jobs' },
  { id: 'machines', keys: 'Ctrl+Shift+M', label: 'Go to Machines', page: 'machines' },
  { id: 'history', keys: 'Ctrl+Shift+H', label: 'Go to History', page: 'history' },
  { id: 'settings', keys: 'Ctrl+Shift+S', label: 'Go to Settings', page: 'settings' },
  { id: 'help', keys: 'F1', label: 'Open Help', page: 'help' },
  { id: 'a11y', keys: 'Ctrl+Shift+A', label: 'Open accessibility tools' },
  { id: 'refresh', keys: 'Ctrl+Shift+E', label: 'Refresh the inventory of the selected machines' },
  { id: 'notices', keys: 'Ctrl+Shift+L', label: 'Open notifications' },
  { id: 'nextTab', keys: 'Alt+PageDown', label: 'Go to the next open tab' },
  { id: 'prevTab', keys: 'Alt+PageUp', label: 'Go to the previous open tab' },
  { id: 'filter', keys: '/', label: 'Focus the filter of the current page, when not typing' },
  { id: 'tabUp', keys: 'Alt+ArrowUp', label: 'Move the focused tab up in the tab strip', local: true },
  { id: 'tabDown', keys: 'Alt+ArrowDown', label: 'Move the focused tab down in the tab strip', local: true },
  { id: 'context', keys: 'Shift+F10', label: 'Open the context menu of the focused element', local: true },
  { id: 'escape', keys: 'Escape', label: 'Close the open dialog or menu', local: true },
];
export const keyOf = (id) => KEYS.find((k) => k.id === id)?.keys;
export const keyOfPage = (page) => KEYS.find((k) => k.page === page)?.keys;
// The id of the global shortcut an event stands for, or null.
export function matchKey(e) {
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  const combo = [(e.ctrlKey || e.metaKey) && 'Ctrl', e.altKey && 'Alt', e.shiftKey && key !== '/' && 'Shift', key].filter(Boolean).join('+');
  return KEYS.find((k) => !k.local && k.keys === combo)?.id || null;
}
