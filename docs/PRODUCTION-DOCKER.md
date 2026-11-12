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

For a local production build without Docker, install dependencies as described
in the main README, then use `npm run build` and `npm start`. `npm run dev`
retains the prior development behavior. `PORT` sets the client port.

## Reverse proxy security

The backend manages sensitive local configuration and has **no built-in remote
authentication**. Do not expose the container port or backend directly to the
internet. To use a remote HTTPS hostname, keep the loopback binding, configure
an independently authenticated reverse proxy on the host, and set
`STUDIO_PUBLIC_ORIGIN` to its exact HTTPS origin (no trailing slash or path).
TLS alone is not authentication. The origin check is not an authentication
mechanism; the proxy must protect every route, including `/api/` and upgrade
requests, before allowing external traffic. Do not trust forwarded headers
from the internet without a correctly configured proxy boundary.

This draft does not yet provide an authenticated proxy configuration, automated
remote CLI connectivity, or a verified Docker build. Studio's backend manages
configuration on its own filesystem; it is not demonstrated to be an OpenCode
execution server to which a separate local CLI can connect. Do not rely on this
draft for remote access until those pieces are designed and tested.
