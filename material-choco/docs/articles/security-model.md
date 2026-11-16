# Security model

What a hub is able to do, how it is protected in this version, and what is not built yet. Read this before you make a hub reachable by anyone but yourself.

> **The short version.** The hub can install software with administrator rights on every machine paired with it. Hub access is administrator access to all of those machines. Serve it over HTTPS, keep passwords strong, add a passkey, give each person the least role that does their work, and do not expose it to the internet without a reason.

## Who trusts whom

- **You trust the hub** with the ability to run Chocolatey commands on every paired machine.
- **Each machine trusts the hub** it was paired with. The agent connects out to the hub; the hub never connects in.
- **The desktop app on its own** trusts only the person at the keyboard. Its built-in hub listens on `127.0.0.1` only and signs the window in with a one time launch token.

## Sign in

| Protection | Detail |
| --- | --- |
| Passwords | At least 10 characters. Stored as salted scrypt hashes |
| Lockout | After 5 failed attempts for the same name from the same address, sign in is refused for 30 seconds, doubling with each further failure up to 15 minutes |
| Sessions | A random token in an `HttpOnly`, `SameSite=Strict` cookie, marked `Secure` behind HTTPS. The hub keeps only a hash. A session ends 12 hours after its last use |
| Cross-site requests | Any changing request whose `Origin` is not the hub itself is refused |
| Passkeys | Optional. The hub stores a public key only. A challenge works once, the site must match, and a sign counter that goes backwards is refused. Tested with a software passkey device only |
| One time codes | None. The maintainer removed authenticator codes on 2026-11-16. Sign in is a password or a passkey |
| Setup | Works once. There is no default account |

## Users and roles

A hub can have several users. Each has one role, and the hub checks it on every request.

| Role | May do |
| --- | --- |
| Admin | Everything, including users, webhooks, removing machines and machine policy |
| Operator | Run commands, cancel jobs, pair machines, rename and group machines, edit schedules |
| Viewer | Read everything, refresh inventories, run plain read only queries |

The last enabled admin cannot be removed or demoted. Role changes and disabling take effect on open sessions at once. Job output and the history are visible to every role, so do not give an account to someone who should not read them.

## Agents

- A pairing code is 8 characters from an alphabet without look-alike letters, works once, and expires after 10 minutes. Wrong codes count toward a lockout for the sending address.
- Pairing gives the agent a random token. The hub stores only its SHA-256 hash and compares it in constant time.
- Removing a machine from the hub revokes its token immediately.
- The agent refuses plain HTTP to a remote hub unless started with `--allow-insecure`.
- The agent's pairing file is written with owner-only permissions where the platform supports that.

## Commands

A command is never a line of text handed to a shell. It is a structured request that both the hub and the agent check against the list of commands and options generated from the CLI source:

- Unknown commands, subcommands and options are refused.
- Positional arguments may not start with `-`, so an argument cannot smuggle in an option.
- Values may not contain line breaks or NUL, and are limited to 4,096 characters.
- A switch may not be given a value.
- The agent starts `choco` directly, without a shell, so shell metacharacters have no meaning.

The agent only ever runs the bundled `choco`. There is no general remote command execution.

A machine can be limited further: read only, or a list of allowed commands. A list set in the hub is enforced by the hub. A list set on the machine with `--allow`, like read only set at pairing, is enforced by the agent itself and still holds if the hub is taken over.

## Secrets

Options that the CLI source marks as secret, such as source passwords and API keys, are replaced with `********` in the recorded command, the job list and the history. Two honest caveats:

- The values pass through the hub in memory. While a job waits they are stored encrypted with a key the hub keeps in its data folder, and they are removed from the stored job when it ends. This protects a stray copy of the data file. It does not protect against someone who can read the whole data folder, because the key is there too unless you move it with `MATERIAL_CHOCO_KEY_FILE`.
- Only option values marked secret and webhook addresses are encrypted. Positional arguments and other options are stored as they are.
- Output printed by the CLI itself is stored as the job log. The app does not scan that output for secrets.

The **API keys** page never shows key values. It lists which sources have a stored key.

## Messages that leave the hub

An admin can set up [status webhooks](../features/status-webhooks.md). A message carries the event, the machine, the exit code and the command with secrets masked, and never job output. An admin can point a webhook at any HTTPS address the hub can reach, including addresses inside your network.

## The browser side

Pages are served with a content security policy that allows scripts only from the hub itself, forbids framing, and sends `X-Content-Type-Options: nosniff`. Static file requests cannot leave the interface folder.

## Not built yet

- Limiting a user to some machines, and custom roles.
- Signed webhook messages.
- Rotation of the key for secrets at rest.
- Signed agent updates.
- Code signing of the Windows installer.

## What was checked

Tests in `test/hub.test.js`: `nothing works before setup and sign in`, `setup creates the administrator once`, `wrong passwords are refused and then locked out`, `cross-site requests are refused`, `static files cannot escape the UI folder`, `invalid commands never reach an agent`, `history is recorded and secrets stay out of it`, `removing a machine revokes its agent`. Tests in `test/core.test.js`: `buildArgs rejects unknown commands, options, subcommands and option injection`, `secrets are masked in the recorded command`.

End to end checks: `API refuses requests without a session`, `same origin request with session is accepted`, `unknown agent token is refused`.

Also `test/passkeys.test.js`, `test/roles.test.js`, `test/secrets.test.js`, `test/webhooks.test.js` and `test/allowlist.test.js`; the feature pages name the individual tests. Passkeys were exercised with a software passkey device in the tests and the virtual passkey device of headless Chrome in the end to end run, not with a real device.

No independent security review has been done.

## Related

- [Running the hub in a container](hub-in-a-container.md): HTTPS setup
- [Pairing and remote agents](pairing-and-remote-agents.md): read only agents
- [Confirming destructive actions](confirming-destructive-actions.md): protection against accidents
- [Passkeys](../features/passkeys.md): the feature page
- [Users and roles](../features/users-and-roles.md): the feature page
- [Secrets at rest](../features/secrets-at-rest.md): scope and limits
- [Command allow lists](../features/command-allow-lists.md): the feature page
