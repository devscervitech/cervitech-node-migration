import { describe, expect, it } from 'vitest';
import http from 'node:http';
import { createApp } from '../../src/app';
import { HEALTHCHECK_PATH, probe } from '../../src/healthcheck';

async function listen(handler: http.RequestListener) {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as any).port as number,
    close: () => {
      server.closeAllConnections();
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

describe('Docker healthcheck probe', () => {
  it('targets the liveness route the app actually serves', async () => {
    expect(HEALTHCHECK_PATH).toBe('/health');
    const server = await listen(createApp({ ...process.env, NODE_ENV: 'test' }) as unknown as http.RequestListener);
    try {
      expect(await probe(server.port)).toBe(true);
    } finally {
      await server.close();
    }
  });

  it('fails on non-200 responses', async () => {
    for (const status of [204, 404, 500, 503]) {
      const server = await listen((_req, res) => res.writeHead(status).end());
      try {
        expect(await probe(server.port)).toBe(false);
      } finally {
        await server.close();
      }
    }
  });

  it('fails when nothing is listening', async () => {
    const server = await listen((_req, res) => res.end());
    const { port } = server;
    await server.close();
    expect(await probe(port)).toBe(false);
  });

  it('fails when the server does not answer within the timeout', async () => {
    const server = await listen(() => {
      /* never respond */
    });
    try {
      const started = Date.now();
      expect(await probe(server.port, HEALTHCHECK_PATH, 200)).toBe(false);
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      await server.close();
    }
  });
});
