import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'admin-roles' });
const { default: Roles } = await env.load('features/admin/pages/AdminRolesPage.jsx');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { adminApi } = await env.load('features/admin/api/adminApi.js');

afterEach(env.unmount);
after(env.close);

test('roles can retry a failed directory, filter permissions and keep the draft after a version conflict', async t => {
  let role = {
    id: 7,
    name: 'EDITOR',
    label: 'Editor',
    description: '',
    permissions: [],
    version: 9,
    userCount: 0,
  };
  let reads = 0;
  t.mock.method(adminApi, 'roles', async () => {
    if (++reads === 1) throw new Error('Roles unavailable');
    return { data: [role, { ...role, id: 8, name: 'MENTOR', label: 'Mentor' }] };
  });
  t.mock.method(adminApi, 'permissions', async () => ({
    data: [
      {
        code: 'COURSE_VIEW',
        label: 'View courses',
        resource: 'Catalog',
        group: 'Courses',
        action: 'VIEW',
        dependencies: [],
      },
      {
        code: 'COURSE_CREATE',
        label: 'Create courses',
        resource: 'Catalog',
        group: 'Courses',
        action: 'CREATE',
        dependencies: ['COURSE_VIEW'],
      },
    ],
  }));
  let writes = 0;
  const update = t.mock.method(adminApi, 'updateRole', async (_, payload) => {
    if (++writes === 1) throw new Error('Role version conflict');
    role = { ...role, ...payload, version: 10 };
    return { data: role };
  });
  const exportUrl = t.mock.method(URL, 'createObjectURL', () => 'blob:test');
  t.mock.method(window.HTMLAnchorElement.prototype, 'click', () => {});
  const user = { id: 1, roles: ['ADMIN'], permissions: ['ROLE_MANAGE'] };
  await env.render(h(AuthContext.Provider, { value: { user } }, h(Roles)));
  assert.match(document.body.textContent, /Roles unavailable/);
  await env.click(env.button('Thử lại'));
  await env.setInputValue(env.field('Tìm vai trò'), 'Editor');
  assert.equal(document.querySelectorAll('.admin-role-option').length, 1);
  await env.setInputValue(env.field('Tìm quyền hoặc chức năng'), 'Create');
  await env.click('input[aria-label="COURSE_CREATE"]');
  assert.equal(window.dispatchEvent(new window.Event('beforeunload', { cancelable: true })), false);
  await env.click(env.button('Lưu thay đổi'));
  assert.match(document.body.textContent, /Role version conflict/);
  await env.click(env.button('Hoàn tác'));
  assert.equal(document.querySelector('input[aria-label="COURSE_CREATE"]').checked, false);
  await env.selectOption(document.querySelector('.admin-permission-toolbar [role="combobox"]'), 'granted');
  assert.match(document.body.textContent, /Không có quyền phù hợp/);
  await env.selectOption(document.querySelector('.admin-permission-toolbar [role="combobox"]'), 'all');
  await env.click('input[aria-label="COURSE_CREATE"]');
  await env.click(env.button('Lưu thay đổi'));
  assert.deepEqual(update.mock.calls[1].arguments[1].permissions, ['COURSE_CREATE', 'COURSE_VIEW']);
  assert.equal(update.mock.calls[1].arguments[1].version, 9);
  await env.click(env.button('Tải ma trận quyền (JSON)'));
  assert.deepEqual(JSON.parse(await exportUrl.mock.calls[0].arguments[0].text()), {
    role: 'EDITOR',
    permissions: ['COURSE_CREATE', 'COURSE_VIEW'],
  });
});
