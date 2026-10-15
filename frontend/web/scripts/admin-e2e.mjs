// Run from frontend/web after building and starting the backend. Uses seeded demo admin.
// Creates one clearly named test account, then disables it and removes its custom test role.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const gateway = process.env.E2E_GATEWAY_URL || 'http://localhost:8080';
const origin = 'http://localhost:5173';
const output = resolve('../../.tmp/admin-e2e');
await mkdir(output, { recursive: true });
const adminEmail = process.env.E2E_ADMIN_EMAIL || 'admin@gmail.com';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || 'Admin123';
const marker = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
const email = `admin-e2e-${marker.toLowerCase()}@example.com`;
const fullName = `Kiểm thử Admin ${marker}`;
const updatedName = `${fullName} đã sửa`;
const roleName = `QA_${marker}`;
const password = `Test9!${randomUUID()}`;
const report = { checks: [], testAccount: email };
const pause = ms => new Promise(done => setTimeout(done, ms));
let adminToken,
  accountId,
  roleId,
  accountDeleted = false,
  server,
  chrome,
  socket;

async function api(method, path, body, token = adminToken) {
  const response = await fetch(`${gateway}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  return { status: response.status, data: json.data, code: json.code };
}

try {
  const login = await api('POST', '/auth/login', { email: adminEmail, password: adminPassword }, null);
  assert.equal(login.status, 200, 'Seeded admin login');
  adminToken = login.data.accessToken;
  for (const path of [
    '/admin/overview',
    '/admin/roles',
    '/admin/permissions',
    '/admin/courses/overview',
    '/learning/admin/overview',
    '/payments/admin/analytics',
  ]) {
    assert.equal((await api('GET', path)).status, 200, path);
  }
  report.checks.push('Gateway reaches all four MySQL-backed services and custom role catalog');
  const root = resolve('dist');
  const mime = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  };
  const candidate = createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
    const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const content = await readFile(file);
      res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(content);
    } catch {
      res.writeHead(200, { 'Content-Type': 'text/html' }).end(await readFile(resolve(root, 'index.html')));
    }
  });
  await new Promise((done, reject) => {
    candidate.once('error', error => (error.code === 'EADDRINUSE' ? done() : reject(error)));
    candidate.listen(5173, () => {
      server = candidate;
      done();
    });
  });
  const profile = resolve(output, `chrome-${Date.now()}`);
  await mkdir(profile, { recursive: true });
  chrome = spawn(
    process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
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
  const pending = new Map(),
    errors = [];
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const task = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) task.reject(Error(JSON.stringify(message.error)));
      else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
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
  const wait = async expression => {
    for (let i = 0; i < 150; i++) {
      if (await run(`Boolean(${expression})`)) return;
      await pause(100);
    }
    await writeFile(
      resolve(output, 'failure.png'),
      Buffer.from((await send('Page.captureScreenshot', { captureBeyondViewport: true })).data, 'base64'),
    );
    throw Error(`Timeout: ${expression}; UI: ${await run('document.body.innerText.slice(0, 1200)')}`);
  };
  const clickText = text =>
    run(
      `(() => { const el = [...document.querySelectorAll('button')].find(e => e.textContent.trim() === ${JSON.stringify(text)} && !e.disabled); if (!el) throw Error('Button unavailable'); el.click(); })()`,
    );
  const field = (label, value) =>
    run(
      `(() => { const label = [...document.querySelectorAll('label')].find(e => e.textContent.startsWith(${JSON.stringify(label)})); const el = document.getElementById(label.htmlFor); Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`,
    );
  const navigate = async path => {
    await send('Page.navigate', { url: origin + path });
    await wait('document.readyState === "complete"');
  };
  const screenshot = async name => {
    await pause(300);
    await writeFile(
      resolve(output, `${name}.png`),
      Buffer.from((await send('Page.captureScreenshot', { captureBeyondViewport: true })).data, 'base64'),
    );
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1050,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate('/login');
  await wait('document.querySelector("[name=email]")');
  for (const [name, value] of [
    ['email', adminEmail],
    ['password', adminPassword],
  ])
    await run(
      `(() => { const el = document.querySelector('[name=${name}]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`,
    );
  await run('document.querySelector("button.auth-submit").click()');
  await wait('location.pathname === "/admin" && document.querySelector(".admin-transactions tbody tr")');
  assert.equal(await run('document.querySelector(".site-header") === null'), true);
  assert.equal(
    await run('document.querySelector(".admin-main").textContent.includes("Chưa tải được")'),
    false,
  );
  await screenshot('dashboard-desktop');
  await run('document.querySelector(".account-menu-trigger").click()');
  await wait('document.querySelector("[role=menu]")');
  assert.deepEqual(
    await run('[...document.querySelectorAll("[role=menuitem]")].map(item => item.textContent.trim())'),
    ['Hồ sơ cá nhân', 'Không gian quản trị', 'Đăng xuất'],
  );
  await screenshot('admin-account-menu');
  await run('document.querySelector(\'[role=menuitem][href="/admin/profile"]\').click()');
  await wait(
    'location.pathname === "/admin/profile" && document.querySelector(".admin-main h1")?.textContent.trim() === "Hồ sơ cá nhân"',
  );
  assert.equal(await run('document.querySelector(".site-header") === null'), true);
  report.checks.push('Admin avatar opens Profile/Logout menu; profile remains inside admin layout');
  report.checks.push('Admin login redirects to isolated dashboard with live service data');
  await navigate('/admin/users');
  await wait('document.querySelector(".admin-users-table tbody tr")');
  for (let i = 0; i < 2; i++) {
    await clickText('Tìm');
    await pause(200);
    await wait('document.querySelector(".admin-users-table tbody tr")');
  }
  report.checks.push('Repeated unchanged account search finishes without a stuck loading state');
  await screenshot('accounts-desktop');
  await clickText('Thêm tài khoản');
  await wait('document.querySelector("[role=dialog]")');
  await field('Họ và tên', fullName);
  await field('Email', email);
  await field('Mật khẩu khởi tạo', password);
  await run('document.querySelector("[role=dialog] button[type=submit]").click()');
  await wait(
    `!document.querySelector('[role=dialog]') && document.querySelector('.admin-users-table').textContent.includes(${JSON.stringify(email)})`,
  );
  accountId = (await api('GET', `/admin/users?keyword=${encodeURIComponent(email)}`)).data.content[0].id;
  const toggleStatus = async () => {
    await run(`document.querySelector('[aria-label="Đổi trạng thái ${fullName}"]').click()`);
    await wait('document.querySelector("[role=dialog]")');
    await run('document.querySelector("[role=dialog] button[type=submit]").click()');
    await wait('!document.querySelector("[role=dialog]")');
    await pause(250);
  };
  await toggleStatus();
  assert.equal((await api('POST', '/auth/login', { email, password }, null)).status, 403);
  await toggleStatus();
  assert.equal((await api('POST', '/auth/login', { email, password }, null)).status, 200);
  report.checks.push('React creates BCrypt account and locks/unlocks real login');
  await navigate('/admin/roles');
  await wait('document.querySelector(".admin-role-option")');
  await run(`(() => {
    const role = [...document.querySelectorAll('.admin-role-option')]
      .find(button => button.querySelector('strong').textContent === 'USER');
    role.click();
  })()`);
  await wait('document.querySelector(".admin-role-option.selected strong")?.textContent === "USER"');
  assert.equal(await run('document.querySelector("input[aria-label=DASHBOARD_VIEW]").disabled'), true);
  assert.equal(await run('document.querySelector("input[aria-label=ROLE_MANAGE]").disabled'), true);
  assert.equal(
    await run('document.querySelector(".admin-role-detail").textContent.includes("Xóa vai trò")'),
    false,
  );
  await screenshot('user-role-protected');
  // The built-in learner role is immutable at both UI and API layers.
  const defaultRole = (await api('GET', '/admin/roles')).data.find(role => role.name === 'USER');
  const rejected = await api('PUT', `/admin/roles/${defaultRole.id}`, {
    name: defaultRole.name,
    label: defaultRole.label,
    description: defaultRole.description,
    permissions: defaultRole.permissions,
    version: defaultRole.version,
  });
  assert.equal(rejected.status, 403);
  report.checks.push('Built-in USER role cannot gain admin rights through UI or API');
  await clickText('Tạo vai trò');
  await wait('document.querySelector("[role=dialog]")');
  await field('Mã vai trò', roleName);
  await field('Tên hiển thị', 'Hỗ trợ kiểm thử');
  await field('Mô tả', 'Vai trò tạo bởi kiểm thử giao diện tự động');
  await run('document.querySelector("[role=dialog] button[type=submit]").click()');
  await wait(`document.querySelector('.admin-role-option.selected')?.textContent.includes('${roleName}')`);
  roleId = (await api('GET', '/admin/roles')).data.find(role => role.name === roleName).id;
  await run('document.querySelector("input[aria-label=USER_CREATE]").click()');
  assert.equal(await run('document.querySelector("input[aria-label=USER_VIEW]").checked'), true);
  assert.equal(await run('document.querySelector("input[aria-label=ROLE_MANAGE]").disabled'), true);
  await clickText('Lưu thay đổi');
  await wait('!document.body.textContent.includes("Có thay đổi chưa được lưu")');
  await screenshot('roles-desktop');
  assert.ok(
    (await api('GET', '/admin/roles')).data
      .find(role => role.id === roleId)
      .permissions.includes('USER_CREATE'),
  );
  report.checks.push('React creates custom role, auto-selects dependencies and saves permissions');
  await navigate(`/admin/users?q=${encodeURIComponent(email)}`);
  await wait(`document.querySelector('.admin-users-table')?.textContent.includes(${JSON.stringify(email)})`);
  await run(`document.querySelector('[aria-label="Sửa ${fullName}"]').click()`);
  await wait('document.querySelector("[role=dialog]")');
  await field('Họ và tên', updatedName);
  await run(
    `(() => { const label = [...document.querySelectorAll('[role=dialog] label')].find(e => e.textContent.includes('${roleName}')); label.querySelector('input').click(); })()`,
  );
  await run('document.querySelector("[role=dialog] button[type=submit]").click()');
  await wait('!document.querySelector("[role=dialog]")');
  assert.equal((await api('GET', `/admin/users/${accountId}`)).data.fullName, updatedName);
  const custom = await api('POST', '/auth/login', { email, password }, null);
  assert.ok(custom.data.user.roles.includes(roleName));
  assert.deepEqual([...custom.data.user.roles].sort(), ['USER', roleName].sort());
  assert.equal(custom.data.user.permissions.includes('ROLE_MANAGE'), false);
  assert.equal((await api('GET', '/admin/users', null, custom.data.accessToken)).status, 200);
  assert.equal((await api('DELETE', `/admin/roles/${roleId}`, null, custom.data.accessToken)).status, 403);
  report.checks.push(
    'One edit modal updates name and custom role; backend grants only authorized operations',
  );
  await navigate('/admin/audit');
  await wait('document.querySelector(".admin-table tbody tr")');
  assert.equal(await run('document.body.textContent.includes("USER_UPDATE")'), true);
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  for (const [path, name, selector] of [
    ['/admin', 'dashboard-mobile', '.admin-transactions'],
    ['/admin/users', 'accounts-mobile', '.admin-users-table'],
    ['/admin/roles', 'roles-mobile', '.admin-role-option'],
  ]) {
    await navigate(path);
    await wait(`document.querySelector('${selector}')`);
    await screenshot(name);
    assert.equal(await run('document.documentElement.scrollWidth <= innerWidth'), true, name);
  }
  assert.deepEqual(errors, []);
  assert.equal((await api('PUT', `/admin/users/${accountId}/roles`, { roles: ['USER'] })).status, 200);
  await navigate(`/admin/users?q=${encodeURIComponent(email)}`);
  await wait(`document.querySelector('.admin-users-table')?.textContent.includes(${JSON.stringify(email)})`);
  await run(`document.querySelector('[aria-label="Xóa ${updatedName}"]').click()`);
  await wait('document.querySelector("[role=dialog]")');
  assert.equal(
    await run('document.querySelector("[role=dialog]").textContent.includes(' + JSON.stringify(email) + ')'),
    true,
  );
  await run('document.querySelector("[role=dialog] button[type=submit]").click()');
  await wait('!document.querySelector("[role=dialog]")');
  assert.equal((await api('GET', `/admin/users?keyword=${encodeURIComponent(email)}`)).data.totalElements, 0);
  accountDeleted = true;
  report.checks.push('Delete confirmation soft deletes account and removes it from the list');
  await run('document.querySelector(".account-menu-trigger").click()');
  await wait('document.querySelector(".account-menu-logout")');
  await run('document.querySelector(".account-menu-logout").click()');
  await wait('location.pathname === "/login" && document.querySelector("[name=email]")');
  assert.equal(await run('sessionStorage.length'), 0);
  report.checks.push('Admin menu logout clears session and returns to login');
  const learner = await api('POST', '/auth/login', {
    email: 'user@gmail.com',
    password: 'User123',
  }, null);
  assert.equal(learner.status, 200);
  assert.deepEqual(learner.data.user.roles, ['USER']);
  assert.equal(learner.data.user.permissions.includes('ADMIN_ACCESS'), false);
  assert.equal((await api('GET', '/admin/overview', null, learner.data.accessToken)).status, 403);
  await navigate('/admin');
  await wait('location.pathname === "/login" && document.querySelector("[name=email]")');
  for (const [name, value] of [
    ['email', 'user@gmail.com'],
    ['password', 'User123'],
  ])
    await run(
      `(() => { const el = document.querySelector('[name=${name}]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`,
    );
  await run('document.querySelector("button.auth-submit").click()');
  await wait('location.pathname === "/account"');
  await navigate('/admin');
  await wait('document.querySelector("[role=alert]")?.textContent.includes("không có quyền")');
  assert.equal(await run('document.querySelector(".admin-shell") === null'), true);
  report.checks.push('Default USER receives 403 from admin API and cannot enter /admin in React');
  report.checks.push('Audit trail visible; dashboard/accounts/roles fit 390px; no runtime exceptions');
  await writeFile(resolve(output, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (accountId && !accountDeleted) {
    await api('PUT', `/admin/users/${accountId}/roles`, { roles: ['USER'] });
    await api('DELETE', `/admin/users/${accountId}`);
  }
  if (roleId) await api('DELETE', `/admin/roles/${roleId}`);
  socket?.close();
  chrome?.kill();
  if (server) await new Promise(done => server.close(done));
}
