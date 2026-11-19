# 08 — Verify Play purchases server-side via the Play Developer API

**What to build:** When a transaction is recorded, its `status` reflects what Google's Play Developer API actually reports for that purchase — not whatever the client claims — closing the remaining gap where a modified client could fabricate a `Completed` transaction to unlock premium via #06's flow.

**Blocked by:** #06 — Fold subscription entitlement into transaction recording

**External prerequisite — blocks actual implementation, not just review:** a Google Cloud service account linked in Play Console with Finance/Orders permissions, with credentials available to the backend as a secret. If this ticket is picked up before that access exists, flag it and stop rather than guessing at credentials/config.

**Status:** ready-for-agent

- [ ] `POST /transaction` accepts a Play purchase token (and package name, subscription/product ID) alongside/in place of the current `paymentRef`
- [ ] The backend calls the Android Publisher API (`purchases.subscriptions.get`) using the service-account credentials to independently verify the purchase
- [ ] The recorded transaction's `status` is derived from Google's response, not the client-submitted value
- [ ] An invalid/forged purchase token is rejected with 400, not silently recorded as Completed
- [ ] Coordinated with the frontend on what's actually sent today as `paymentRef` vs. what a real purchase token requires
