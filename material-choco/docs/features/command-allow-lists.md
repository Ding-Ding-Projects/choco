# Command allow lists

Limit a machine to a chosen set of Chocolatey commands, enforced by the hub and, when set on the machine, by the agent itself.

## What it is

Two separate lists can apply to a machine:

- **The hub's list**, set by an admin. The hub accepts only the listed commands for that machine. An empty list allows inventory refreshes only.
- **The agent's own list**, set on the machine with `--allow`. The agent enforces it by itself, and the hub cannot change it.

A job for a command outside either list is not created: the request reports that machine as skipped, with the reason, the same way as for read only machines. Schedules skip such machines. An agent refuses such a job even if a hub sends it. Inventory refreshes run fixed read only queries and are always allowed.

## How to use it

- **In the hub:** open the machine's menu on **Machines**, choose **Rename, groups, policy**, and under **Allowed commands** pick **Only the ticked commands** and tick them. **Every command** removes the restriction.
- **On the machine:**

```
MaterialChoco.exe --agent enroll --hub https://hub.example:8443 --code XXXX-XXXX --allow list,outdated,upgrade
MaterialChoco.exe --agent run --allow list,outdated
```

`--allow all` removes the agent's list. The dialog in the hub shows the agent's own list when it has one.

Only an admin can change the hub's list and the read only switch. Operators see both without being able to change them.

## What was checked

- `test/allowlist.test.js`: `the runner refuses commands outside the local allow list`, `the hub refuses jobs outside a machine allow list`, `schedules skip machines whose allow list excludes the command`, `an empty list allows inventory only, and null removes the restriction`, `the agent enforces its own allow list even when the hub does not know about it`, `the agent command line takes --allow and keeps it in its own config`.
- End to end checks `the allow list set in the dialog stops a command outside it and lets others through` and `an operator sees the allow list read only and a locked read only switch`.

## Known limits

- The list names commands, not subcommands, options or packages. Allowing `upgrade` allows upgrading anything.
- The hub's list protects against mistakes and against accounts with lesser roles. Only the agent's own list still holds if the hub itself is taken over.
- Exercised with the test stand-in for `choco.exe`, on Linux.

## Related

- [Read only agents](read-only-agents.md)
- [Users and roles](users-and-roles.md)
- [Remote agent](remote-agent.md)
