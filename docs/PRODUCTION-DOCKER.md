# Production preview (draft)

This setup builds the Next.js client ahead of time and starts it with the Studio
backend. The backend remains on container loopback; only the client port is
published, and Docker Compose binds it to host loopback by default.

```sh
docker compose build
docker compose up -d
```

Open `http://127.0.0.1:3000`. Set `STUDIO_PORT` to change the host port; when
doing so, also set `STUDIO_PUBLIC_ORIGIN` to the exact browser origin, such as
`http://127.0.0.1:3001`. Data is stored in the `studio-home` volume. Back up
that volume before replacing it; it can contain credentials and configurations.
The container supervisor uses a kernel advisory lock in that volume to prevent
two Studio containers from writing the same home concurrently, and releases it
on a crash. Use a local Docker volume with working `flock` semantics; distributed
or network-backed volume locking has not been verified.

For a local production build without Docker, install dependencies as described
in the main README, then use `npm run build` and `npm start`. `npm run dev`
retains the prior development behavior. `PORT` sets the client port.

## Reverse proxy security

The backend manages sensitive local configuration and has **no built-in remote
authentication**. Do not expose the Studio container or backend directly to the
internet. TLS alone and the Studio origin check are not authentication.

An optional Caddy gateway example protects all routes with HTTP Basic auth and
uses HTTPS. It opens ports 80 and 443, so use it only on a host you intend to
expose, with DNS pointing to that host and a valid publicly trusted certificate.
Choose a strong unique password and generate its bcrypt hash interactively using
`docker run --rm -it caddy:2 caddy hash-password`. Do not put the plaintext
password in shell history or the repository. Place values in an access-restricted
`.env` file outside version control. Single-quote the hash in `.env` so Compose
does not interpolate its `$` characters. Container administrators can read the
hash from the environment. Example keys (replace placeholders, do not use the
example values):

```dotenv
STUDIO_SITE=studio.example.com
STUDIO_PUBLIC_ORIGIN=https://studio.example.com
STUDIO_USER=replace-me
STUDIO_PASSWORD_HASH='replace-with-bcrypt-hash'
```

Then start `docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d --build`.
The hostname and exact HTTPS origin must match. The Studio port remains bound to
host loopback. Protect the host itself, limit access at the network layer, and
add monitoring/rate limiting appropriate to the deployment; Basic auth alone
does not provide rate limiting or MFA. An existing authenticated HTTPS reverse
proxy can be used instead, provided it protects every route including `/api/`,
preserves the configured Host, and does not trust arbitrary forwarded headers.

CI has exercised gateway authentication and untrusted-host rejection using a
local test certificate. An independent security review is still required before
using this draft remotely; public certificate issuance was not tested.

## Separate OpenCode execution server (draft)

Studio's API manages configuration; it is not the OpenCode execution server.
The optional `docker-compose.cli.yml` starts a separate, pinned OpenCode v2
server, sharing Studio's home volume and a separate workspace volume. It binds
port 4096 to host loopback, not the public network. It requires a strong,
unique `OPENCODE_PASSWORD`; supply it privately, not in commands, logs or
version control. Environment variables can be inspected by container
administrators. The connected user can execute commands and modify files in the
server's workspace, so grant access only to trusted users and do not mount
Docker sockets or sensitive host directories. Configure model access and costs
separately; this setup does not run a model.

After reviewing this draft and setting the password, start the optional service
with `docker compose -f docker-compose.yml -f docker-compose.cli.yml up -d --build`.
For remote access, use an authenticated SSH tunnel to the host's loopback port,
then connect with `opencode --server http://127.0.0.1:4096`; provide the same
password via `OPENCODE_PASSWORD` in the local CLI environment. See the
[official OpenCode server documentation](https://opencode.ai/docs/cli/web).
This draft does not expose the execution server through the Caddy gateway.
CI has built the container, checked API authentication, connected the OpenCode
CLI to the server, and observed a synthetic shared configuration from both
services. It has not exercised an actual SSH tunnel, real credentials, model
calls or a public deployment. Do not depend on this preview yet.
