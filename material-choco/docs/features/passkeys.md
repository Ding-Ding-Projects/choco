# Passkeys

Sign in to the hub with a fingerprint, a face, a device PIN or a security key. The password stays as the fallback.

## What it is

A passkey (WebAuthn) is an extra way to sign in to a hub account. Nothing secret leaves your device: the hub stores a public key. An account can hold up to 20 passkeys. ES256 and RS256 keys are accepted, and the hub asks for no attestation, so it never trusts a claim about the model of the device.

Rules the hub applies:

- A challenge works once and for five minutes, and the origin and the site must match.
- A sign counter that does not move forward is refused and written to the history, because the passkey may have been copied.
- Repeated failures from one address lock passkey sign in for a growing time, and a disabled account cannot sign in with its passkey.

## How to use it

- **Add one:** **Settings**, **Sign in and locks**, **Passkeys**. Enter your current password, give the passkey a name, press **Add a passkey**, and answer the prompt of your device. The list shows each passkey with when it was added and last used.
- **Sign in:** on the sign in screen choose the passkey button. Typing your name first is only needed for security keys that do not store accounts.
- **Remove one:** from the list, after the [two key confirmation](two-key-confirmation.md).

Passkeys need HTTPS or `localhost`, and a host name instead of an IP address. Where they cannot work, the button is hidden and the settings page says why. Behind a reverse proxy that changes the `Host` header, set `MATERIAL_CHOCO_ORIGIN`, for example `https://hub.example.com`. A passkey only works on the host name it was registered on.

## What was checked

- `test/passkeys.test.js`, among them `register an ES256 passkey and list it`, `sign in with a passkey, without typing a name`, `a replayed assertion is refused: each challenge works once`, `a sign counter that does not move forward is refused and recorded` and `password sign-in still works next to passkeys`. These use a software passkey device written for the tests.
- End to end checks `the sign-in screen offers a passkey first on a host name, with the password below`, `adding a passkey needs the current password`, `a passkey is added and listed with its name`, `Use a passkey signs in without the password`, `a passkey is deleted after the two key confirmation` and `the passkey button is hidden where passkeys cannot work`. These use the virtual passkey device of headless Chrome.

## Known limits

- **Tested with a software passkey device only.** No person has yet signed in with a real fingerprint reader, phone or security key in a real browser.
- The password cannot be removed from an account. A passkey adds a way in; it does not close the other.
- No independent review of the WebAuthn code has been done.
- Not available in the desktop app, which has no sign in.

## Related

- [Sign in](sign-in.md)
- [Users and roles](users-and-roles.md)
- [Security model](../articles/security-model.md)
