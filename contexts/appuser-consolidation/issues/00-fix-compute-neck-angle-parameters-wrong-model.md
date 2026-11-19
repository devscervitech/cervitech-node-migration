# 00 — Fix computeNeckAngleParameters querying the wrong model

**What to build:** `NeckAngleService.computeNeckAngleParameters` looks up the caller by id in the `User` model instead of `AppUser`. Since `req.user.userId` is always an `AppUser` id and nothing in the live signup path ever creates a `User` document, the lookup returns nothing and the neck-angle statistics endpoint always fails with "User not found." Point the lookup at `AppUser`, matching every sibling method in `NeckAngleService` (`calculateAverageOfLastSetNeckAngles`, `getWeeklyChartData`, etc.), so the endpoint returns real data.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] `computeNeckAngleParameters` looks up the caller via the `AppUser` model, not `User`
- [ ] Calling the neck-angle statistics endpoint for a real authenticated app user returns a populated response instead of a 400 "User not found"
- [ ] `username` and `responseRate` on the returned data come from the actual `AppUser` document (fields that don't exist on `User`)
- [ ] No other behavior in `NeckAngleService` changes
