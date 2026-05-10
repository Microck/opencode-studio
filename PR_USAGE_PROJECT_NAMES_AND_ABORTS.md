## Summary
This PR fixes two related UX issues affecting the dashboard experience:

1. **`/usage` → Top Projects showed short IDs instead of real project names** (e.g. `4186cb93`, `67160148`) when usage data came from SQLite.
2. Intermittent **`AxiosError: Request aborted`** messages during app bootstrap were being treated as normal backend errors in the app context refresh flow.

## What was happening

### 1) Project names in Usage (SQLite path)
The SQLite usage aggregation could not reliably resolve a human-readable project name in some environments/schema variants, so it fell back to truncated IDs.

### 2) Aborted bootstrap requests
During startup/navigation, some requests can be legitimately canceled by the browser/runtime. Those aborts were entering the generic error path in `refreshData`, producing noisy logs and misleading error states.

## Fixes

### Backend (`server/index.js`)
- Improved SQLite usage extraction for project labeling:
  - Inspects available columns dynamically.
  - Uses `project.name` when available.
  - Falls back to session metadata (`session.directory`, `session.data` fields like `projectName`, `name`, `title`, `cwd`, etc.).
  - Uses short project ID only as a last resort.
- Also hardened path normalization in the embedded Python helper to avoid backslash escaping issues that could cause SQLite parsing to fail and fall back to legacy JSON.

### Frontend (`client-next/src/lib/context.tsx`)
- In `refreshData`, abort/cancel errors are now ignored (`ERR_CANCELED`, `CanceledError`, and aborted message patterns) so they do not trigger false backend error handling.

## Result
- **Top Projects** now displays real project names more consistently on SQLite-backed usage.
- Startup refresh flow is cleaner, with aborted requests no longer surfacing as backend failures.

## Validation
1. Open `/usage` with SQLite usage source enabled.
2. Verify **Top Projects** shows project names instead of short IDs in typical cases.
3. Reload app / navigate during startup and confirm aborted request noise no longer appears as refresh failure handling.
