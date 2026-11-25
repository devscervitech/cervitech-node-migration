// src/healthcheck.ts
// Docker HEALTHCHECK probe (`node dist/healthcheck.js`). Exits 0 only on an
// HTTP 200 from the liveness endpoint; connection errors, timeouts and any
// other status exit 1.
import http from 'node:http';
import { resolvePort } from './config/runtime';

export const HEALTHCHECK_PATH = '/health';
const DEFAULT_TIMEOUT_MS = 3000; // below the Dockerfile's --timeout=5s

export function probe(port: number, path = HEALTHCHECK_PATH, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path, timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => req.destroy(new Error('Healthcheck timed out')));
    req.on('error', () => resolve(false));
  });
}

if (require.main === module) {
  probe(resolvePort())
    .then((healthy) => process.exit(healthy ? 0 : 1))
    .catch(() => process.exit(1));
}
