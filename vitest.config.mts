import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Test-only values; application startup still requires real configured secrets.
    env: {
      APP_USER_JWT_SECRET: 'test-app-secret',
      BACKOFFICE_JWT_SECRET: 'test-office-secret',
      GENERAL_TOKEN_SECRET: 'test-general-secret',
    },
    include: ['tests/**/*.test.ts'],
    pool: 'forks',
  },
});
