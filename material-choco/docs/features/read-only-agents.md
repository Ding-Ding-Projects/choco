# Read only agents

A machine can be paired so that it reports everything and changes nothing.

## What it is

A read only agent refuses every command that changes the machine or publishes something: `install`, `upgrade`, `uninstall`, `unpackself`, `push`, and every subcommand of `pin`, `source`, `config`, `feature`, `apikey` and `cache` other than `list`, `get` and `info`. Inventory, `search`, `list`, `info`, `outdated` and dry runs with `--what-if` still work.

It is enforced in two places. The hub refuses to queue such a job for a read only machine and says why. The agent checks again on the machine and refuses with its own message, so a hub that was tampered with cannot talk a read only agent into a change.

## How to use it

Any one of:

- Turn on **Read only agent** before creating the pairing code.
- Add `--read-only` to `--agent enroll` on the machine.
- Later, as an admin, open the machine's menu, **Rename, groups, policy**, and turn on read only. This later switch is enforced by the hub only; the agent keeps the setting it was paired with.

A read only machine has a **Read only** badge on every page. Schedules skip it for commands that would change it.

## What was checked

- Test `read only machines refuse changes in the hub and in the agent` in `test/hub.test.js`.
- Test `classify marks changing and destructive commands` in `test/core.test.js`.
- End to end check `read only machine refuses a change`.

## Known limits

- The agent stores the read only setting it was paired with. If a machine was paired as read only, turning the switch off in the hub does not lift it: the agent keeps refusing until it is enrolled again. If read only is turned on later in the hub, only the hub enforces it.
- The classification is by command name. It has not been reviewed against every option of the real CLI.

## Related

- [Pairing](pairing.md)
- [Command allow lists](command-allow-lists.md): a finer limit than read only
- [Command preview and dry run](command-preview-and-dry-run.md)
- [Security model](../articles/security-model.md)
