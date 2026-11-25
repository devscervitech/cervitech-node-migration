import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PORT, REQUIRED_SIGNING_SECRETS } from '../../src/config/runtime';
import { HEALTHCHECK_PATH } from '../../src/healthcheck';

const read = (path: string) => readFileSync(path, 'utf8');
const dockerfile = read('Dockerfile');
const compose = read('docker-compose.yml');
const envExample = read('.env.example');
const envDocs = read('ENVIRONMENT_VARIABLES.md');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : path.endsWith('.ts') ? [path] : [];
  });
}

/** Environment variables the application code actually reads. */
function variablesReadBySource(): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles('src')) {
    const text = read(file);
    for (const [, name] of text.matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)) names.add(name);
  }
  // Read through readSigningSecret(name), so not matched by the env.NAME scan above.
  for (const name of REQUIRED_SIGNING_SECRETS) names.add(name);
  return [...names].sort();
}

const templateVariables = [...envExample.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map(([, name]) => name);

describe('Dockerfile', () => {
  const runtimeStage = dockerfile.slice(dockerfile.lastIndexOf('\nFROM '));

  it('runs the production stage as the unprivileged node user', () => {
    const user = runtimeStage.match(/^USER\s+(\S+)/m);
    expect(user?.[1]).toBe('node');
    // Nothing after USER may switch back to root or run as root.
    expect(runtimeStage.slice(runtimeStage.indexOf('USER node'))).not.toMatch(/^USER\s+(root|0)\b/m);
    // No blanket write permissions to work around ownership.
    expect(dockerfile).not.toMatch(/chmod\s+(-R\s+)?(777|a\+w|o\+w)/);
  });

  it('exposes the application default port', () => {
    expect(runtimeStage).toMatch(new RegExp(`^EXPOSE ${DEFAULT_PORT}$`, 'm'));
  });

  it('probes the liveness route through the compiled healthcheck script', () => {
    expect(runtimeStage).toMatch(/^HEALTHCHECK .*\\\r?\n\s+CMD \["node", "dist\/healthcheck\.js"\]$/m);
    expect(HEALTHCHECK_PATH).toBe('/health');
    expect(dockerfile).not.toContain('localhost:8000/health');
  });

  it('starts the server in exec form so node receives SIGTERM', () => {
    expect(runtimeStage).toMatch(/^CMD \["node", "dist\/server\.js"\]$/m);
  });

  it('uses the same Node.js base image in both stages, matching CI', () => {
    const bases = [...dockerfile.matchAll(/^FROM\s+(\S+)/gm)].map(([, image]) => image);
    expect(bases).toHaveLength(2);
    expect(new Set(bases).size).toBe(1);
    const major = bases[0].match(/^node:(\d+)-alpine$/)?.[1];
    expect(major).toBeDefined();
    expect(read('.github/workflows/ci.yml')).toMatch(new RegExp(`node-version: '${major}'`));
  });

  it('patches Alpine packages and ships no package managers in the runtime image', () => {
    expect(runtimeStage).toContain('apk upgrade --no-cache');
    expect(runtimeStage).toContain('npm ci --omit=dev');
    for (const path of ['/usr/local/lib/node_modules/npm', '/usr/local/lib/node_modules/corepack', '/opt/yarn-v*']) {
      expect(runtimeStage).toContain(path);
    }
    // Nothing after the cleanup may need npm at runtime.
    const afterCleanup = runtimeStage.slice(runtimeStage.indexOf('/root/.npm') + '/root/.npm'.length);
    expect(afterCleanup).not.toMatch(/\bnpm\b|\bnpx\b|\byarn\b/);
  });
});

describe('docker-compose.yml', () => {
  it('maps the host port onto the port the app listens on', () => {
    expect(compose).toContain(`- "\${APP_PORT:-${DEFAULT_PORT}}:\${PORT:-${DEFAULT_PORT}}"`);
    expect(compose).toContain(`- PORT=\${PORT:-${DEFAULT_PORT}}`);
  });

  it('passes the trusted-proxy hop count through with the direct-connection default', () => {
    expect(compose).toContain('- TRUST_PROXY_HOPS=${TRUST_PROXY_HOPS:-0}');
    expect(envExample).toMatch(/^TRUST_PROXY_HOPS=0$/m);
  });

  it('passes all Google Play billing settings to the container', () => {
    for (const name of ['GOOGLE_PLAY_SERVICE_ACCOUNT_KEY', 'GOOGLE_PLAY_PACKAGE_NAME', 'GOOGLE_PLAY_SUBSCRIPTION_IDS']) {
      expect(compose).toContain(`- ${name}=\${${name}}`);
    }
  });
});

describe('.env.example', () => {
  it('uses the application default port', () => {
    expect(envExample).toMatch(new RegExp(`^PORT=${DEFAULT_PORT}$`, 'm'));
  });

  it('documents every Google Play setting the verifier requires', () => {
    for (const name of ['GOOGLE_PLAY_SERVICE_ACCOUNT_KEY', 'GOOGLE_PLAY_PACKAGE_NAME', 'GOOGLE_PLAY_SUBSCRIPTION_IDS']) {
      expect(templateVariables).toContain(name);
    }
    expect(envExample).toMatch(/Comma-separated allowlist of Play subscription product IDs/);
    expect(envExample).not.toMatch(/legacy client-submitted-status path still works/i);
  });

  it('contains no secrets-looking values', () => {
    expect(envExample).not.toMatch(/-----BEGIN|"private_key"|AccountKey=|accesskey=[A-Za-z0-9+/]{20,}/i);
  });

  it('only lists variables the app or docker-compose consumes', () => {
    const read = variablesReadBySource();
    const unused = templateVariables.filter((name) => !read.includes(name) && !compose.includes(`\${${name}`));
    expect(unused).toEqual([]);
  });
});

describe('environment documentation', () => {
  it('documents every variable the application reads', () => {
    const undocumented = variablesReadBySource().filter((name) => !new RegExp(`\`${name}\``).test(envDocs));
    expect(undocumented).toEqual([]);
  });

  it('no longer lists the unused FCM_SERVER_KEY', () => {
    const mention = /(?<!ENV_)FCM_SERVER_KEY/;
    expect(variablesReadBySource()).not.toContain('FCM_SERVER_KEY');
    for (const file of ['.env.example', 'docker-compose.yml']) {
      expect(read(file), file).not.toMatch(mention);
    }
    // Docs may only mention it to say it is gone.
    for (const file of ['ENVIRONMENT_VARIABLES.md', 'ENV_SETUP.md', 'DOCKER_DEPLOYMENT.md']) {
      for (const line of read(file).split('\n').filter((l) => mention.test(l))) {
        expect(line, file).toMatch(/not read/i);
      }
    }
  });

  it('describes Google Play configuration without the removed legacy flow', () => {
    expect(envDocs).toContain('`GOOGLE_PLAY_SUBSCRIPTION_IDS`');
    expect(envDocs).not.toMatch(/still works via the legacy client-submitted-status path/);
  });

  it('agrees with the application default port', () => {
    expect(envDocs).toMatch(new RegExp(`\\| \`PORT\` \\| [^|]+ \\| No \\| ${DEFAULT_PORT} \\|`));
    expect(envDocs).not.toMatch(/defaults to 4000/);
  });
});
