export const BACKOFFICE_ACCESS_LEVEL = {
  ADMIN: 'ADMIN',
  OPERATOR: 'OPERATOR',
} as const;

export type BackofficeAccessLevel =
  (typeof BACKOFFICE_ACCESS_LEVEL)[keyof typeof BACKOFFICE_ACCESS_LEVEL];

export const BACKOFFICE_ACCESS_LEVELS = Object.values(BACKOFFICE_ACCESS_LEVEL);
