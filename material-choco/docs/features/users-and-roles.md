# Users and roles

More than one person can sign in to a hub, each with a role: admin, operator or viewer.

## What it is

| Role | May do |
| --- | --- |
| Admin | Everything, including users, webhooks, removing machines, and machine policy (read only, allowed commands) |
| Operator | Run any command, cancel jobs, pair machines, rename and group machines, create and edit schedules |
| Viewer | Read machines, jobs and their output, schedules and history. Refresh an inventory and run plain read only queries such as `list`, `outdated`, `search` and `info` |

The account created at setup is an admin. The hub enforces the role on every request and answers with a refusal when the role does not allow it; the interface also leaves out controls that the role cannot use and says which role you have. The last enabled admin cannot be deleted, disabled or given another role. A role change, disabling an account and a password reset take effect on that person's open sessions at once.

## How to use it

Admins open **Users and roles**:

- **Add a user** with a name, a role and a first password of at least 10 characters. Tell the person the password yourself; they can change it in Settings.
- Change a role with the buttons on the row, or switch an account off with its **Enabled** switch.
- The row menu has **Reset password** and **Delete user**. Deleting asks for the [two key confirmation](two-key-confirmation.md).

Your own role is shown in the top bar. Every user action is written to the [History](history.md), without passwords.

## What was checked

- `test/roles.test.js`, among them `a viewer cannot change anything`, `a viewer may refresh the inventory and run plain read only queries`, `an operator cannot remove machines or change machine policy`, `the last administrator cannot be removed, demoted or disabled` and `a role change, a disabled account and a reset password take effect on live sessions`.
- End to end checks `users are added with their roles through the Users page`, `an operator sees the role and no admin pages`, `the hub answers 403 to an operator for admin actions`, `a viewer is not offered upgrade, import or uninstall on Installed` and `the hub answers 403 to a viewer for changes and accepts a plain query`.

## Known limits

- **Job output and the history are visible to every role.** Do not give an account to someone who should not read them.
- Three fixed roles. There are no custom roles and no limiting of a user to some machines.
- A new user gets a password chosen by the admin. There are no invitations by email and no self-service password recovery.
- Not available in the desktop app, which has one local user who is always admin.

## Related

- [Sign in](sign-in.md)
- [Command allow lists](command-allow-lists.md)
- [Security model](../articles/security-model.md)
