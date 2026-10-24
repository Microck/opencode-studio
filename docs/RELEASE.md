# Release runbook

1. Update root/server package versions together and the client version for client changes.
   Update both lockfile root package versions and CHANGELOG.md.
2. Run server `npm ci --ignore-scripts && npm test`; run client
   `npm ci --ignore-scripts && npm test && npm run lint && npx tsc --noEmit && npm run build`.
   The protocol-handler install script must not run in CI.
3. Exercise the production UI against a synthetic home. Preserve v1/v2 source
   formats and verify cancelled, stale-response and failed-save paths.
4. Review the PR and its exact head's checks. Do not claim unsupported native auth,
   plugin API porting or unresolved native runtime behavior as verified.
5. Merge only after checks pass and actionable review findings are addressed.
6. The master regression workflow packages the server and creates the versioned
   GitHub release after the regression job succeeds. It does not overwrite releases.
7. npm publication uses an existing `NPM_TOKEN` only if configured. Without it, the
   GitHub release still provides the package archive, and npm remains explicitly
   unpublished. Never invent publication success or create credentials silently.
8. Verify the GitHub release tag targets the tested merge SHA and download/check
   the package artifact. Verify npm's version separately if publication ran.
9. Verify the hosted client deployment separately; a green build is not deployment
   proof. Record unresolved deployment/authentication limits in the completion report.
