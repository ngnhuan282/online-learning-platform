import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h, useState } from 'react';
import { createServer } from 'vite';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost/admin/shop',
  pretendToBeVisual: true,
});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  Event: dom.window.Event,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
  DocumentFragment: dom.window.DocumentFragment,
  ShadowRoot: dom.window.ShadowRoot,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  IS_REACT_ACT_ENVIRONMENT: true,
});
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/admin-toast',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule('/src/' + path);
const { ToastProvider, ToastContext } = await load('shared/context/ToastContext.jsx');
const { CommerceTable } = await load('features/admin/components/CommerceAdminUi.jsx');
const { default: useAdminPagination } = await load('features/admin/hooks/useAdminPagination.js');
const { default: AdminCommunityPage } = await load('features/admin/pages/AdminCommunityPage.jsx');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { commerceAdminApi } = await load('features/admin/api/commerceAdminApi.js');
const { default: client } = await load('shared/apis/axiosClient.js');
const { notifyAdminFailure } = await load('shared/utils/adminFeedback.js');
const { invalidateSessionRequests } = await load('shared/utils/tokenUtils.js');
let root, show;
async function mount() {
  root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: createCache({ key: 'admin-toast-test' }) },
        h(
          ToastProvider,
          null,
          h(ToastContext.Consumer, null, value => {
            show = value;
            return null;
          }),
        ),
      ),
    ),
  );
}
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
});
after(async () => {
  await server.close();
  dom.window.close();
});

test('success/error notices have independent countdowns, accessible roles and close automatically', async () => {
  await mount();
  await act(async () => {
    show('Saved', { duration: 80 });
    show('Rejected', { severity: 'error', duration: 1000 });
  });
  assert.ok(document.querySelector('.app-toast--success[role=status]'));
  assert.ok(document.querySelector('.app-toast--error[role=alert]'));
  assert.equal(
    document.querySelector('.app-toast--success .app-toast-countdown').style.animationDuration,
    '80ms',
  );
  await act(async () => new Promise(resolve => setTimeout(resolve, 120)));
  assert.equal(document.querySelector('.app-toast--success'), null);
  assert.ok(document.querySelector('.app-toast--error'));
  await act(async () => document.querySelector('.app-toast--error button').click());
  assert.equal(document.querySelector('.app-toast'), null);
});

test('admin mutation feedback reports success and failure once, and ignores reads', async () => {
  await mount();
  const adapter = async config => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { success: true, data: { id: 1 } },
  });
  await act(async () => {
    await client.get('/api/v1/admin/roles', { adapter });
  });
  assert.equal(document.querySelector('.app-toast'), null);
  await act(async () => {
    await client.post('/api/v1/admin/roles', {}, { adapter });
  });
  assert.equal(document.querySelectorAll('.app-toast--success').length, 1);
  let failure;
  await act(async () => {
    try {
      await client.delete('/api/v1/learning/admin/shop/items/FRAME_TEST', {
        adapter: async config => {
          throw { config, response: { status: 403, data: { code: 'FORBIDDEN', message: 'Access denied' } } };
        },
      });
    } catch (error) {
      failure = error;
      notifyAdminFailure(error);
    }
  });
  assert.equal(failure.code, 'FORBIDDEN');
  assert.equal(document.querySelectorAll('.app-toast--error').length, 1);
  assert.match(document.querySelector('.app-toast--error').textContent, /không có quyền/);
});

test('late responses from an ended session cannot display a success toast', async () => {
  await mount();
  let resolve, started;
  const ready = new Promise(r => {
    started = r;
  });
  const request = client.post(
    '/api/v1/admin/roles',
    {},
    {
      adapter: config => {
        started();
        return new Promise(r => {
          resolve = () => r({ config, status: 200, headers: {}, data: { success: true, data: { id: 1 } } });
        });
      },
    },
  );
  await ready;
  invalidateSessionRequests();
  resolve();
  await assert.rejects(request, error => error.code === 'ERR_CANCELED');
  assert.equal(document.querySelector('.app-toast'), null);
});

test('catalog pagination survives a table reload and clamps after deleting the last row', async () => {
  const initial = Array.from({ length: 11 }, (_, index) => ({ id: index + 1, name: 'Row ' + (index + 1) }));
  function Harness() {
    const pagination = useAdminPagination();
    const [visible, setVisible] = useState(true),
      [rows, setRows] = useState(initial);
    return h(
      'div',
      null,
      h('button', { id: 'toggle-table', onClick: () => setVisible(value => !value) }, 'Reload'),
      h('button', { id: 'delete-last', onClick: () => setRows(initial.slice(0, 10)) }, 'Delete last'),
      visible ? h(CommerceTable, { paginate: true, pagination, rows, columns: [['Name', 'name']] }) : null,
    );
  }
  root = createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(h(CacheProvider, { value: createCache({ key: 'admin-page-test' }) }, h(Harness))),
  );
  await act(async () => {
    document
      .querySelector('[role="combobox"]')
      .dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
  const choices = [...document.querySelectorAll('[role="option"]')];
  assert.deepEqual(
    choices.map(option => Number(option.dataset.value)),
    [5, 10, 20],
  );
  await act(async () => choices[0].click());
  assert.equal(document.querySelectorAll('tbody tr').length, 5);
  await act(async () =>
    [...document.querySelectorAll('button')].find(button => button.textContent === '3').click(),
  );
  assert.match(document.querySelector('tbody').textContent, /Row 11/);
  await act(async () => document.getElementById('toggle-table').click());
  await act(async () => document.getElementById('toggle-table').click());
  assert.match(document.querySelector('tbody').textContent, /Row 11/);
  await act(async () => document.getElementById('delete-last').click());
  assert.match(document.querySelector('tbody').textContent, /Row 6/);
  assert.equal(document.querySelectorAll('tbody tr').length, 5);
  assert.equal(document.querySelector('.MuiPaginationItem-page[aria-current=page]').textContent, '2');
});

test('a moderator keeps hide and lock actions without gaining content edit or CRUD delete permission', async () => {
  const original = commerceAdminApi.posts;
  commerceAdminApi.posts = async () => ({
    data: {
      content: [
        {
          id: 1,
          title: 'Discussion',
          displayName: 'Learner',
          kind: 'DISCUSSION',
          createdAt: '2026-11-17T00:00:00Z',
          locked: false,
          deletedAt: null,
        },
      ],
      totalElements: 1,
      totalPages: 1,
    },
  });
  try {
    root = createRoot(document.getElementById('root'));
    await act(async () =>
      root.render(
        h(
          CacheProvider,
          { value: createCache({ key: 'admin-moderator-test' }) },
          h(
            AuthContext.Provider,
            {
              value: {
                user: {
                  id: 91,
                  status: 'ACTIVE',
                  roles: ['MODERATOR'],
                  permissions: ['ADMIN_ACCESS', 'COMMUNITY_VIEW', 'COMMUNITY_MODERATE'],
                },
              },
            },
            h(AdminCommunityPage),
          ),
        ),
      ),
    );
    assert.ok(document.querySelector('button[aria-label="Ẩn bài"]'));
    assert.ok(document.querySelector('button[aria-label="Khóa thảo luận"]'));
    assert.equal(document.querySelector('button[aria-label="Chỉnh sửa"]'), null);
    assert.equal(document.querySelector('button[aria-label="Xóa bài viết"]'), null);
  } finally {
    commerceAdminApi.posts = original;
  }
});
