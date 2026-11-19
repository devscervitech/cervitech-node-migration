# 07 — Consolidate duplicate endpoints onto canonical routes

**What to build:** Logout, username-exists, email-validate, and FCM-token-update each currently exist as two separately-mounted routes pointing at the same (or, for FCM-token-update, two independently written) implementation. Afterward there's one canonical route per capability; the duplicates are marked deprecated (still functional, logged) rather than silently removed, so nothing breaks before the frontend migrates.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `/auth/logout` is canonical; `/user/logout` still works but logs a deprecation warning
- [ ] `/auth/usernames/exists` is canonical; `/user/usernames/exists` still works but logs a deprecation warning
- [ ] `/auth/validate-email` is canonical; `/user/emails/validate` still works but logs a deprecation warning
- [ ] FCM-token update has one shared implementation; both `/user/fcm-token` (PUT) and `/fcm/token` (PUT) call it, with one route marked deprecated
- [ ] OpenAPI docs mark the deprecated routes `deprecated: true` and point to the canonical replacement in their description
- [ ] No existing caller of any of these routes breaks
