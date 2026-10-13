import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Raw cookie values exist only in this test driver's memory, never in reports or application JS.
const digest = value => createHash('sha256').update(value).digest('hex');
const sql = query =>
  execFileSync(
    'docker',
    [
      'compose',
      ...(process.env.E2E_COMPOSE_ENV_FILE ? ['--env-file', process.env.E2E_COMPOSE_ENV_FILE] : []),
      ...(process.env.E2E_COMPOSE_PROJECT ? ['-p', process.env.E2E_COMPOSE_PROJECT] : []),
      'exec',
      '-T',
      'mysql',
      'sh',
      '-c',
      'export MYSQL_PWD="$MYSQL_ROOT_PASSWORD"; exec mysql -uroot --batch --skip-column-names auth_db',
    ],
    { cwd: resolve('../..'), input: query, encoding: 'utf8', windowsHide: true },
  ).trim();

export default async function refreshScenarios({
  send,
  run,
  reload,
  waitFor,
  report,
  responses,
  pause,
  gateway,
  api,
}) {
  const cookie = async () =>
    (await send('Network.getCookies', { urls: [gateway + '/api/v1/auth/refresh'] })).cookies.find(
      value => value.name === 'refresh_token',
    );
  const before = await cookie();
  assert.ok(before);
  assert.equal(before.httpOnly, true);
  assert.equal(before.sameSite, 'Lax');
  assert.equal(before.path, '/api/v1/auth');
  assert.equal(before.session, true);
  assert.equal(before.secure, false);
  assert.equal(await run('document.cookie.includes("refresh_token")'), false);
  const storedHash = digest(before.value);
  assert.equal(
    sql(
      `SELECT COUNT(*) FROM refresh_tokens WHERE token_hash = '${storedHash}' AND CHAR_LENGTH(token_hash) = 64 AND revoked_at IS NULL;`,
    ),
    '1',
  );
  assert.equal(
    sql(
      "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='auth_db' AND table_name='refresh_tokens' AND column_name IN ('token','raw_token','refresh_token');",
    ),
    '0',
  );
  report.checks.push(
    'Refresh cookie HttpOnly, SameSite=Lax, scoped path, session-only; unavailable to JS',
    'MySQL contains SHA-256 hash only',
  );

  const expiry = await run(
    '(async () => { const t = await import("/src/shared/utils/tokenUtils.js"); return t.decodeToken(t.getAccessToken()).exp; })()',
  );
  const remaining = expiry * 1000 - Date.now();
  assert.ok(remaining < 15000, 'Run refresh E2E with JWT_ACCESS_TOKEN_SECONDS=5');
  // Notification requests share the client and can be the first request after expiry.
  const checkpoint = responses.length;
  await pause(Math.max(0, remaining) + 1100);
  const email = await run(
    '(async () => { const {default: client} = await import("/src/shared/apis/axiosClient.js"); return (await client.get("/api/v1/users/me")).data.email; })()',
  );
  assert.equal(email, report.uiEmail);
  const flow = responses.slice(checkpoint).filter(item => item.method !== 'OPTIONS');
  assert.ok(
    flow.some(
      item =>
        item.url.startsWith(gateway + '/api/v1/') && !item.url.includes('/auth/') && item.status === 401,
    ),
    'Expired protected request must receive 401',
  );
  assert.equal(flow.filter(item => item.url.endsWith('/auth/refresh') && item.status === 200).length, 1);
  assert.ok(flow.some(item => item.url.endsWith('/users/me') && item.status === 200));
  const rotated = await cookie();
  assert.equal(rotated.value === before.value, false);
  assert.equal(
    sql(`SELECT COUNT(*) FROM refresh_tokens WHERE token_hash = '${storedHash}' AND revoked_at IS NOT NULL;`),
    '1',
  );
  assert.equal((await api('/auth/refresh', {}, null, before.value)).body.code, 'REFRESH_TOKEN_REVOKED');
  report.checks.push(
    'Real access expiry across the shared client produces protected 401 -> one refresh -> authoritative me succeeds',
    'Rotation changes cookie; old hash revoked and old cookie rejected',
  );

  const restoreStart = responses.length;
  await run('sessionStorage.removeItem("learnsphere.accessToken")');
  await reload('sessionStorage.length === 1 && document.body.textContent.includes("Nguyễn Auth E2E")');
  assert.equal(await run('sessionStorage.length'), 1);
  const restoreFlow = responses.slice(restoreStart);
  assert.ok(
    restoreFlow.some(
      item => item.url.endsWith('/auth/refresh') && item.method === 'POST' && item.status === 200,
    ),
  );
  assert.ok(restoreFlow.some(item => item.url.endsWith('/users/me') && item.status === 200));
  report.checks.push('Reload without access token restores through cookie refresh and authoritative me');

  const lastCookie = await cookie();
  await run('document.querySelector(".account-menu-trigger").click()');
  await waitFor('document.querySelector(".account-menu-logout") !== null');
  await run('document.querySelector(".account-menu-logout").click()');
  await waitFor('location.pathname === "/login" && document.querySelector("[name=email]") !== null');
  assert.equal(await run('sessionStorage.length'), 0);
  assert.equal(await cookie(), undefined);
  assert.equal(
    sql(
      `SELECT COUNT(*) FROM refresh_tokens WHERE token_hash = '${digest(lastCookie.value)}' AND revoked_at IS NOT NULL;`,
    ),
    '1',
  );
  assert.equal((await api('/auth/refresh', {}, null, lastCookie.value)).body.code, 'REFRESH_TOKEN_REVOKED');
  const status = await run(
    `(async () => { const r = await fetch(${JSON.stringify(gateway + '/api/v1/auth/refresh')}, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }); return r.status; })()`,
  );
  assert.equal(status, 401);
  report.checks.push(
    'Logout revokes MySQL row, clears cookie and local user/token',
    'Refresh after logout fails with 401',
  );
  report.refreshCookie = { httpOnly: true, sameSite: 'Lax', path: before.path, secure: false, session: true };
  report.database = { storedHashOnly: true, oldTokenRevoked: true, logoutTokenRevoked: true };
}
