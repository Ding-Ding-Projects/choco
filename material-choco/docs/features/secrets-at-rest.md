# Secrets at rest

The hub encrypts the secret values it has to keep on disk, and is plain about what that does and does not protect.

## What it is

On first start the hub creates a key file, `secret.key`, in its data folder, readable by its owner only. With it the hub encrypts, using AES-256-GCM:

- values of options that the CLI schema marks as secret (source and certificate passwords, API keys, the proxy password) inside queued jobs and inside schedules,
- webhook addresses.

A job's secret values are decrypted only when the job is handed to its agent, and are removed from the stored job when it finishes, is cancelled or expires. Data written by an older version is encrypted during the first start of this version. Schedules show `********` in place of such values.

**What this protects:** a copy of the hub's data file on its own, such as a backup or a file attached to a support request.

**What this does not protect:** anyone who can read the whole data folder reads the key file too and can decrypt everything.

## How to use it

Nothing to turn on. To keep the key apart from the data, set `MATERIAL_CHOCO_KEY_FILE` to a path on another volume or a secret mount. Back the key up together with the data: without it, queued secrets and webhook addresses cannot be read, and the hub refuses to start with a damaged key file instead of replacing it.

## What was checked

`test/secrets.test.js`, among them `the key file is created on first run, readable by its owner only`, `hub.json never holds a secret option value while the job is queued, running or finished, and the agent gets the real value`, `a cancelled queued job loses its secrets`, `a schedule keeps its secrets encrypted, shows a placeholder, and still runs with the real value`, `data written before encryption existed is encrypted on the next start` and `the vault refuses tampered values, the wrong purpose and a damaged key file`.

## Known limits

- Only the two kinds of value listed above are encrypted. Positional arguments and options not marked secret are stored as they are.
- Job output is stored as the CLI printed it. If a package script prints a secret, it is in the log.
- The rest of the data, such as machine names, inventories and the history, is not encrypted.
- There is no key rotation command.
- No independent review of the encryption has been done.

## Related

- [Secret masking](secret-masking.md): what is hidden on screen and in records
- [Security model](../articles/security-model.md)
- [Hub container image](hub-container.md)
