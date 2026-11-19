# 01 — Add canonical AppUser view-model mapper

**What to build:** A single, deep `AppUser` module owns the shape callers see when they ask for a user's public data — one `toAppUserViewModel(doc)` mapper, backed by the real `AppUser` schema (the one with `password`, `goals`, and the `unique` constraints — not the thinner duplicate schema currently living alongside the view models). This ticket only adds the mapper; nothing else is wired to it yet, so no existing behavior changes.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] One mapper function converts an `AppUser` document into the view-model shape used across the API (id, username, email, firstName, lastName, hasPaid, pictureUrl, fcmToken, isGoalOn, allowPushNotifications, responseRate, dateRegistered, lastLoginDateTime, mobileChannel, prompt, notificationCount, deleted)
- [ ] The mapper never includes `password`
- [ ] The mapper is exported from one place so every future caller imports the same function
- [ ] No existing controller, service, or route is modified in this ticket
- [ ] Existing tests and type-check still pass
