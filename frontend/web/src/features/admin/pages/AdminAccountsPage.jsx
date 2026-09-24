import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Pagination,
  TextField,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Download,
  PeopleOutlined,
  PersonAddAlt,
  LockOutlined,
  LockOpenOutlined,
  VisibilityOutlined,
  VpnKeyOutlined,
  Search,
  RestartAlt,
  VerifiedUserOutlined,
} from '@mui/icons-material';
import useAuth from '../../auth/hooks/useAuth';
import useToast from '../../../shared/hooks/useToast';
import { userApi } from '../../auth/api/userApi';
import { adminApi } from '../api/adminApi';
import { can, csvCell, date, download, initials, number } from '../utils/adminUtils';
import { PageHeading, StatCard, LoadState } from '../components/AdminUi';

const statuses = { ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa', DISABLED: 'Vô hiệu hóa' };
const emptyForm = { fullName: '', email: '', password: '' };

export default function AdminAccountsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') || '',
    role = params.get('role') || '',
    status = params.get('status') || '';
  const page = Math.max(0, Number(params.get('page')) || 0),
    size = [10, 20, 50].includes(Number(params.get('size'))) ? Number(params.get('size')) : 10;
  const [searchDraft, setSearchDraft] = useState({ source: keyword, value: keyword });
  const query = searchDraft.source === keyword ? searchDraft.value : keyword;
  const setQuery = value => setSearchDraft({ source: keyword, value });
  const [state, setState] = useState({ loading: true, data: null, roles: [], stats: null, error: null });
  const [retry, setRetry] = useState(0);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState(null);
  useEffect(() => {
    let active = true;
    Promise.all([
      userApi.adminListUsers({
        page,
        size,
        keyword: keyword || undefined,
        status: status || undefined,
        role: role || undefined,
      }),
      adminApi.roles(),
      adminApi.overview(),
    ])
      .then(([result, roles, stats]) => {
        if (active)
          setState({ loading: false, data: result.data, roles: roles.data, stats: stats.data, error: null });
      })
      .catch(error => {
        if (active) setState(s => ({ ...s, loading: false, error }));
      });
    return () => {
      active = false;
    };
  }, [page, size, keyword, role, status, retry]);
  function filter(values) {
    const next = new URLSearchParams(params);
    Object.entries({ page: '', create: '', ...values }).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setState(s => ({ ...s, loading: true }));
    setParams(next);
    setRetry(value => value + 1);
  }
  function open(type, target) {
    setMutationError(null);
    setModal({ type, target });
    setForm(target ? { ...emptyForm, fullName: target.fullName } : emptyForm);
    setSelectedRoles(target?.roles || []);
  }
  const showCreate = modal?.type === 'create' || (params.get('create') === '1' && can(user, 'USER_CREATE'));
  function close() {
    if (busy) return;
    setModal(null);
    setMutationError(null);
    setForm(emptyForm);
    if (params.has('create')) {
      const next = new URLSearchParams(params);
      next.delete('create');
      setParams(next, { replace: true });
    }
  }
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMutationError(null);
    try {
      if (showCreate) await userApi.adminCreateUser(form);
      else if (modal.type === 'roles') await userApi.adminUpdateRoles(modal.target.id, selectedRoles);
      else if (modal.type === 'status')
        await userApi.adminUpdateStatus(
          modal.target.id,
          modal.target.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE',
        );
      else await userApi.adminUpdateUser(modal.target.id, { fullName: form.fullName });
      toast('Đã lưu thay đổi tài khoản.');
      setModal(null);
      setForm(emptyForm);
      if (params.has('create')) {
        const next = new URLSearchParams(params);
        next.delete('create');
        setParams(next, { replace: true });
      }
      setRetry(r => r + 1);
    } catch (error) {
      setMutationError(error);
    } finally {
      setBusy(false);
    }
  }
  const rows = state.data?.content || [];
  function exportPage() {
    const values = [
      ['ID', 'Họ tên', 'Email', 'Vai trò', 'Trạng thái', 'Ngày tạo'],
      ...rows.map(row => [
        row.id,
        row.fullName,
        row.email,
        row.roles.join(', '),
        statuses[row.status],
        date(row.createdAt),
      ]),
    ];
    download('tai-khoan-trang-hien-tai.csv', values.map(row => row.map(csvCell).join(',')).join('\r\n'));
  }
  const roleLabel = code => state.roles.find(r => r.name === code)?.label || code;
  return (
    <>
      <PageHeading
        title="Quản lý tài khoản & người dùng"
        description="Quản lý danh sách học viên, thông tin tài khoản và quyền truy cập hệ thống."
      >
        <Button
          variant="outlined"
          startIcon={<Download />}
          disabled={!rows.length || state.loading}
          onClick={exportPage}
        >
          Xuất CSV trang này
        </Button>
        {can(user, 'USER_CREATE') && (
          <Button variant="contained" startIcon={<Add />} onClick={() => open('create')}>
            Thêm người dùng mới
          </Button>
        )}
      </PageHeading>
      <div className="admin-stats">
        <StatCard
          title="TỔNG TÀI KHOẢN"
          value={number(state.stats?.total)}
          detail="Tất cả tài khoản trong hệ thống"
          icon={<PeopleOutlined />}
        />
        <StatCard
          title="ĐANG HOẠT ĐỘNG"
          value={number(state.stats?.active)}
          detail="Tài khoản được phép đăng nhập"
          icon={<VerifiedUserOutlined />}
          tone="green"
        />
        <StatCard
          title="TÀI KHOẢN MỚI"
          value={number(state.stats?.newThisWeek)}
          detail="Được tạo trong 7 ngày gần nhất"
          icon={<PersonAddAlt />}
          tone="purple"
        />
        <StatCard
          title="TÀI KHOẢN BỊ KHÓA"
          value={number(state.stats?.locked)}
          detail={`${number(state.stats?.disabled)} tài khoản bị vô hiệu hóa`}
          icon={<LockOutlined />}
          tone="red"
        />
      </div>
      <section className="admin-card admin-filters">
        <form
          className="admin-filter-row"
          onSubmit={event => {
            event.preventDefault();
            filter({ q: query.trim() });
          }}
        >
          <TextField
            size="small"
            placeholder="Tìm theo tên, email..."
            aria-label="Tìm tài khoản"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
          <Button type="submit" variant="outlined" startIcon={<Search />}>
            Tìm
          </Button>
          <TextField
            select
            size="small"
            label="Vai trò"
            value={role}
            onChange={event => filter({ role: event.target.value })}
          >
            <MenuItem value="">Tất cả vai trò</MenuItem>
            {state.roles.map(r => (
              <MenuItem key={r.id} value={r.name}>
                {r.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Trạng thái"
            value={status}
            onChange={event => filter({ status: event.target.value })}
          >
            <MenuItem value="">Tất cả trạng thái</MenuItem>
            {Object.entries(statuses).map(([key, label]) => (
              <MenuItem key={key} value={key}>
                {label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            startIcon={<RestartAlt />}
            onClick={() => {
              setQuery('');
              filter({ q: '', role: '', status: '' });
            }}
          >
            Đặt lại bộ lọc
          </Button>
        </form>
        <div className="admin-filter-summary">
          <span>
            Đang lọc: <b>{keyword || 'Tất cả tài khoản'}</b>
            {role && <span className="admin-pill">{roleLabel(role)}</span>}
            {status && <span className="admin-pill">{statuses[status]}</span>}
          </span>
          <span>
            Tìm thấy <b>{number(state.data?.totalElements)}</b> kết quả phù hợp
          </span>
        </div>
      </section>
      <LoadState loading={state.loading} error={state.error} retry={() => setRetry(r => r + 1)} />
      {!state.loading && !state.error && (
        <section className="admin-card admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table admin-users-table">
              <thead>
                <tr>
                  <th>NGƯỜI DÙNG</th>
                  <th>VAI TRÒ</th>
                  <th>TRẠNG THÁI</th>
                  <th>NGÀY TẠO / ĐĂNG NHẬP GẦN NHẤT</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className={row.status !== 'ACTIVE' ? 'muted-row' : ''}>
                    <td>
                      <div className="admin-person">
                        <Avatar>{initials(row.fullName)}</Avatar>
                        <div>
                          <strong>{row.fullName}</strong>
                          <small>{row.email}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-role-badges">
                        {row.roles.map(code => (
                          <span key={code} className={`admin-pill ${code === 'ADMIN' ? 'purple' : ''}`}>
                            {roleLabel(code)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`admin-pill ${row.status === 'ACTIVE' ? 'green' : 'red'}`}>
                        ● {statuses[row.status]}
                      </span>
                    </td>
                    <td>
                      <span>{date(row.lastLoginAt)}</span>
                      <small>Ngày tạo: {date(row.createdAt)}</small>
                    </td>
                    <td>
                      <div className="admin-row-actions">
                        <Tooltip title="Xem / sửa thông tin">
                          <IconButton aria-label={`Xem ${row.fullName}`} onClick={() => open('detail', row)}>
                            <VisibilityOutlined fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {can(user, 'USER_STATUS_UPDATE') && (
                          <Tooltip title={row.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở tài khoản'}>
                            <span>
                              <IconButton
                                disabled={
                                  row.id === user.id ||
                                  (row.roles.includes('ADMIN') && !user.roles.includes('ADMIN'))
                                }
                                aria-label={`Đổi trạng thái ${row.fullName}`}
                                onClick={() => open('status', row)}
                              >
                                {row.status === 'ACTIVE' ? (
                                  <LockOutlined fontSize="small" />
                                ) : (
                                  <LockOpenOutlined fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                        {can(user, 'USER_ROLES_ASSIGN') && (
                          <Tooltip title="Gán vai trò">
                            <IconButton
                              aria-label={`Gán vai trò ${row.fullName}`}
                              onClick={() => open('roles', row)}
                            >
                              <VpnKeyOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="admin-empty">Không có tài khoản phù hợp. Hãy thử thay đổi bộ lọc.</div>
            )}
          </div>
          <div className="admin-pagination">
            <span>
              Hiển thị {rows.length ? page * size + 1 : 0}–{page * size + rows.length} /{' '}
              {number(state.data?.totalElements)} tài khoản
            </span>
            <TextField
              select
              size="small"
              label="Số dòng"
              value={size}
              onChange={event => filter({ size: event.target.value })}
            >
              {[10, 20, 50].map(value => (
                <MenuItem key={value} value={value}>
                  {value} dòng / trang
                </MenuItem>
              ))}
            </TextField>
            <Pagination
              page={page + 1}
              count={Math.max(1, state.data?.totalPages || 1)}
              onChange={(_, value) => filter({ page: value - 1 })}
              color="primary"
              shape="rounded"
            />
          </div>
        </section>
      )}
      <section className="admin-policy">
        <VerifiedUserOutlined />
        <div>
          <strong>Chính sách bảo mật & phân quyền tài khoản</strong>
          <p>
            Thay đổi trạng thái và vai trò được lưu trong nhật ký quản trị. Mỗi tài khoản được cấp quyền theo
            vai trò đã gán.
          </p>
        </div>
        {can(user, 'AUDIT_VIEW') && (
          <Button component={Link} to="/admin/audit" variant="outlined">
            Xem nhật ký
          </Button>
        )}
      </section>
      <Dialog open={Boolean(modal) || showCreate} onClose={close} fullWidth maxWidth="sm">
        <form onSubmit={save}>
          <DialogTitle>
            {showCreate
              ? 'Thêm người dùng mới'
              : modal?.type === 'roles'
                ? 'Gán vai trò tài khoản'
                : modal?.type === 'status'
                  ? 'Xác nhận thay đổi trạng thái'
                  : 'Thông tin tài khoản'}
          </DialogTitle>
          <DialogContent className="admin-dialog-content">
            <LoadState error={mutationError} />
            {showCreate ? (
              <>
                <TextField
                  autoFocus
                  required
                  label="Họ và tên"
                  value={form.fullName}
                  onChange={e => setForm({ ...form, fullName: e.target.value })}
                  slotProps={{ htmlInput: { maxLength: 100 } }}
                />
                <TextField
                  required
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  slotProps={{ htmlInput: { maxLength: 254 } }}
                />
                <TextField
                  required
                  label="Mật khẩu khởi tạo"
                  type="password"
                  autoComplete="new-password"
                  helperText="8–72 ký tự, có chữ hoa, chữ thường và số."
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  slotProps={{ htmlInput: { minLength: 8, maxLength: 72 } }}
                />
                <Alert severity="info">
                  Tài khoản mới có vai trò USER. Bạn có thể gán thêm vai trò sau khi tạo.
                </Alert>
              </>
            ) : modal?.type === 'roles' ? (
              <>
                <p>
                  {modal.target.fullName} · {modal.target.email}
                </p>
                {state.roles.map(r => (
                  <FormControlLabel
                    key={r.id}
                    control={
                      <Checkbox
                        checked={selectedRoles.includes(r.name)}
                        disabled={busy || (modal.target.id === user.id && r.name === 'ADMIN')}
                        onChange={e =>
                          setSelectedRoles(current =>
                            e.target.checked ? [...current, r.name] : current.filter(code => code !== r.name),
                          )
                        }
                      />
                    }
                    label={`${r.label} (${r.name})`}
                  />
                ))}
                <Alert severity="info">
                  Quyền ở các service khóa học, học tập và thanh toán cập nhật khi cấp access token mới.
                </Alert>
              </>
            ) : modal?.type === 'status' ? (
              <p>
                Bạn muốn {modal.target.status === 'ACTIVE' ? 'khóa' : 'mở lại'} tài khoản{' '}
                <strong>{modal.target.email}</strong>?
              </p>
            ) : (
              modal && (
                <>
                  <TextField
                    label="Họ tên"
                    required
                    value={form.fullName}
                    onChange={e => setForm({ ...form, fullName: e.target.value })}
                    disabled={!can(user, 'USER_UPDATE')}
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                  />
                  <TextField label="Email" value={modal.target.email} disabled />
                  <p>
                    ID: {modal.target.id}
                    <br />
                    Ngày tạo: {date(modal.target.createdAt)}
                    <br />
                    Đăng nhập gần nhất: {date(modal.target.lastLoginAt)}
                  </p>
                </>
              )
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={close} disabled={busy}>
              Đóng
            </Button>
            {(showCreate || modal?.type !== 'detail' || can(user, 'USER_UPDATE')) && (
              <Button
                variant="contained"
                type="submit"
                disabled={busy || (modal?.type === 'roles' && !selectedRoles.length)}
              >
                {busy ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            )}
          </DialogActions>
        </form>
      </Dialog>
    </>
  );
}
