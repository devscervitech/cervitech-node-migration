# 04 — Restructure account-deletion confirmation: safe GET + destructive DELETE

**What to build:** Opening the account-deletion confirmation link no longer deletes the account as a side effect of a `GET` (which email scanners and link-prefetchers can trigger accidentally). The token can be safely checked with a `GET`; the actual deletion only happens on an explicit `DELETE` call.

**Blocked by:** #02 — Add purpose scoping to shared reset/deletion tokens

**Status:** ready-for-agent

- [ ] `GET /users/me/deletion-requests/{token}` reports whether the token is valid/pending, without deleting anything
- [ ] `DELETE /users/me/deletion-requests/{token}` performs the deletion, requires a token with `purpose: 'account_deletion'`, and blacklists the token afterward (single use, as today)
- [ ] The old `GET /user/deletions/confirm` route no longer deletes on GET — either removed or repurposed as the safe check
- [ ] `legacy.routes.ts`'s `/user/delete?token=` bridge is repointed to the new DELETE-based confirmation
- [ ] OpenAPI docs updated to match the new routes
- [ ] End-to-end: request deletion → email link → confirm → account is deleted, still works
