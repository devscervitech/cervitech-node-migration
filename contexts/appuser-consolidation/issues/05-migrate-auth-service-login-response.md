# 05 — Migrate auth.service.ts's login response to the canonical mapper

**What to build:** `AuthService`'s login/response-building path hand-maps `AppUser` fields into its own response shape, separately from the other three copies elsewhere in the codebase. Route it through the canonical `toAppUserViewModel` mapper from ticket 01 so the login response shape can only change in one place.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The login response's user data comes from the canonical mapper, not a hand-rolled field list
- [ ] The login response continues to correctly omit `password` (already true today — verify it stays true through the migration)
- [ ] All other fields currently returned on login are unchanged
- [ ] Existing tests and type-check still pass
