# Hub HTTP API

All bodies are JSON. Browser routes need the session cookie from `POST /api/login` and refuse cross-site requests. Agent routes need `Authorization: Bearer <agent token>`.

| Method | Path |
| --- | --- |
| GET | `/api/status` |
| POST | `/api/setup` |
| POST | `/api/login` |
| POST | `/api/logout` |
| GET | `/api/schema` |
| GET | `/api/machines` |
| PATCH | `/api/machines/:id` |
| DELETE | `/api/machines/:id` |
| POST | `/api/pairing` |
| POST | `/api/jobs` |
| GET | `/api/jobs` |
| GET | `/api/jobs/:id` |
| POST | `/api/jobs/:id/cancel` |
| GET | `/api/schedules` |
| POST | `/api/schedules` |
| PATCH | `/api/schedules/:id` |
| DELETE | `/api/schedules/:id` |
| GET | `/api/audit` |
| POST | `/api/audit` |
| GET | `/api/account` |
| POST | `/api/account/password` |
| POST | `/api/account/totp` |
| GET | `/api/events` |
| POST | `/agent/enroll` |
| POST | `/agent/poll` |
| POST | `/agent/jobs/:id/output` |
| POST | `/agent/jobs/:id/done` |

A job `spec` is `{ "kind": "choco", "command", "subcommand", "args": [], "options": {}, "global": {} }` or `{ "kind": "inventory" }`. Option ids are the ones in `shared/choco-schema.json`.

The Postman collection in this folder is generated from the same route table.
