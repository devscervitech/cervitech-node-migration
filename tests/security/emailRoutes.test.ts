import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { swaggerSpec } from '../../src/config/swagger';

describe('Public email helpers remain removed', () => {
  it('does not mount the email router or retain its controller', () => {
    const server = readFileSync('src/server.ts', 'utf8');
    expect(server).not.toMatch(/email\.routes|emailRoutes|\/api\/v1\/email/);
    expect(existsSync('src/routes/email.routes.ts')).toBe(false);
    expect(existsSync('src/controllers/email.controller.ts')).toBe(false);
  });

  it('does not advertise email helper endpoints in OpenAPI', () => {
    const paths = Object.keys((swaggerSpec as { paths: Record<string, unknown> }).paths);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.filter(path => /^\/(api\/v1\/)?email(?:\/|$)/.test(path))).toEqual([]);
  });
});
