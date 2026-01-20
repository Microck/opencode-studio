# Testing Patterns

**Analysis Date:** 2026-01-18

## Test Framework

**Runner:**
- None implemented.

**Assertion Library:**
- None implemented.

**Run Commands:**
```bash
# No test scripts available in package.json
```

## Test File Organization

**Location:**
- No test files currently exist in the codebase.

## Test Structure

**Status:**
The project is currently in a pre-test phase. No automated test suites have been established for either the frontend or the backend.

## Recommendations

**Framework Selection:**
- **Frontend:** Vitest + React Testing Library is recommended for Next.js 16.
- **Backend:** Supertest + Vitest for testing Express routes.

**Organization:**
- Colocate tests with source files using `.test.ts` or `.spec.ts` suffixes.
- Create a `tests/` root directory for end-to-end testing with Playwright.

**Priorities:**
1. Unit tests for `server/index.js` file IO logic.
2. Integration tests for the `AppProvider` state management.
3. E2E tests for the MCP server toggle flow.

---

*Testing analysis: 2026-01-18*
*Update when test patterns change*
