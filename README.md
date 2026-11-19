# folder structure 
##### cervitech-nodejs/
##### ├── src/
##### │ ├── app.ts  App bootstrap logic
##### │ ├── server.ts # Main server entry point
##### │ ├── config/ # Environment config, DB, Redis
##### │ ├── controllers/ # REST API controllers (handles requests/responses)
##### │ ├── domain/ # Domain models/entities (e.g., users)
##### │ ├── infrastructure/ # External integrations (MongoDB, Redis, BullMQ)
##### │ ├── jobs/ # Scheduled jobs and queues (BullMQ)
##### │ ├── middlewares/ # Custom middlewares (auth, error handling, etc.)
##### │ ├── routes/ # API route definitions
##### │ ├── services/ # Business logic and service classes
##### │ ├── viewmodels/ # Request/response shapes (DTOs, validation)
##### │ └── utils/ # Utility functions (logger, helpers)
##### ├── .env # Environment variable file
##### ├── .prettierrc # Prettier config for code formatting
##### ├── tsconfig.json # TypeScript configuration
##### ├── yarn.lock # Yarn lockfile
##### └── package.json # Project metadata and scripts

## Premium comp script

Use the one-time script at [scripts/grant-premium.ts](scripts/grant-premium.ts) to grant premium access to specific users by email without creating a fake payment record.

1. Open [scripts/grant-premium.ts](scripts/grant-premium.ts) and edit the `EMAILS` array with the target addresses.
2. Run it against the correct environment:

```bash
npx dotenv -e .env.dev -- npx tsx scripts/grant-premium.ts
npx dotenv -e .env.staging -- npx tsx scripts/grant-premium.ts
npx dotenv -e .env.prod -- npx tsx scripts/grant-premium.ts
```

3. Review the output summary. It reports:
   - users updated to `hasPaid = true`
   - users already marked as premium
   - users not found by email

This script directly updates the `AppUser` document and does not add a `TransactionRecord`, so it will not be counted as a payment or later revoked by reconciliation logic.
