# Two key confirmation

Destructive actions need two separate keys and then a slider before they run.

## What it is

A dialog that states the action, for example the exact uninstall command and the number of machines, and holds it until three things are done: key A is on, key B is on, and the slider has been dragged to the end. The slider is disabled until both keys are on. Turning a key off, or letting go of the slider early, resets it. **Emergency exit** and `Escape` cancel.

It guards: uninstalling packages, removing a source, unsetting a config value, removing an API key, clearing the whole HTTP cache, removing a machine from the hub, deleting a user, deleting a passkey, resetting every setting, and the `uninstall`, `unpackself`, `remove` and `unset` commands in the Console.

## How to use it

1. Read the sentence at the top.
2. Press **Hold key A** and **Hold key B**. Each stays on until pressed again.
3. Drag the slider all the way, or focus it and press `End`.

A line under the slider says whether both keys are held, and is announced to assistive technology.

## What was checked

End to end checks in `test/e2e/run.mjs`: `slider is locked before both keys`, `one key and a full slider does not confirm`, `uninstall runs only after both keys and the slider`.

## Known limits

- It guards against accidents by one person. It is not a second person's approval.
- It cannot be turned off or relaxed per action.
- Not reviewed with a screen reader.

## Related

- [Confirming destructive actions](../articles/confirming-destructive-actions.md): the guide
- [Read only agents](read-only-agents.md)
- [Command preview and dry run](command-preview-and-dry-run.md)
