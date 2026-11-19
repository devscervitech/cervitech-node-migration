# 01 — Fix `/auth/request-reset` 500 bug

**What to build:** Requesting a password reset (`POST /auth/request-reset`) returns a proper success/failure response for any email address, instead of a 500 on every call. Root cause: `AuthController.sendPasswordToken` calls `AuthService.sendPasswordResetToken(email)` with a raw string, but the service destructures `{ email }` from an object — so `email` is `undefined` inside the service and `email.toLowerCase()` throws, which gets caught generically and reported as a 500.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `POST /auth/request-reset` with a known email returns 200 and sends a reset email
- [ ] `POST /auth/request-reset` with an unknown email returns 400, not 500
- [ ] `POST /auth/request-reset` with a missing email still returns 400 (unchanged)
- [ ] A regression test covers the previously-broken path
- [ ] OpenAPI doc for `/auth/request-reset` reviewed and left accurate (no shape change expected)
