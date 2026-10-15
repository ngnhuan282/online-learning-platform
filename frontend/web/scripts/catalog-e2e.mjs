// Read-only smoke test against the built frontend, Chrome and the running Gateway/MySQL stack.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';

const origin = 'http://localhost:5173';
const gateway = process.env.E2E_GATEWAY_URL || 'http://localhost:8080';
const root = resolve('dist');
const output = resolve('../../.tmp/catalog-e2e');
const profile = resolve(output, `chrome-${Date.now()}`);
await mkdir(profile, { recursive: true });
const response = await fetch(`${gateway}/api/v1/courses?size=100`);
assert.equal(response.status, 200);
const expected = (await response.json()).data;
assert.ok(expected.content.length > 0, 'Published database courses are available');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (request, reply) => {
  const pathname = decodeURIComponent(new URL(request.url, origin).pathname);
  const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(root + sep)) return reply.writeHead(403).end();
  try {
    const content = await readFile(file);
    reply.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' }).end(content);
  } catch {
    reply.writeHead(200, { 'Content-Type': 'text/html' }).end(await readFile(resolve(root, 'index.html')));
  }
});
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
const checks = [];
try {
  for (const resource of ['sections', 'reviews']) {
    const response = await fetch(`${gateway}/api/v1/courses/${expected.content[0].id}/${resource}`);
    assert.equal(response.status, 200, `Guest ${resource} API matches the current public catalog contract`);
  }
  checks.push('Guest curriculum and review APIs return HTTP 200');
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      port = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0];
      break;
    } catch {
      await pause(100);
    }
  }
  assert.ok(port, 'Chrome started');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, reject) => {
    socket.onopen = done;
    socket.onerror = reject;
  });
  const pending = new Map();
  const errors = [];
  let id = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      pending.delete(message.id);
      if (message.error) request.reject(message.error);
      else request.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params.exceptionDetails.text);
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const key = ++id;
      pending.set(key, { resolve, reject });
      socket.send(JSON.stringify({ id: key, method, params }));
    });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await evaluate(expression)) return;
      await pause(100);
    }
    throw Error(`Timed out: ${expression}; ${await evaluate('document.body.innerText.slice(0, 2000)')}`);
  };
  const navigate = path => send('Page.navigate', { url: origin + path });
  const screenshot = async name =>
    writeFile(
      resolve(output, name),
      Buffer.from((await send('Page.captureScreenshot', { captureBeyondViewport: true })).data, 'base64'),
    );
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const path of ['/', '/courses']) {
    await navigate(path);
    await waitFor(
      `document.querySelectorAll('.course-grid .course-card').length === ${expected.totalElements}`,
    );
    const titles = await evaluate(
      "[...document.querySelectorAll('.course-card h3')].map(item => item.innerText)",
    );
    for (const course of expected.content)
      assert.ok(titles.includes(course.title), `${path} displays ${course.title}`);
    await screenshot(path === '/' ? 'home.png' : 'courses.png');
    checks.push(
      `${path}: ${titles.length} published database courses visible after anonymous session restore`,
    );
  }
  await navigate('/courses?filter=certificates');
  await waitFor("document.querySelectorAll('.course-grid .course-card').length > 0");
  const certificateTitles = await evaluate(
    "[...document.querySelectorAll('.course-card h3')].map(item => item.innerText)",
  );
  assert.ok(certificateTitles.every(title => /IELTS|TOEIC|TOEFL/i.test(title)));
  checks.push('Certificate filter returns the database IELTS/TOEIC courses');
  const selected = expected.content[0];
  await navigate(`/courses?q=${encodeURIComponent(selected.title)}`);
  await waitFor("document.querySelectorAll('.course-grid .course-card').length === 1");
  await evaluate("document.querySelector('.course-image-button').click()");
  await waitFor(`document.querySelector('h1')?.innerText === ${JSON.stringify(selected.title)}`);
  assert.equal(await evaluate('location.pathname'), `/courses/${selected.id}`);
  checks.push('Search and card navigation load the actual database course detail');
  await navigate('/courses/999999999');
  await waitFor("document.body.innerText.includes('Không tìm thấy khóa học')");
  assert.equal(await evaluate("document.body.innerText.includes('IELTS Intensive')"), false);
  checks.push('A missing course shows 404 without demo data or a purchase action');
  assert.deepEqual(errors, []);
  const report = { checks, runtimeErrors: errors };
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ id: 999999, method: 'Browser.close' }));
  }
  socket?.close();
  chrome.kill();
  await new Promise(done => server.close(done));
}
