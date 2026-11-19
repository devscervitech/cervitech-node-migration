# 03 — Validate `POST /transaction` against the confirmed status enum

**What to build:** Creating a transaction record rejects any `status` value outside `Pending(0)/Completed(1)/Failed(2)`, and any missing required field, with a 400 — instead of accepting an unvalidated request body wholesale.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] A Joi schema validates `paymentRef`, `amount`, `status`, and `transDate`/`description` on `POST /transaction`, reusing `TRANSACTION_STATUS`
- [ ] The schema is registered via `fromJoi(schema)` in `src/config/swagger.ts` per the repo's OpenAPI convention, and referenced from the route's `@openapi` block instead of a hand-written inline shape
- [ ] `status: 1` (Completed) is accepted; an out-of-range or non-numeric `status` is rejected with 400
- [ ] Existing valid transaction-creation calls are unaffected
