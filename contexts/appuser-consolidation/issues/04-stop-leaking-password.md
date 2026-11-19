# 04 — Stop leaking password in getUserData and fcmToken responses

**What to build:** The user-profile-fetch and FCM-token-update flows each hand-map an `AppUser` document into a response object, and both copies currently include `password`. Route both through the canonical `toAppUserViewModel` mapper from ticket 01 so the leak is structurally impossible and the two copies stop being able to drift from each other.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The get-user-data response no longer includes `password`
- [ ] The fcm-token-update response no longer includes `password`
- [ ] Both flows call the canonical mapper instead of hand-mapping fields
- [ ] All other fields returned by both endpoints are unchanged
- [ ] Existing tests and type-check still pass
