import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const gateway = 'http://127.0.0.1:8080';
const allowedPaths = new Set([
  '/api/v1/payments/vnpay/ipn',
  '/api/v1/payments/vnpay/return',
]);

function reject(response, status, message) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(message);
}

export function createCallbackRelay() {
  const server = createServer(async (request, response) => {
    if (!request.url || request.url.length > 8192 || !request.url.startsWith('/')) {
      return reject(response, 400, 'Invalid request');
    }
    let target;
    try {
      target = new URL(request.url, gateway);
    } catch {
      return reject(response, 400, 'Invalid request');
    }
    if (target.origin !== gateway || !allowedPaths.has(target.pathname)) {
      return reject(response, 404, 'Not found');
    }
    if (request.method !== 'GET') return reject(response, 405, 'GET required');
    if (request.headers['transfer-encoding'] || Number(request.headers['content-length'] || 0) !== 0) {
      return reject(response, 400, 'Request body not allowed');
    }
    try {
      // Forward only callback parameters, never caller credentials or identity headers.
      const upstream = await fetch(target, {
        redirect: 'manual',
        headers: { Accept: 'application/json', 'User-Agent': 'VNPay-Sandbox-Callback-Relay' },
        signal: AbortSignal.timeout(15000),
      });
      const body = await upstream.text();
      if (Buffer.byteLength(body) > 32768) return reject(response, 502, 'Unexpected callback response');
      const headers = {
        'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      };
      const location = upstream.headers.get('location');
      if (location) {
        const destination = new URL(location);
        if (
          !['http://localhost:5173', 'http://127.0.0.1:5173'].includes(destination.origin) ||
          destination.pathname !== '/payment/result' ||
          destination.username || destination.password
        ) return reject(response, 502, 'Unexpected callback redirect');
        headers.Location = location;
      }
      response.writeHead(upstream.status, headers);
      response.end(body);
    } catch {
      reject(response, 502, 'Callback service unavailable');
    }
  });

  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 30;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createCallbackRelay();
  server.listen(0, '127.0.0.1', () => {
    console.log(JSON.stringify({ host: '127.0.0.1', port: server.address().port }));
  });
}
