// Run after npm run build and docker compose --profile backend up --build -d.
// Uses real Chrome, React, Gateway and MySQL-backed Auth; no API mocks.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const gateway = process.env.E2E_GATEWAY_URL || 'http://localhost:8080';
const origin = 'http://localhost:5173';
const refreshMode = process.argv.includes('--refresh');
const output = resolve(refreshMode ? '../../.tmp/refresh-e2e' : '../../.tmp/auth-e2e');
await mkdir(output, { recursive: true });
const password = `Test9!${randomUUID()}`;
const report = {
  checks: [],
  uiEmail: `ui-${randomUUID()}@example.com`,
  apiEmail: `api-${randomUUID()}@example.com`,
};
async function api(path, data, token, cookie) {
  const response = await fetch(gateway + '/api/v1' + path, {
    method: data ? 'POST' : 'GET',
    headers: {
      ...(data ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: `refresh_token=${cookie}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: response.status, body: await response.json() };
}
for (const invalidPassword of ['lowercase9', 'UPPERCASE9', 'NoDigitsHere', 'Aa1' + '界'.repeat(24)]) {
  const invalid = await api('/auth/register', {
    fullName: 'Validation Smoke User',
    email: `invalid-${randomUUID()}@example.com`,
    password: invalidPassword,
  });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.code, 'VALIDATION_ERROR');
  assert.ok(invalid.body.errors.password?.length);
  assert.equal(JSON.stringify(invalid.body).includes(invalidPassword), false);
}
report.checks.push('Gateway registration enforces password strength and UTF-8 byte limit');

const registered = await api('/auth/register', {
  fullName: 'API Smoke User',
  email: report.apiEmail,
  password,
  roles: ['ADMIN'],
});
assert.equal(registered.status, 201);
assert.deepEqual(registered.body.data.roles, ['USER']);
const signedIn = await api('/auth/login', { email: report.apiEmail.toUpperCase(), password });
assert.equal(signedIn.status, 200);
const me = await api('/users/me', null, signedIn.body.data.accessToken);
assert.equal(me.status, 200);
assert.equal(me.body.data.email, report.apiEmail);
assert.equal((await api('/users/me')).status, 401);
assert.equal((await api('/users/me', null, 'broken')).status, 401);
assert.equal(
  (await api('/auth/login', { email: report.apiEmail, password: 'Incorrect9!' })).body.code,
  'INVALID_CREDENTIALS',
);
const duplicates = await Promise.all(
  [0, 1].map(() => api('/auth/register', { fullName: 'Duplicate', email: report.apiEmail, password })),
);
assert.ok(duplicates.every(result => result.status === 409));
report.checks.push(
  'Gateway register/login/me',
  'default USER role',
  'missing/invalid token 401',
  'invalid credentials',
  'duplicate email 409',
);

const root = resolve('dist');
const profile = resolve(output, `chrome-${Date.now()}`);
await mkdir(profile, { recursive: true });
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};
const server = refreshMode
  ? await (await import('vite')).createServer({ server: { port: 5173, strictPort: true } })
  : createServer(async (req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
      const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      try {
        const content = await readFile(file);
        res
          .writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' })
          .end(content);
      } catch {
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(await readFile(resolve(root, 'index.html')));
      }
    });
if (refreshMode) await server.listen();
else
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(5173, done);
  });
const chrome = spawn(
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { windowsHide: true, stdio: 'ignore' },
);
const pause = ms => new Promise(done => setTimeout(done, ms));
let socket;
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try {
      port = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      break;
    } catch {
      await pause(150);
    }
  }
  assert.ok(port, 'Chrome started');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.onopen = done;
    socket.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  const errors = [];
  const responses = [];
  const methods = new Map();
  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const request = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) request.reject(msg.error);
      else request.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text);
    else if (msg.method === 'Network.requestWillBeSent')
      methods.set(msg.params.requestId, msg.params.request.method);
    else if (msg.method === 'Network.responseReceived' && msg.params.response.url.startsWith(gateway)) {
      responses.push({
        url: msg.params.response.url,
        method: methods.get(msg.params.requestId),
        status: msg.params.response.status,
      });
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      pending.set(key, { resolve, reject });
      socket.send(JSON.stringify({ id: key, method, params }));
    });
  const run = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) {
      if (await run(expression)) return;
      await pause(100);
    }
    throw Error(`Timed out: ${expression}`);
  };
  const navigate = async path => {
    await send('Page.navigate', { url: origin + path });
    await waitFor(
      path === '/admin'
        ? 'document.body.textContent.includes("Không có quyền truy cập")'
        : 'document.querySelector(".site-header") !== null',
    );
  };
  const setField = (name, value) =>
    run(
      `(() => { const el = document.querySelector('[name="${name}"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`,
    );
  const click = selector => run(`document.querySelector(${JSON.stringify(selector)}).click()`);
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const returnTo = '/account?tab=profile#details';
  await navigate(returnTo);
  await waitFor('location.pathname === "/login" && document.querySelector(".auth-switch a") !== null');
  await click('.auth-switch a');
  await waitFor('location.pathname === "/register" && document.querySelector("[name=fullName]") !== null');
  // Switching back and forth must retain the protected destination as well.
  await click('.auth-switch a');
  await waitFor('location.pathname === "/login" && document.querySelector("[name=fullName]") === null');
  await click('.auth-switch a');
  await waitFor('document.querySelector("[name=fullName]") !== null');
  await setField('fullName', 'Nguyễn Auth E2E');
  await setField('email', report.uiEmail);
  await setField('password', password);
  await setField('confirmPassword', password);
  await click('[name=terms]');
  await click('button[type=submit].auth-submit');
  await waitFor(
    'location.pathname === "/login" && document.body.textContent.includes("Tạo tài khoản thành công")',
  );
  assert.equal(await run('sessionStorage.length'), 0);
  report.checks.push('React registration and success notice');

  await setField('email', report.uiEmail);
  await setField('password', password);
  await click('button[type=submit].auth-submit');
  await waitFor('location.pathname === "/account" && document.body.textContent.includes("Nguyễn Auth E2E")');
  assert.equal(await run('location.pathname + location.search + location.hash'), returnTo);
  report.checks.push(
    'Protected destination survives login/register switches and registration, including query/hash',
  );
  assert.equal(await run('sessionStorage.length'), 1);
  assert.equal(await run('localStorage.length'), 0);
  assert.equal(
    await run(`Object.values(sessionStorage).some(value => value.includes(${JSON.stringify(password)}))`),
    false,
  );
  report.checks.push('React login, AuthContext user, token-only session storage');
  await writeFile(
    resolve(output, 'account-desktop.png'),
    Buffer.from((await send('Page.captureScreenshot')).data, 'base64'),
  );

  if (refreshMode) {
    await (
      await import('./refresh-scenarios.mjs')
    ).default({ send, run, waitFor, report, responses, pause, gateway, api });
  } else {
    const meCount = responses.filter(response => response.url.endsWith('/users/me')).length;
    await send('Page.reload', { ignoreCache: true });
    await waitFor('document.body.textContent.includes("Nguyễn Auth E2E")');
    assert.ok(
      responses.filter(response => response.url.endsWith('/users/me') && response.status === 200).length >
        meCount,
    );
    report.checks.push('Reload restores session using real /me');
    await navigate('/admin');
    await waitFor('document.body.textContent.includes("Không có quyền truy cập")');
    assert.equal(await run('document.body.textContent.includes("Tài khoản quản trị")'), false);
    report.checks.push('USER denied admin route');
    await navigate('/account');
    await waitFor('document.body.textContent.includes("Nguyễn Auth E2E")');
    await run(
      '[...document.querySelectorAll("button")].find(button => button.textContent === "Đăng xuất").click()',
    );
    await waitFor('location.pathname === "/login" && document.querySelector("[name=email]") !== null');
    assert.equal(await run('sessionStorage.length'), 0);
    await navigate('/account');
    await waitFor('location.pathname === "/login" && document.querySelector("[name=email]") !== null');
    report.checks.push('Logout clears token and user; protected route redirects guest');

    await setField('email', report.uiEmail);
    await setField('password', 'Incorrect9!');
    await click('button[type=submit].auth-submit');
    await waitFor('document.body.textContent.includes("Email hoặc mật khẩu không chính xác")');
    report.checks.push('Invalid credentials displayed by real React form');
    await navigate('/register');
    await waitFor('document.querySelector("[name=fullName]") !== null');
    await setField('fullName', 'Duplicate User');
    await setField('email', report.uiEmail);
    await setField('password', password);
    await setField('confirmPassword', password);
    await click('[name=terms]');
    await click('button[type=submit].auth-submit');
    await waitFor('document.body.textContent.includes("Email này đã được đăng ký")');
    report.checks.push('Duplicate email displayed beside form field');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await writeFile(
      resolve(output, 'register-mobile.png'),
      Buffer.from((await send('Page.captureScreenshot', { captureBeyondViewport: true })).data, 'base64'),
    );
    assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true);
    assert.deepEqual(errors, []);
    report.checks.push('Mobile layout without horizontal overflow', 'No browser runtime exceptions');
  }
  assert.deepEqual(errors, []);
  report.gatewayResponses = responses;
  report.completedAt = new Date().toISOString();
  await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  socket?.close();
  chrome.kill();
  await server.close();
}
