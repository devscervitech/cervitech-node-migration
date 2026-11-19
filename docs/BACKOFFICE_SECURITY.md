# Back-office account security

## Access levels

- `ADMIN` can create and manage back-office accounts and access administrator-only back-office tools.
- `OPERATOR` is reserved for operational back-office endpoints and cannot manage accounts. This repository currently has no operational endpoint assigned to `OPERATOR`.
- `readOnly: true` blocks operational and account-management writes for either level. Self-service logout and password changes remain available so a read-only account can secure its own session. A missing or non-boolean `readOnly` value fails closed.
- The API never treats arbitrary or legacy `accessLevel` values as `ADMIN`.

## Provisioning and legacy accounts

Use `scripts/audit-backoffice-passwords.ts` to report password-hash counts, existing access-level counts, and the stored active-admin counter. It prints counts only and performs no writes.

Admin creation, promotion, demotion, and deletion use a database-backed lock and count active administrators from the user collection while holding it. This serializes account-security changes across API instances. If a process stops while holding the lock, those account mutations fail closed with a conflict response. After confirming no API instance is still processing an account change, stop the API and run the access-level migration with identity mappings (`{"ADMIN":"ADMIN","OPERATOR":"OPERATOR"}`) and `--apply` to recompute the count and release the lock.

Before enforcing `ADMIN`/`OPERATOR` in an existing deployment, prepare an explicit mapping for every legacy access level. Stop the API, run `scripts/migrate-backoffice-access-levels.ts` in dry-run mode, review the counts and mapping, then rerun with `--apply`. The migration also initializes the active-admin invariant counter. Do not apply a mapping that grants `ADMIN` to an unverified legacy value.

Use `scripts/bootstrap-backoffice-admin.ts` only when no canonical `ADMIN` exists and the API is stopped. It promotes the specifically named existing account, or creates the first account only when the back-office collection is empty. Load the bootstrap password from a secret manager; the script removes all whitespace, hashes it, and never prints it.

## Password schema rollout

The Mongoose schema now requires a password for new or fully validated back-office documents. This does not modify existing database rows. Run the audit before deployment to find missing, empty, and non-bcrypt password values, then arrange password resets for affected accounts. Hash-format counts alone cannot recover plaintext passwords.
