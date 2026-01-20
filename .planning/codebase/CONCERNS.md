# Codebase Concerns

**Analysis Date:** 2026-01-18

## Tech Debt

**Monolithic Backend Entry Point:**
- Issue: `server/index.js` contains over 800 lines of code including all routes, business logic, and helper functions.
- Files: `server/index.js`
- Why: Rapid development and single-file deployment simplicity.
- Impact: Difficult to maintain, test, and navigate as the project grows.
- Fix approach: Refactor routes into separate modules and move business logic (config IO, auth, log parsing) into a `services/` or `lib/` directory.

**Busy-Wait Loop in File Operations:**
- Issue: `atomicWriteFileSync` uses a synchronous `while` loop for delay during retries.
- Files: `server/index.js` (lines 32-33)
- Why: To handle Windows file locking issues during renames.
- Impact: Blocks the entire Node.js event loop for 50ms per retry, reducing server responsiveness.
- Fix approach: Use asynchronous file operations with `await` and a proper `setTimeout` based sleep function.

**CommonJS and ESM Mixture:**
- Issue: Backend uses CommonJS (`require`) while frontend uses ES Modules (`import`).
- Files: `server/index.js`, `client-next/src/`
- Why: Default configurations for Express and Next.js.
- Impact: Inconsistency in syntax and inability to easily share utility code between frontend and backend.
- Fix approach: Migrate backend to ES Modules to match frontend standards.

## Known Bugs

**Auto-Shutdown on Idle:**
- Symptoms: The backend server process exits after 30 minutes of inactivity.
- Trigger: No API requests for `IDLE_TIMEOUT_MS`.
- File: `server/index.js` (lines 46-56)
- Workaround: Refreshing the UI restarts the server via protocol handler or manual start.
- Root cause: Intentional feature for resource saving that may be disruptive.
- Fix: Make idle timeout configurable or disable it by default in local mode.

## Security Considerations

**Broad CORS Policy:**
- Risk: `ALLOWED_ORIGINS` includes broad regex patterns like `/\.vercel\.app$/` and `/\.micr\.dev$/`.
- File: `server/index.js` (lines 65-73)
- Current mitigation: Basic origin checking in CORS middleware.
- Recommendations: Narrow the allowed origins to specific domains used in production and localhost for development.

**Atomic Write Sync Operations:**
- Risk: Using synchronous file operations in a web server.
- File: `server/index.js` (lines 16-42)
- Current mitigation: Simple try/catch.
- Recommendations: Move to asynchronous `fs.promises` to prevent blocking the event loop during heavy IO.

## Performance Bottlenecks

**Large Log Parsing:**
- Problem: Reading and parsing OpenCode logs might become slow as log files grow.
- File: `server/index.js` (lines 98-100+)
- Measurement: Not measured, but potential for O(n) slowdown on large files.
- Cause: Reading log files from disk and parsing them in-memory.
- Improvement path: Implement log rotation or use a more efficient streaming parser that only reads the tail of the log.

## Test Coverage Gaps

**Zero Automated Tests:**
- What's not tested: Every component, route, and utility.
- Risk: High regression risk during any refactoring or feature addition.
- Priority: High
- Difficulty to test: Medium (requires setting up Vitest/Jest and mocking the file system).

---

*Concerns audit: 2026-01-18*
*Update as issues are fixed or new ones discovered*
