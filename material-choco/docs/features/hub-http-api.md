# Hub HTTP API

The JSON API that the interface and the agents use, documented with a Postman collection.

## What it is

Browser routes live under `/api/` and need the session cookie from `POST /api/login` or from a passkey sign in. Each route names the roles that may call it. They refuse cross-site requests. Agent routes live under `/agent/` and need `Authorization: Bearer <agent token>`. All bodies are JSON. `GET /api/events` is a server-sent event stream of machine, job, output and history events.

## How to use it

The reference, with the role for every route, passkeys, users, the allow list, webhooks and secrets at rest, is in [docs/api/README.md](../api/README.md), and [material-choco.postman_collection.json](../api/material-choco.postman_collection.json) can be imported into Postman. A minimal session:

```
curl -c jar -H 'content-type: application/json' -d '{"name":"admin","password":"..."}' https://hub.example/api/login
curl -b jar https://hub.example/api/machines
```

Jobs are created with `POST /api/jobs` and a body of `machineIds` and a `spec` with `kind`, `command`, and optional `subcommand`, `args`, `options` and `global`.

## What was checked

`test/hub.test.js` drives the hub entirely through this API. End to end checks `API refuses requests without a session`, `same origin request with session is accepted` and `unknown agent token is refused`.

## Known limits

- There are no API tokens for scripts. A script signs in with an account's password and keeps the cookie. Give it an account with the least role that does the job.
- The API is not versioned and may change between releases.

## Related

- [Hub](hub.md)
- [Security model](../articles/security-model.md)
- [Build and test from source](../articles/build-and-test.md)
