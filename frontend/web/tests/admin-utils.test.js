import test from 'node:test';
import assert from 'node:assert/strict';
import { can, csvCell, togglePermission } from '../src/features/admin/utils/adminUtils.js';

const catalog = [
  { code: 'ADMIN_ACCESS', dependencies: [] },
  { code: 'USER_VIEW', dependencies: ['ADMIN_ACCESS'] },
  { code: 'USER_UPDATE', dependencies: ['ADMIN_ACCESS', 'USER_VIEW'] },
];

test('custom roles require explicit admin permission; USER is not admin', () => {
  assert.equal(can({ roles: ['USER'] }, 'USER_VIEW'), false);
  assert.equal(can({ roles: ['SUPPORT'], permissions: ['USER_VIEW'] }, 'USER_VIEW'), true);
  assert.equal(can({ roles: ['SUPPORT'], permissions: ['USER_VIEW'] }, 'ROLE_MANAGE'), false);
  assert.equal(can({ roles: ['ADMIN'] }, 'ROLE_MANAGE'), true);
});

test('matrix adds required view permissions and removes dependent permissions', () => {
  const granted = togglePermission([], 'USER_UPDATE', true, catalog);
  assert.deepEqual(new Set(granted), new Set(['USER_UPDATE', 'USER_VIEW', 'ADMIN_ACCESS']));
  assert.deepEqual(togglePermission(granted, 'USER_VIEW', false, catalog), ['ADMIN_ACCESS']);
  assert.deepEqual(togglePermission(granted, 'ADMIN_ACCESS', false, catalog), []);
});

test('CSV export escapes formulas, quotes and line breaks', () => {
  assert.equal(csvCell('=SUM(A1:A2)'), '"\'=SUM(A1:A2)"');
  assert.equal(csvCell('A "quoted" name'), '"A ""quoted"" name"');
  assert.equal(csvCell('first\nsecond'), '"first\nsecond"');
});
