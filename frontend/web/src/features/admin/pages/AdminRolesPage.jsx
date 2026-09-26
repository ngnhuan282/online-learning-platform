import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import {
  Add,
  SaveOutlined,
  Undo,
  ShieldOutlined,
  LockOutlined,
  Tune,
  BadgeOutlined,
  Download,
  DeleteOutlined,
} from '@mui/icons-material';
import useAuth from '../../auth/hooks/useAuth';
import useToast from '../../../shared/hooks/useToast';
import { adminApi } from '../api/adminApi';
import { can, download, togglePermission } from '../utils/adminUtils';
import { LoadState, PageHeading, StatCard } from '../components/AdminUi';

export default function AdminRolesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [state, setState] = useState({ loading: true, roles: [], catalog: [], error: null });
  const [retry, setRetry] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState('');
  const [permissionQuery, setPermissionQuery] = useState('');
  const [type, setType] = useState('all');
  const [filter, setFilter] = useState('all');
  const [dialog, setDialog] = useState(null);
  const [nextRole, setNextRole] = useState(null);
  const [form, setForm] = useState({ name: '', label: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([adminApi.roles(), adminApi.permissions()])
      .then(([roles, catalog]) => {
        if (active) setState({ loading: false, roles: roles.data, catalog: catalog.data, error: null });
      })
      .catch(error => {
        if (active) setState(s => ({ ...s, loading: false, error }));
      });
    return () => {
      active = false;
    };
  }, [retry]);
  const selected = state.roles.find(r => r.id === selectedId) || state.roles[0];
  const permissions = useMemo(() => draft ?? selected?.permissions ?? [], [draft, selected]);
  const dirty = Boolean(
    selected && [...permissions].sort().join() !== [...selected.permissions].sort().join(),
  );
  const editable = selected && (!selected.systemRole || selected.name === 'USER') && can(user, 'ROLE_MANAGE');
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const groups = useMemo(() => {
    const result = {};
    state.catalog.forEach(permission => {
      const matchText = `${permission.label} ${permission.code} ${permission.resource}`
        .toLocaleLowerCase('vi')
        .includes(permissionQuery.toLocaleLowerCase('vi'));
      if (
        !matchText ||
        (filter === 'granted' && !permissions.includes(permission.code)) ||
        (filter === 'ungranted' && permissions.includes(permission.code))
      )
        return;
      result[permission.group] ??= {};
      result[permission.group][permission.resource] ??= [];
      result[permission.group][permission.resource].push(permission);
    });
    return result;
  }, [state.catalog, permissionQuery, filter, permissions]);
  function select(role) {
    if (dirty && role.id !== selected.id) {
      setNextRole(role);
      setDialog('discard');
      return;
    }
    setSelectedId(role.id);
    setDraft(null);
    setError(null);
  }
  function check(permission, checked) {
    setDraft(togglePermission(permissions, permission.code, checked, state.catalog));
  }
  async function mutate(event) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (dialog === 'create') {
        const response = await adminApi.createRole({ ...form, permissions: ['ADMIN_ACCESS'], version: 0 });
        setSelectedId(response.data.id);
        setDraft(null);
        setDialog(null);
      } else if (dialog === 'delete') {
        await adminApi.deleteRole(selected.id);
        setSelectedId(null);
        setDraft(null);
        setDialog(null);
      } else {
        const response = await adminApi.updateRole(selected.id, {
          name: selected.name,
          label: selected.label,
          description: selected.description,
          permissions,
          version: selected.version,
        });
        setState(s => ({ ...s, roles: s.roles.map(r => (r.id === selected.id ? response.data : r)) }));
        setDraft(null);
      }
      toast('Đã lưu thay đổi phân quyền.');
      setRetry(r => r + 1);
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  }
  function cell(items, action) {
    const permission = items.find(p => p.action === action);
    return permission ? (
      <Checkbox
        size="small"
        checked={permissions.includes(permission.code)}
        disabled={!editable || busy || permission.adminOnly}
        onChange={e => check(permission, e.target.checked)}
        slotProps={{ input: { 'aria-label': permission.code } }}
      />
    ) : (
      <span className="admin-muted">—</span>
    );
  }
  return (
    <>
      <PageHeading
        title="Vai trò & Phân quyền"
        description="Quản lý vai trò và quyền truy cập của người dùng trong hệ thống."
      >
        {can(user, 'ROLE_MANAGE') && (
          <Button
            variant="contained"
            startIcon={<Add />}
            disabled={dirty || busy}
            onClick={() => {
              setForm({ name: '', label: '', description: '' });
              setError(null);
              setDialog('create');
            }}
          >
            Tạo vai trò
          </Button>
        )}
      </PageHeading>
      <div className="admin-stats">
        <StatCard
          title="TỔNG SỐ VAI TRÒ"
          value={state.roles.length}
          detail="Vai trò đang được cấu hình"
          icon={<BadgeOutlined />}
        />
        <StatCard
          title="TỔNG SỐ QUYỀN"
          value={state.catalog.length}
          detail="Quyền gắn với API của hệ thống"
          icon={<ShieldOutlined />}
          tone="green"
        />
        <StatCard
          title="VAI TRÒ HỆ THỐNG"
          value={state.roles.filter(r => r.systemRole).length}
          detail="Không thể xóa; USER được tùy chỉnh quyền"
          icon={<LockOutlined />}
          tone="amber"
        />
        <StatCard
          title="VAI TRÒ TÙY CHỈNH"
          value={state.roles.filter(r => !r.systemRole).length}
          detail="Có thể tùy chỉnh quyền chức năng"
          icon={<Tune />}
          tone="purple"
        />
      </div>
      <LoadState loading={state.loading} error={state.error} retry={() => setRetry(r => r + 1)} />
      {!state.loading && !state.error && (
        <div className="admin-roles-layout">
          <aside className="admin-card admin-role-list">
            <h2>
              Danh sách vai trò <span className="admin-pill">{state.roles.length}</span>
            </h2>
            <TextField
              size="small"
              fullWidth
              label="Tìm vai trò"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <div className="admin-tabs">
              {[
                ['all', 'Tất cả'],
                ['system', 'Hệ thống'],
                ['custom', 'Tùy chỉnh'],
              ].map(([value, label]) => (
                <button key={value} className={type === value ? 'active' : ''} onClick={() => setType(value)}>
                  {label}
                </button>
              ))}
            </div>
            {state.roles
              .filter(
                r =>
                  `${r.name} ${r.label}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')) &&
                  (type === 'all' || r.systemRole === (type === 'system')),
              )
              .map(role => (
                <button
                  key={role.id}
                  className={`admin-role-option ${selected?.id === role.id ? 'selected' : ''}`}
                  onClick={() => select(role)}
                >
                  <div>
                    <strong>{role.name}</strong>
                    <span className={`admin-pill ${role.systemRole ? 'amber' : ''}`}>
                      {role.systemRole ? 'Hệ thống' : 'Tùy chỉnh'}
                    </span>
                  </div>
                  <b>{role.label}</b>
                  <p>{role.description || 'Chưa có mô tả'}</p>
                  <div>
                    <small>{role.userCount} người dùng</small>
                    <small>
                      {role.permissions.length}/{state.catalog.length} quyền
                    </small>
                  </div>
                </button>
              ))}
          </aside>
          {selected && (
            <div className="admin-role-detail">
              <section className="admin-card">
                <div className="admin-card-heading">
                  <div>
                    <h2>
                      {selected.label} <span className="admin-pill">{selected.name}</span>
                    </h2>
                    <p>{selected.description || 'Quản lý quyền truy cập theo chức năng.'}</p>
                    <span className="admin-pill">
                      {permissions.length}/{state.catalog.length} quyền được cấp
                    </span>{' '}
                    <span className="admin-pill">{selected.userCount} người dùng đang gán</span>
                  </div>
                  {editable && (
                    <div className="admin-actions">
                      <Button
                        disabled={!dirty || busy}
                        startIcon={<Undo />}
                        onClick={() => {
                          setDraft(null);
                          setError(null);
                        }}
                      >
                        Hoàn tác
                      </Button>
                      <Button
                        variant="contained"
                        disabled={!dirty || busy}
                        startIcon={<SaveOutlined />}
                        onClick={mutate}
                      >
                        Lưu thay đổi
                      </Button>
                    </div>
                  )}
                </div>
                {dirty && (
                  <Alert severity="warning">Có thay đổi chưa được lưu. Chọn Lưu thay đổi để áp dụng.</Alert>
                )}
                {selected.name === 'USER' ? (
                  <Alert severity="info">
                    ADMIN có thể tùy chỉnh quyền của USER. Thay đổi áp dụng cho tất cả {selected.userCount}{' '}
                    tài khoản đang mang vai trò USER và các tài khoản đăng ký mới. Để cấp quyền riêng cho một
                    nhóm người dùng, hãy tạo và gán vai trò tùy chỉnh. USER là vai trò mặc định, không thể
                    xóa.
                  </Alert>
                ) : selected.systemRole ? (
                  <Alert severity="info">
                    ADMIN luôn có toàn quyền quản trị, không thể chỉnh sửa hoặc xóa vai trò này.
                  </Alert>
                ) : (
                  <Alert severity="info">
                    Quyền thao tác tự chọn quyền xem tương ứng. Gán vai trò và quản lý vai trò chỉ dành cho
                    ADMIN.
                  </Alert>
                )}
                <LoadState error={error} />
              </section>
              <section className="admin-card admin-permission-toolbar">
                <TextField
                  size="small"
                  label="Tìm quyền hoặc chức năng"
                  value={permissionQuery}
                  onChange={e => setPermissionQuery(e.target.value)}
                />
                <TextField
                  select
                  size="small"
                  label="Lọc quyền"
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                >
                  <MenuItem value="all">Tất cả</MenuItem>
                  <MenuItem value="granted">Đã cấp</MenuItem>
                  <MenuItem value="ungranted">Chưa cấp</MenuItem>
                </TextField>
                {editable && (
                  <Button
                    disabled={busy}
                    onClick={() => setDraft(state.catalog.filter(p => !p.adminOnly).map(p => p.code))}
                  >
                    Chọn tất cả
                  </Button>
                )}
              </section>
              <section className="admin-card admin-table-card">
                <div className="admin-table-scroll">
                  <table className="admin-table admin-permission-table">
                    <thead>
                      <tr>
                        <th>CHỨC NĂNG / TÀI NGUYÊN</th>
                        <th>XEM</th>
                        <th>TẠO</th>
                        <th>SỬA</th>
                        <th>XÓA</th>
                        <th>HÀNH ĐỘNG ĐẶC THÙ</th>
                      </tr>
                    </thead>
                    {Object.entries(groups).map(([group, resources]) => (
                      <tbody key={group}>
                        <tr className="admin-module-row">
                          <th colSpan={6}>{group}</th>
                        </tr>
                        {Object.entries(resources).map(([resource, items]) => (
                          <tr key={resource}>
                            <td>
                              <strong>{resource}</strong>
                            </td>
                            {['VIEW', 'CREATE', 'UPDATE', 'DELETE'].map(action => (
                              <td key={action}>{cell(items, action)}</td>
                            ))}
                            <td>
                              {items
                                .filter(p => p.action === 'SPECIAL')
                                .map(permission => (
                                  <label
                                    key={permission.code}
                                    className={`admin-special-permission ${permission.adminOnly ? 'protected' : ''}`}
                                  >
                                    <Checkbox
                                      size="small"
                                      checked={permissions.includes(permission.code)}
                                      disabled={!editable || busy || permission.adminOnly}
                                      onChange={e => check(permission, e.target.checked)}
                                      slotProps={{ input: { 'aria-label': permission.code } }}
                                    />
                                    {permission.label}
                                    {permission.adminOnly && ' (ADMIN)'}
                                  </label>
                                ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    ))}
                  </table>
                  {!Object.keys(groups).length && <div className="admin-empty">Không có quyền phù hợp.</div>}
                </div>
                <div className="admin-pagination">
                  <Button
                    startIcon={<Download />}
                    onClick={() =>
                      download(
                        `quyen-${selected.name}.json`,
                        JSON.stringify({ role: selected.name, permissions }, null, 2),
                        'application/json',
                      )
                    }
                  >
                    Tải ma trận quyền (JSON)
                  </Button>
                  {editable && (
                    <>
                      {!selected.systemRole && (
                        <Button
                          color="error"
                          startIcon={<DeleteOutlined />}
                          disabled={selected.userCount > 0 || busy}
                          onClick={() => {
                            setError(null);
                            setDialog('delete');
                          }}
                        >
                          Xóa vai trò
                        </Button>
                      )}
                      <Button variant="contained" disabled={!dirty || busy} onClick={mutate}>
                        Áp dụng thay đổi
                      </Button>
                    </>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      )}
      <Dialog open={Boolean(dialog)} onClose={() => !busy && setDialog(null)} fullWidth maxWidth="sm">
        <form
          onSubmit={
            dialog === 'discard'
              ? e => {
                  e.preventDefault();
                  setSelectedId(nextRole.id);
                  setDraft(null);
                  setDialog(null);
                  setError(null);
                }
              : mutate
          }
        >
          <DialogTitle>
            {dialog === 'create'
              ? 'Tạo vai trò tùy chỉnh'
              : dialog === 'delete'
                ? 'Xóa vai trò'
                : 'Thay đổi chưa được lưu'}
          </DialogTitle>
          <DialogContent className="admin-dialog-content">
            <LoadState error={error} />
            {dialog === 'create' ? (
              <>
                <TextField
                  autoFocus
                  required
                  label="Mã vai trò"
                  helperText="Chữ in hoa, số và dấu gạch dưới. Ví dụ: CONTENT_MANAGER"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value.toUpperCase() })}
                  slotProps={{ htmlInput: { pattern: '[A-Z][A-Z0-9_]{1,63}', maxLength: 64 } }}
                />
                <TextField
                  required
                  label="Tên hiển thị"
                  value={form.label}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
                <TextField
                  label="Mô tả"
                  multiline
                  rows={3}
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                />
              </>
            ) : dialog === 'delete' ? (
              <p>
                Xóa vai trò <strong>{selected?.name}</strong>? Chỉ có thể xóa vai trò chưa gán cho tài khoản.
              </p>
            ) : (
              <p>Bỏ các thay đổi chưa lưu và chuyển sang vai trò khác?</p>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialog(null)} disabled={busy}>
              Hủy
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy ? 'Đang lưu...' : dialog === 'discard' ? 'Bỏ thay đổi' : 'Xác nhận'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
