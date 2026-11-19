# 03 — Fix AppUserService's mistyped AppUser import

**What to build:** `AppUserService` currently imports the `AppUser` type from the thinner, duplicate schema definition instead of the real one — so at runtime it queries the correctly-registered model, but at compile time every call is checked against a shape missing fields like `goals`. Point the import at the real `AppUser` model/interface and route its response shaping through the canonical mapper from ticket 01.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `AppUserService` imports `AppUser`/`IAppUser` from the real schema module, not the duplicate
- [ ] `AppUserService`'s response-shaping calls use the canonical `toAppUserViewModel` mapper instead of hand-mapped fields
- [ ] Fields only present on the real schema (e.g. `goals`) are now visible to the type checker inside `AppUserService`
- [ ] Existing `AppUserService` behavior (what data is returned, what's persisted) is unchanged for callers
- [ ] Existing tests and type-check still pass
