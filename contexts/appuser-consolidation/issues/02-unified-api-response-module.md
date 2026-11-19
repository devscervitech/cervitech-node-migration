# 02 — Build the unified API response module

**What to build:** One deep module for shaping HTTP responses, so controllers stop hand-rolling `{ success, message, data/error }` and re-checking `req.user.userId` inline. It exposes a small interface — something like `sendSuccess(res, data, message?)`, `sendError(res, status, message, error?)`, and a helper that extracts the authenticated user id from the request or short-circuits with a 401 — built on top of the existing (currently unused) response-status constants. This ticket only builds the module; no controller is migrated yet, so no existing response shapes change.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] One module exposes success and error response helpers with a consistent envelope shape
- [ ] One helper centralizes the "is the caller authenticated" check that's currently duplicated per-handler, returning early with a 401 when it's missing
- [ ] The module builds on the existing response-status constants rather than introducing a second, competing set
- [ ] No controller is modified in this ticket
- [ ] Existing tests and type-check still pass
