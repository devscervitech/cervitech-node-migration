# 05 — Wire up admin hard-delete route for back office

**What to build:** A back-office-authenticated admin can delete a specific user account through a real, mounted API route, instead of the current dead/commented-out `deleteById`/`deleteAll` routes or the legacy `?id=` query-param path.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `DELETE /users/{id}` is mounted, gated by back-office auth (not app-user auth)
- [ ] Calling it deletes (soft-deletes, consistent with the existing `deleted: true` convention) the target user
- [ ] The legacy `/user/delete?id=...` path is repointed to call the same underlying logic
- [ ] Non-admin callers get 401/403
- [ ] OpenAPI docs added for the new route, tagged appropriately (e.g. back office/admin)
