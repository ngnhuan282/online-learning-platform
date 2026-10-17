import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createCallbackRelay } from './vnpay-callback-relay.mjs';

function send(port, path, options = {}) {
  return new Promise((resolve, reject) => {
    const client = request({ host: '127.0.0.1', port, path, ...options }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
      response.on('error', reject);
    });
    client.setTimeout(5000, () => client.destroy(new Error('Relay request timed out')));
    client.on('error', reject);
    client.end(options.body);
  });
}

async function startRelay(t, upstream) {
  const fetchMock = t.mock.method(globalThis, 'fetch', upstream);
  const server = createCallbackRelay();
  t.after(() => new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => error ? reject(error) : resolve());
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  assert.equal(server.address().address, '127.0.0.1');
  return { port: server.address().port, fetchMock };
}

test('IPN forwards only to the fixed Gateway without caller credentials', async t => {
  const { port, fetchMock } = await startRelay(t, async () => new Response(
    JSON.stringify({ RspCode: '97', Message: 'Invalid signature' }),
    { headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'must-not-forward=1' } },
  ));
  const result = await send(port, '/api/v1/payments/vnpay/ipn?vnp_SecureHash=invalid', {
    headers: {
      Authorization: 'Bearer test-only',
      Cookie: 'test-session=1',
      'X-User-Id': '123',
      'X-User-Roles': 'ADMIN',
      'X-Forwarded-For': '203.0.113.1',
      'X-Payment-Client-Ip': '203.0.113.2',
    },
  });
  assert.equal(result.status, 200);
  assert.equal(JSON.parse(result.body).RspCode, '97');
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['set-cookie'], undefined);
  const [target, options] = fetchMock.mock.calls[0].arguments;
  assert.equal(target.href, 'http://127.0.0.1:8080/api/v1/payments/vnpay/ipn?vnp_SecureHash=invalid');
  assert.equal(options.redirect, 'manual');
  assert.deepEqual(options.headers, {
    Accept: 'application/json',
    'User-Agent': 'VNPay-Sandbox-Callback-Relay',
  });
  assert.ok(options.signal instanceof AbortSignal);
});

for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
  test(`Return preserves the local result redirect to ${origin}`, async t => {
    const location = `${origin}/payment/result?callbackError=invalid`;
    const { port } = await startRelay(t, async () => new Response(null, {
      status: 303,
      headers: { Location: location },
    }));
    const result = await send(port, '/api/v1/payments/vnpay/return?vnp_SecureHash=invalid');
    assert.equal(result.status, 303);
    assert.equal(result.headers.location, location);
    assert.equal(result.headers['referrer-policy'], 'no-referrer');
  });
}

test('Other paths and arbitrary destinations never reach Gateway', async t => {
  const { port, fetchMock } = await startRelay(t, async () => {
    throw new Error('Blocked request reached Gateway');
  });
  for (const path of [
    '/api/v1/auth/login',
    '/api/v1/courses',
    '/api/v1/payments/history',
    '/api/v1/payments/admin/analytics',
    '/actuator/health',
    '/api/v1/payments/vnpay/ipn/',
    '/api/v1/payments/vnpay/return/extra',
    '//example.test/api/v1/payments/vnpay/ipn',
  ]) {
    assert.equal((await send(port, path)).status, 404, path);
  }
  assert.equal((await send(port, 'http://example.test/api/v1/payments/vnpay/ipn')).status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('Non-GET callback requests are rejected before forwarding', async t => {
  const { port, fetchMock } = await startRelay(t, async () => new Response('unexpected'));
  for (const path of ['/api/v1/payments/vnpay/ipn', '/api/v1/payments/vnpay/return']) {
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
      assert.equal((await send(port, path, { method })).status, 405, `${method} ${path}`);
    }
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('GET callback bodies and oversized URLs are rejected', async t => {
  const { port, fetchMock } = await startRelay(t, async () => new Response('unexpected'));
  const path = '/api/v1/payments/vnpay/ipn';
  assert.equal((await send(port, path, { headers: { 'Content-Length': '1' }, body: 'x' })).status, 400);
  assert.equal((await send(port, path, { headers: { 'Transfer-Encoding': 'chunked' }, body: 'x' })).status, 400);
  assert.equal((await send(port, `${path}?value=${'x'.repeat(8200)}`)).status, 400);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('Unexpected redirects cannot expose another page or destination', async t => {
  let location;
  const { port } = await startRelay(t, async () => new Response(null, {
    status: 303,
    headers: { Location: location },
  }));
  for (location of [
    'https://example.test/payment/result',
    'http://localhost:5173/admin',
    'http://localhost:5174/payment/result',
    'http://user:password@localhost:5173/payment/result',
    '/payment/result',
  ]) {
    const result = await send(port, '/api/v1/payments/vnpay/return');
    assert.equal(result.status, 502, location);
    assert.equal(result.headers.location, undefined);
  }
});

test('Oversized upstream responses are rejected', async t => {
  const { port } = await startRelay(t, async () => new Response('x'.repeat(32769)));
  const result = await send(port, '/api/v1/payments/vnpay/ipn');
  assert.equal(result.status, 502);
  assert.equal(result.body, 'Unexpected callback response');
});

test('Gateway errors do not disclose internal error details', async t => {
  const { port } = await startRelay(t, async () => { throw new Error('Private upstream failure'); });
  const result = await send(port, '/api/v1/payments/vnpay/ipn');
  assert.equal(result.status, 502);
  assert.equal(result.body, 'Callback service unavailable');
});

test('The documented command starts a loopback relay and prints its port', { timeout: 10000 }, async t => {
  const child = spawn(process.execPath, [fileURLToPath(new URL('./vnpay-callback-relay.mjs', import.meta.url))], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  });
  let output = '';
  let errors = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => { errors += chunk; });
  const address = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`Relay exited with ${code}: ${errors}`)));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      output += chunk;
      if (output.includes('\n')) {
        try {
          resolve(JSON.parse(output.slice(0, output.indexOf('\n'))));
        } catch (error) {
          reject(error);
        }
      }
    });
  });
  assert.equal(address.host, '127.0.0.1');
  assert.ok(Number.isInteger(address.port) && address.port > 0);
  assert.equal((await send(address.port, '/api/v1/payments/history')).status, 404);
});
