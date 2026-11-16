# Status webhooks

The hub posts a short message to an address of your choice when a job fails, a machine stays offline, or sign in is locked out.

## What it is

A webhook is an HTTPS address that receives one JSON `POST` per event. A hub holds up to 20.

| Event | Sent when |
| --- | --- |
| Job failed | A Chocolatey job ends with a non-zero exit code, is refused by the agent, or times out |
| Job succeeded | A Chocolatey job ends with exit code 0 |
| Machine offline | A machine has not been seen for the number of minutes you set. Sent once per outage |
| Sign in lockout | Failed sign ins lock a name or an address out |

A message holds the event, the time, the hub name and one line of text. For a job it also holds the number, machine, state, exit code and the command line with secret values shown as `********`. **Job output is never sent.** Two formats exist: plain JSON, and a Discord format that can never ping anyone.

A failed delivery is retried up to 3 times when the receiver cannot be reached or answers with a temporary error. Redirects are not followed. Each result is written to the history with the receiver's host name, not the address, because the address is usually a credential. Addresses are [encrypted at rest](secrets-at-rest.md).

## How to use it

Admins open **Status webhooks**, choose **Add a webhook**, and give a name, the address, the format, the events, and the minutes before a machine counts as offline. **Send test** posts a test message and shows the result on the row. Each webhook has a switch, and the list can be exported without addresses.

## What was checked

- `test/webhooks.test.js`, among them `only HTTPS addresses are accepted, except localhost`, `a failed job is reported with the redacted command and exit code only`, `the Discord format sends content and never pings anyone`, `delivery is retried with backoff, at most three times`, `a machine that stays offline is reported once per outage` and `a sign-in lockout is reported`.
- End to end checks `webhooks start empty and say so` and `the enable switch changes the webhook on the hub`.

## Known limits

- Tested against receivers on the same computer. No message has been delivered to a real chat service.
- An admin can point a webhook at any HTTPS address the hub can reach, including addresses inside your network.
- Messages are not signed, so a receiver cannot prove they came from the hub.
- A message that fails all its attempts is not queued for later.

## Related

- [Notifications](notifications.md): messages inside the app
- [History](history.md)
- [Secrets at rest](secrets-at-rest.md)
