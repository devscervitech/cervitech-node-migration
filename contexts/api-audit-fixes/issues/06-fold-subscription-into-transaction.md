# 06 — Fold subscription entitlement into transaction recording; remove `PUT /user/subscription`

**What to build:** There is no longer a client-callable endpoint whose entire job is "make me premium." Recording a transaction with `status: Completed` is what grants `hasPaid`, done atomically in the same request that records the transaction. `PUT /user/subscription` is removed from the public API — today it sets `user.hasPaid = true` for any authenticated caller with no proof of payment at all.

**Blocked by:** #03 — Validate `POST /transaction` against the confirmed status enum

**Status:** ready-for-agent

- [ ] `POST /transaction` with `status: Completed` sets `hasPaid = true` on the caller's account in the same request/DB operation
- [ ] `TransactionRecord` gains a way to mark itself as already consumed for entitlement, so the same record can't re-grant on replay
- [ ] `PUT /user/subscription` route, controller method, and OpenAPI block are removed
- [ ] Calling `POST /transaction` with `status: Pending` or `Failed` does not grant `hasPaid`
- [ ] Existing code paths that read `hasPaid` (goals, stats, etc.) are unaffected by the change in how it gets set
