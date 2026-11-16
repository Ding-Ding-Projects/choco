# Sign in

Sign in to the hub with a password or a passkey, with lockout after failures, and sessions that expire.

## What it is

- **Setup once.** The first visitor creates the first admin. There is no default account, and setup cannot be repeated. Admins add further [users with roles](users-and-roles.md).
- **Passkeys** are an extra way to sign in; see [passkeys](passkeys.md).
- **Passwords** need at least 10 characters and are stored as salted scrypt hashes.
- **No authenticator codes.** By a decision of the maintainer on 2026-11-16 the hub has no one time code step. Sign in is a password or a passkey. A hub upgraded from a build that had codes deletes the stored records at start and writes one history entry per affected user.
- **Lockout.** After 5 failed attempts for a name from an address, sign in is refused for 30 seconds, doubling up to 15 minutes.
- **Sessions** use an `HttpOnly`, `SameSite=Strict` cookie and end 12 hours after their last use. **Sign out** ends one at once.

The desktop app has no sign in screen. Its window is signed in with a one time launch token as the current Windows user, and its server listens on this computer only.

## How to use it

Sign in with your name and password, or with a passkey where one is set up. **Settings**, **Sign in and locks** changes the password and manages passkeys.

## What was checked

- Tests `nothing works before setup and sign in`, `setup creates the administrator once`, `wrong passwords are refused and then locked out` and `cross-site requests are refused` in `test/hub.test.js`.
- End to end checks `setup refuses a short password` and `API refuses requests without a session`.

## Known limits

- The only second factor is a passkey. An account with a password alone has one factor.
- Passkeys were tested with a software passkey device only, not with a real device in a real browser.
- Sessions are held in memory, so restarting the hub signs everyone out.
- There is no self-service password recovery. An admin can reset another user's password. If the only admin loses theirs, the account has to be repaired in the data folder by whoever operates the hub.

## Related

- [Passkeys](passkeys.md)
- [Users and roles](users-and-roles.md)
- [Security model](../articles/security-model.md)
- [Pairing](pairing.md)
- [History](history.md): sign ins are recorded
