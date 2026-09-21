import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { userApi } from '../api/userApi';
import { formatDate } from '../../../shared/utils/formatDate';
import StatusChip from '../../../shared/components/StatusChip';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import ErrorState from '../../../shared/components/ErrorState';
import EmptyState from '../../../shared/components/EmptyState';
import Icon from '../../../shared/components/Icon';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [pageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);

  // Dialog Action State
  const [dialogState, setDialogState] = useState({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Xác nhận',
    destructive: false,
    onConfirm: () => {},
  });
  const [actionPending, setActionPending] = useState(false);
  const [actionNotice, setActionNotice] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadUsers() {
      setLoading(true);
      setError(null);
      try {
        const params = {
          page,
          size: pageSize,
        };
        if (searchQuery.trim()) params.keyword = searchQuery.trim();
        if (statusFilter) params.status = statusFilter;

        const response = await userApi.adminListUsers(params, { signal: controller.signal });
        const data = response?.data?.data || response?.data || response;
        const items = data?.content || [];

        if (isMounted) {
          setUsers(items);
          setTotalPages(data?.totalPages || 1);
          setTotalElements(data?.totalElements || items.length);
        }
      } catch (err) {
        if (isMounted && err.name !== 'CanceledError' && err.code !== 'ERR_CANCELED') {
          setError(err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadUsers();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [page, pageSize, searchQuery, statusFilter, retryCount]);

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(0);
    setSearchQuery(keyword);
  }

  function handleResetFilters() {
    setKeyword('');
    setSearchQuery('');
    setStatusFilter('');
    setPage(0);
  }

  // Statistics
  const stats = useMemo(() => {
    const activeCount = users.filter(u => u.status === 'ACTIVE').length;
    const lockedCount = users.filter(u => u.status === 'LOCKED').length;
    const adminCount = users.filter(u => u.roles?.includes('ADMIN')).length;
    return {
      total: totalElements,
      active: activeCount,
      locked: lockedCount,
      admins: adminCount,
    };
  }, [users, totalElements]);

  // Lock / Unlock Handler
  function promptToggleStatus(targetUser) {
    const isLocking = targetUser.status === 'ACTIVE';
    const nextStatus = isLocking ? 'LOCKED' : 'ACTIVE';

    setDialogState({
      open: true,
      title: isLocking ? 'Khóa tài khoản' : 'Mở khóa tài khoản',
      description: isLocking
        ? `Bạn có chắc chắn muốn khóa tài khoản của ${targetUser.fullName} (${targetUser.email})? Người dùng này sẽ không thể đăng nhập cho đến khi được mở khóa.`
        : `Bạn có muốn mở khóa tài khoản cho ${targetUser.fullName} (${targetUser.email})?`,
      confirmLabel: isLocking ? 'Khóa tài khoản' : 'Mở khóa',
      destructive: isLocking,
      onConfirm: async () => {
        setActionPending(true);
        setActionNotice(null);
        try {
          await userApi.adminUpdateStatus(targetUser.id, nextStatus);
          setActionNotice({
            type: 'success',
            message: `Đã ${isLocking ? 'khóa' : 'mở khóa'} tài khoản ${targetUser.fullName} thành công.`,
          });
          setUsers(prev =>
            prev.map(u => (u.id === targetUser.id ? { ...u, status: nextStatus } : u)),
          );
          setDialogState(prev => ({ ...prev, open: false }));
        } catch (err) {
          setActionNotice({
            type: 'error',
            message: err.response?.data?.message || err.message || 'Thao tác thất bại.',
          });
        } finally {
          setActionPending(false);
        }
      },
    });
  }

  // Update Roles Handler
  function promptToggleAdminRole(targetUser) {
    const hasAdmin = targetUser.roles?.includes('ADMIN');
    const newRoles = hasAdmin ? ['USER'] : ['USER', 'ADMIN'];

    setDialogState({
      open: true,
      title: hasAdmin ? 'Hạ quyền Quản trị viên' : 'Cấp quyền Quản trị viên',
      description: hasAdmin
        ? `Bạn có chắc chắn muốn gỡ quyền ADMIN khỏi tài khoản của ${targetUser.fullName}? Người này sẽ trở thành người dùng bình thường (USER).`
        : `Cấp quyền ADMIN cho ${targetUser.fullName} (${targetUser.email})? Người này sẽ có toàn quyền quản lý hệ thống.`,
      confirmLabel: hasAdmin ? 'Hạ quyền' : 'Cấp quyền',
      destructive: hasAdmin,
      onConfirm: async () => {
        setActionPending(true);
        setActionNotice(null);
        try {
          await userApi.adminUpdateRoles(targetUser.id, newRoles);
          setActionNotice({
            type: 'success',
            message: `Đã cập nhật vai trò cho ${targetUser.fullName} thành công.`,
          });
          setUsers(prev =>
            prev.map(u => (u.id === targetUser.id ? { ...u, roles: newRoles } : u)),
          );
          setDialogState(prev => ({ ...prev, open: false }));
        } catch (err) {
          setActionNotice({
            type: 'error',
            message: err.response?.data?.message || err.message || 'Thao tác thất bại.',
          });
        } finally {
          setActionPending(false);
        }
      },
    });
  }

  return (
    <section className="container section" style={{ padding: '32px 0 80px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <span className="eyebrow">QUẢN TRỊ VIÊN</span>
            <h1 style={{ marginTop: 8, fontSize: '1.875rem' }}>Quản lý người dùng</h1>
            <p style={{ color: 'var(--muted)', marginTop: 4 }}>
              Xem danh sách tài khoản, tìm kiếm, phân quyền và khóa/mở khóa tài khoản học viên.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link className="button button-outline" to="/account">
              <Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)', marginRight: 6 }} /> Về hồ sơ
            </Link>
            <Link className="button button-soft" to="/admin/courses">
              Khóa học
            </Link>
            <Link className="button button-soft" to="/admin/analytics">
              Thống kê
            </Link>
          </div>
        </div>

        {/* Global Action Banner */}
        {actionNotice && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: actionNotice.type === 'success' ? '#ecfdf5' : '#fef2f2',
              color: actionNotice.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${actionNotice.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{actionNotice.message}</span>
            <button
              onClick={() => setActionNotice(null)}
              style={{ background: 'none', border: 'none', color: 'inherit', fontWeight: 600 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Statistics Cards */}
        <div className="course-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div className="course-card" style={{ padding: 20 }}>
            <small style={{ color: 'var(--muted)' }}>Tổng tài khoản</small>
            <h3 style={{ fontSize: 26, margin: '6px 0', color: 'var(--text)' }}>{stats.total}</h3>
            <span style={{ fontSize: 12, color: '#3b82f6' }}>Toàn hệ thống</span>
          </div>
          <div className="course-card" style={{ padding: 20 }}>
            <small style={{ color: 'var(--muted)' }}>Đang hoạt động (Trang này)</small>
            <h3 style={{ fontSize: 26, margin: '6px 0', color: '#16a34a' }}>{stats.active}</h3>
            <span style={{ fontSize: 12, color: '#16a34a' }}>User Status: ACTIVE</span>
          </div>
          <div className="course-card" style={{ padding: 20 }}>
            <small style={{ color: 'var(--muted)' }}>Bị khóa (Trang này)</small>
            <h3 style={{ fontSize: 26, margin: '6px 0', color: '#dc2626' }}>{stats.locked}</h3>
            <span style={{ fontSize: 12, color: '#dc2626' }}>User Status: LOCKED</span>
          </div>
          <div className="course-card" style={{ padding: 20 }}>
            <small style={{ color: 'var(--muted)' }}>Quản trị viên (Trang này)</small>
            <h3 style={{ fontSize: 26, margin: '6px 0', color: '#6366f1' }}>{stats.admins}</h3>
            <span style={{ fontSize: 12, color: '#6366f1' }}>Role: ADMIN</span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '16px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 'var(--shadow)',
          }}
        >
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, flex: 1, minWidth: 260 }}>
            <input
              type="text"
              placeholder="Tìm theo họ tên hoặc email..."
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 14,
              }}
            />
            <button type="submit" className="button button-primary" style={{ padding: '9px 18px' }}>
              <Icon name="search" size={15} style={{ marginRight: 4 }} /> Tìm kiếm
            </button>
          </form>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              aria-label="Lọc theo trạng thái"
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(0);
              }}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: '#fff',
                fontSize: 14,
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ACTIVE">ACTIVE (Hoạt động)</option>
              <option value="LOCKED">LOCKED (Đang khóa)</option>
            </select>

            {(searchQuery || statusFilter) && (
              <button
                type="button"
                className="button button-soft"
                onClick={handleResetFilters}
                style={{ padding: '9px 14px', fontSize: 13 }}
              >
                Đặt lại
              </button>
            )}

            <button
              type="button"
              className="button button-outline"
              onClick={() => setRetryCount(v => v + 1)}
              style={{ padding: '9px 14px' }}
              title="Tải lại dữ liệu"
            >
              Tải lại
            </button>
          </div>
        </div>

        {/* Content Section: Table / Loading / Error / Empty */}
        {error ? (
          <ErrorState error={error} onRetry={() => setRetryCount(v => v + 1)} />
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)' }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>⌛</div>
            <p>Đang tải danh sách người dùng...</p>
          </div>
        ) : users.length === 0 ? (
          <EmptyState
            title="Không tìm thấy người dùng nào"
            description="Hãy thử đổi từ khóa tìm kiếm hoặc bỏ bộ lọc trạng thái."
            action={
              (searchQuery || statusFilter) && (
                <button className="button button-primary" onClick={handleResetFilters}>
                  Xóa bộ lọc
                </button>
              )
            }
          />
        ) : (
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              overflowX: 'auto',
              boxShadow: 'var(--shadow)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--canvas)' }}>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--muted)', width: 60 }}>#ID</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--muted)' }}>Người dùng</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--muted)' }}>Trạng thái</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--muted)' }}>Vai trò</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--muted)' }}>Ngày tạo</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--muted)', textAlign: 'right' }}>
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const isSelf = String(u.id) === String(currentUser?.id);
                  const isLocked = u.status === 'LOCKED';
                  const isUserAdmin = u.roles?.includes('ADMIN');

                  return (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        background: isSelf ? '#f0fdf4' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '16px 20px', color: 'var(--muted)' }}>{u.id}</td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              background: isUserAdmin ? '#e0e7ff' : '#f1f5f9',
                              color: isUserAdmin ? '#4338ca' : '#475569',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: 15,
                            }}
                          >
                            {u.fullName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                              {u.fullName}{' '}
                              {isSelf && (
                                <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700 }}>(Bạn)</span>
                              )}
                            </div>
                            <div style={{ color: 'var(--muted)', fontSize: 13 }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <StatusChip
                          status={u.status}
                          label={isLocked ? 'Bị khóa' : 'Hoạt động'}
                        />
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {u.roles?.map(r => (
                            <span
                              key={r}
                              style={{
                                fontSize: 12,
                                padding: '2px 8px',
                                borderRadius: 999,
                                fontWeight: 600,
                                background: r === 'ADMIN' ? '#e0e7ff' : '#f1f5f9',
                                color: r === 'ADMIN' ? '#4338ca' : '#475569',
                              }}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '16px 20px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        {formatDate(u.createdAt, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 8 }}>
                          {/* Nút Khóa / Mở khóa */}
                          <button
                            type="button"
                            className={`button ${isLocked ? 'button-outline' : 'button-soft'}`}
                            disabled={isSelf}
                            title={isSelf ? 'Không thể tự khóa tài khoản của bạn' : undefined}
                            onClick={() => promptToggleStatus(u)}
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              color: isLocked ? '#16a34a' : '#dc2626',
                              borderColor: isLocked ? '#86efac' : undefined,
                            }}
                          >
                            {isLocked ? 'Mở khóa' : 'Khóa'}
                          </button>

                          {/* Nút Phân quyền */}
                          <button
                            type="button"
                            className="button button-soft"
                            disabled={isSelf && isUserAdmin}
                            title={isSelf && isUserAdmin ? 'Không thể tự thu hồi quyền Admin' : undefined}
                            onClick={() => promptToggleAdminRole(u)}
                            style={{ padding: '6px 12px', fontSize: 12 }}
                          >
                            {isUserAdmin ? 'Gỡ Admin' : 'Cấp Admin'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination footer */}
            <div
              style={{
                padding: '14px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--canvas)',
                borderTop: '1px solid var(--border)',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                Hiển thị {users.length} trên tổng số {totalElements} tài khoản
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  type="button"
                  className="button button-outline"
                  disabled={page <= 0}
                  onClick={() => setPage(p => Math.max(p - 1, 0))}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                >
                  Trang trước
                </button>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  className="button button-outline"
                  disabled={page + 1 >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  style={{ padding: '6px 12px', fontSize: 13 }}
                >
                  Trang sau
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal Dialog */}
        <ConfirmDialog
          open={dialogState.open}
          title={dialogState.title}
          description={dialogState.description}
          confirmLabel={dialogState.confirmLabel}
          destructive={dialogState.destructive}
          pending={actionPending}
          onConfirm={dialogState.onConfirm}
          onClose={() => setDialogState(prev => ({ ...prev, open: false }))}
        />
      </div>
    </section>
  );
}
