/**
 * tests/security/headers.test.ts
 *
 * RED: No HTTP server exists in the codebase. If one is ever added
 *      (e.g. for the Remotion Studio proxy or a render-status API),
 *      security headers must be present. This test is intentionally
 *      written to be RED now (import fails) and GREEN once the server
 *      module exists with Helmet-equivalent headers.
 *
 * GREEN after:
 *  1. Create src/server/app.ts exporting an Express app with helmet()
 *  2. npm install helmet @types/helmet express @types/express
 */
import { describe, it, expect } from 'vitest';

let app: any;
try {
  const mod = await import('../../src/server/app');
  app = mod.default ?? mod.app;
} catch {
  app = undefined;
}

// Minimal fetch-based header check (works without supertest)
async function getHeaders(path = '/'): Promise<Record<string, string>> {
  if (!app) return {};
  const port = 0; // dynamic
  const http = await import('http');
  return new Promise((resolve, reject) => {
    const server = http.createServer(app).listen(port, () => {
      const addr = server.address() as { port: number };
      const req = http.get(`http://127.0.0.1:${addr.port}${path}`, (res) => {
        server.close();
        resolve(res.headers as Record<string, string>);
      });
      req.on('error', (e) => { server.close(); reject(e); });
    });
  });
}

describe('security: HTTP response headers', () => {
  it('server app module exports an app', () => {
    expect(app).toBeDefined();
  });

  it('X-Content-Type-Options: nosniff is present', async () => {
    const headers = await getHeaders();
    expect(headers['x-content-type-options']).toBe('nosniff');
  });

  it('X-Frame-Options: DENY or SAMEORIGIN is present', async () => {
    const headers = await getHeaders();
    expect(headers['x-frame-options']).toMatch(/^(DENY|SAMEORIGIN)$/i);
  });

  it('X-XSS-Protection header is present', async () => {
    const headers = await getHeaders();
    expect(headers['x-xss-protection']).toBeDefined();
  });

  it('Strict-Transport-Security is present', async () => {
    const headers = await getHeaders();
    expect(headers['strict-transport-security']).toBeDefined();
  });

  it('Server header does not leak Express version', async () => {
    const headers = await getHeaders();
    // Express sets "X-Powered-By: Express" by default; helmet removes it
    expect(headers['x-powered-by']).toBeUndefined();
  });
});
