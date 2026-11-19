# 06 — Migrate auth.controller.ts to the unified response format

**What to build:** Every handler in the auth controller currently builds its own `{ success, message, data/error }` object and status code by hand. Route every success and error path through the unified response module from ticket 02.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Every handler in the auth controller sends responses via the unified `sendSuccess`/`sendError` helpers
- [ ] Status codes and envelope shape returned to clients are unchanged for every existing route (this is a seam migration, not a behavior change)
- [ ] Duplicated "is the caller authenticated" checks are replaced by the shared helper from ticket 02 where applicable
- [ ] Existing tests and type-check still pass
