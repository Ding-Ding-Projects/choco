# Hub container image

The hub as a container image with a volume for its data, a health check and a non-root user.

## What it is

`hub/Dockerfile` builds an image from `node:22-alpine`. It copies the server, the interface and the schema, needs no `npm install`, runs as the user `node`, declares `/data` as a volume, exposes port 8080, and has a health check that requests `/api/status`. `docker-compose.yml` starts it with one command. The release workflow publishes it as `ghcr.io/ding-ding-projects/material-choco-hub`.

## How to use it

```
docker compose up -d
```

or

```
docker run -d -p 8080:8080 -v material-choco-data:/data ghcr.io/ding-ding-projects/material-choco-hub:latest
```

For HTTPS set `MATERIAL_CHOCO_TLS_CERT` and `MATERIAL_CHOCO_TLS_KEY` to mounted files, or put a reverse proxy in front.

## What was checked

[HANDOFF.md](../../HANDOFF.md) records: image built with `docker build`, run as a container, reached on the LAN address, health check healthy, running as the non-root user, and a real agent enrolled against it and reported inventory. The release workflow pushed the image.

## Known limits

- The HTTPS variables were not exercised in a recorded check.
- Only the `latest` tag is described here; check the registry for version tags before pinning one.

## Related

- [Running the hub in a container](../articles/hub-in-a-container.md): the guide
- [Hub](hub.md)
- [Security model](../articles/security-model.md)
