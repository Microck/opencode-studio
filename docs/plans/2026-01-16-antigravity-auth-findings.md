# antigravity oauth findings

**summary:** antigravity auth plugins do not ship a client_id. oauth is handled by the plugin via `opencode auth login`, which stores accounts locally and rotates in plugin land. studio should treat plugin auth as the source of truth and only surface status + pool from plugin files.

## repos checked

- `lbjlaq/Antigravity-Manager`
  - oauth is handled in app ui. no bundled client_id.
  - account state is stored locally and managed by the app.

- `MonchiLin/antigravity-agent`
  - login opens antigravity and captures account locally.
  - no public oauth client_id provisioning.

- `NoeFabris/opencode-antigravity-auth`
  - oauth via `opencode auth login`.
  - accounts stored at `~/.config/opencode/antigravity-accounts.json`.
  - models and rotation controlled by plugin; studio should not re-implement oauth.

- `su-kaka/gcli2api`
  - oauth handled by local web console; stores creds in service data.
  - no client_id auto-provision.

- `wusimpl/AntigravityQuotaWatcher`
  - quota polling via local service/api. no oauth provisioning.

- `liuw1535/antigravity2api-nodejs`
  - oauth/login is user-driven. stores tokens in local data files.
  - no public client_id.

- `badrisnarayanan/antigravity-claude-proxy`
  - add account via web ui or cli; tokens stored locally.
  - no bundled client_id.

## implications for studio

- for antigravity, the only reliable auth path is `opencode auth login`.
- studio should read `~/.config/opencode/antigravity-accounts.json` to populate pool/email.
- built-in google oauth should not be used for antigravity mode.
