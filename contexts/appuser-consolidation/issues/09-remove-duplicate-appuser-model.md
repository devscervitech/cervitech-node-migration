# 09 — Remove the duplicate AppUser model registration and viewmodel shapes

**What to build:** With every caller now migrated onto the real `AppUser` schema and the canonical mapper (tickets 03, 04, 05), delete the second Mongoose schema that duplicate-registers the `AppUser` model name with an incompatible shape, and delete the redundant `AppUserViewModel` shapes that were hand-typed independently in more than one types file. One schema, one view-model shape remain.

**Blocked by:** 03, 04, 05

**Status:** ready-for-agent

- [ ] Only one place in the codebase calls `mongoose.model('AppUser', ...)`
- [ ] The duplicate, thinner `AppUser` interface/schema is deleted
- [ ] The redundant `AppUserViewModel` type definitions are deleted, leaving one canonical shape
- [ ] No remaining import references the deleted files/types
- [ ] Full type-check and test suite pass
