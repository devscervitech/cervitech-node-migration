# 09 — Keep subscription status in sync over time via RTDN/polling

**What to build:** A user's `hasPaid` stays accurate after the initial purchase — if a subscription is later canceled, refunded, or expires, that's reflected without waiting for the user to trigger another API call.

**Blocked by:** #08 — Verify Play purchases server-side via the Play Developer API

**External prerequisite:** a Google Cloud Pub/Sub topic configured for Real-time Developer Notifications in Play Console, if the webhook approach is chosen (the polling approach needs no external config — decide which before starting).

**Status:** ready-for-agent

- [ ] Either: a webhook route receives Play RTDN events (renewal/cancellation/expiry/refund) and updates the affected user's `hasPaid` accordingly; or: a scheduled job periodically re-verifies active subscribers' status via the Play Developer API
- [ ] A canceled/expired/refunded subscription results in `hasPaid` being set back to `false` within a reasonable window
- [ ] The chosen approach (webhook vs polling) is documented in the ticket's resolution for future maintainers
