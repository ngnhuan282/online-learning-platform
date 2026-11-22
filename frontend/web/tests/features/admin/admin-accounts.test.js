import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-accounts' });
const { default: Accounts } = await env.load('features/admin/pages/AdminAccountsPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { userApi } = await env.load('features/auth/api/userApi.js');
const { adminApi } = await env.load('features/admin/api/adminApi.js');

afterEach(env.unmount);
after(env.close);

const learner = {
  id: 7,
  fullName: 'Lan, Nguyen',
  email: 'lan@example.test',
  status: 'ACTIVE',
  roles: ['USER'],
};

function Location() {
  return h('output', null, useLocation().search);
}

function render(path = '/admin/users') {
  const user = {
    id: 1,
    roles: ['ADMIN'],
    permissions: ['USER_CREATE', 'USER_STATUS_UPDATE', 'USER_ROLES_ASSIGN', 'USER_DELETE'],
  };
  return env.render(
    h(
      MemoryRouter,
      { initialEntries: [path] },
      h(AuthContext.Provider, { value: { user } }, h(Accounts), h(Location)),
    ),
  );
}

function mockAccounts(
  t,
  load = async () => ({ data: { content: [learner], totalPages: 3, totalElements: 25 } }),
) {
  t.mock.method(adminApi, 'roles', async () => ({
    data: [
      { id: 1, name: 'USER', label: 'Learner' },
      { id: 2, name: 'MENTOR', label: 'Mentor' },
    ],
  }));
  t.mock.method(adminApi, 'overview', async () => ({ data: {} }));
  return t.mock.method(userApi, 'adminListUsers', load);
}

test('accounts recover from a listing error, filter by status and export the visible page', async t => {
  let requests = 0;
  const read = mockAccounts(t, async () => {
    if (++requests === 1) throw new Error('Directory offline');
    return { data: { content: [learner], totalPages: 3, totalElements: 25 } };
  });
  const createUrl = t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  const downloads = [];
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', function () {
    downloads.push(this.download);
  });
  await render();
  assert.match(document.body.textContent, /Directory offline/);
  await env.click(env.button('Thử lại'));
  await env.setInputValue('input[placeholder="Tìm theo tên, email..."]', ' Lan ');
  await env.click(env.button('Tìm'));
  await env.waitFor(
    () => read.mock.calls.at(-1).arguments[0].keyword === 'Lan',
    'Search must reach the directory API',
  );
  assert.equal(read.mock.calls.at(-1).arguments[0].keyword, 'Lan');
  const filters = () => document.querySelectorAll('form.admin-filter-row [role="combobox"]');
  await env.selectOption(filters()[0], 'USER');
  await env.selectOption(filters()[1], 'LOCKED');
  assert.deepEqual(
    [read.mock.calls.at(-1).arguments[0].role, read.mock.calls.at(-1).arguments[0].status],
    ['USER', 'LOCKED'],
  );
  await env.click(env.button('Đặt lại bộ lọc'));
  await env.waitFor(() => document.querySelector('output').textContent === '', 'Filters must clear the URL');
  assert.equal(document.querySelector('output').textContent, '');
  await env.click(env.button('Xuất CSV trang này'));
  assert.deepEqual(downloads, ['tai-khoan-trang-hien-tai.csv']);
  assert.match(await createUrl.mock.calls[0].arguments[0].text(), /"Lan, Nguyen"/);
});

test('account creation and deletion persist only after confirmation and preserve the draft on failure', async t => {
  mockAccounts(t);
  let attempts = 0;
  const create = t.mock.method(userApi, 'adminCreateUser', async () => {
    if (++attempts === 1) throw Object.assign(new Error('duplicate'), { code: 'EMAIL_ALREADY_EXISTS' });
  });
  const remove = t.mock.method(userApi, 'adminDeleteUser', async () => {});

  await render('/admin/users?create=1');
  const dialog = () => document.querySelector('[role="dialog"]');
  await env.click(env.button('Đóng', dialog()));
  await env.waitFor(
    () => document.querySelector('output').textContent === '',
    'Closing must clear the create flag',
  );
  assert.equal(document.querySelector('output').textContent, '');
  await env.click(env.button('Thêm tài khoản'));
  await env.setInputValue(env.field('Họ và tên', dialog()), 'New learner');
  await env.setInputValue(env.field('Email', dialog()), 'new@example.test');
  await env.setInputValue(env.field('Mật khẩu khởi tạo', dialog()), 'ExamplePass123');
  await env.selectOption(env.field('Trạng thái', dialog()), 'LOCKED');
  await env.click(env.field('Mentor (MENTOR)', dialog()));
  await env.click(env.field('Learner (USER)', dialog()));
  await env.click(env.button('Lưu thay đổi', dialog()));
  assert.match(dialog().textContent, /Email đã tồn tại/);
  await env.click(env.button('Lưu thay đổi', dialog()));
  assert.deepEqual(create.mock.calls[1].arguments[0], {
    fullName: 'New learner',
    email: 'new@example.test',
    password: 'ExamplePass123',
    status: 'LOCKED',
    roles: ['MENTOR'],
  });

  await env.click('[aria-label="Xóa Lan, Nguyen"]');
  await env.click(env.button('Đóng', dialog()));
  assert.equal(remove.mock.callCount(), 0);
  await env.click('[aria-label="Xóa Lan, Nguyen"]');
  await env.click(env.button('Xóa tài khoản', dialog()));
  assert.deepEqual(remove.mock.calls[0].arguments, [7]);
});
