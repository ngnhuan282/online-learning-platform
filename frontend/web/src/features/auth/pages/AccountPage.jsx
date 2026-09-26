import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { userApi } from '../api/userApi';
import { AUTH_CHANGED_EVENT } from '../../../shared/constants/appConstants';
import Icon from '../../../shared/components/Icon';
import StatusChip from '../../../shared/components/StatusChip';

export default function AccountPage({ admin = false }) {
  const { user } = useAuth();

  // Profile Form State
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const isAdmin = user?.roles?.includes('ADMIN');

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileSuccess('');
    setProfileError('');
    if (!fullName.trim()) {
      setProfileError('Họ và tên không được để trống.');
      return;
    }
    setProfileLoading(true);
    try {
      await userApi.updateProfile({ fullName: fullName.trim() });
      setProfileSuccess('Cập nhật thông tin tài khoản thành công!');
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Không thể cập nhật hồ sơ.';
      setProfileError(msg);
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(newPassword)) {
      setPasswordError('Mật khẩu mới phải chứa cả chữ hoa, chữ thường và số.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setPasswordLoading(true);
    try {
      await userApi.changePassword({
        currentPassword,
        newPassword,
      });
      setPasswordSuccess('Đổi mật khẩu thành công! Vui lòng ghi nhớ mật khẩu mới.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const code = err.response?.data?.code;
      const msg =
        code === 'OLD_PASSWORD_INCORRECT'
          ? 'Mật khẩu hiện tại không chính xác. Vui lòng kiểm tra lại.'
          : err.response?.data?.message || err.message || 'Không thể đổi mật khẩu.';
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <section className="container section" style={{ padding: '32px 0 80px' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Header Section */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <span className="eyebrow">{isAdmin ? 'QUẢN TRỊ VIÊN' : 'THÔNG TIN CÁ NHÂN'}</span>
            <h1 style={{ marginTop: 8, fontSize: '1.875rem' }}>Hồ sơ cá nhân</h1>
            <p style={{ color: 'var(--muted)', marginTop: 4 }}>
              Quản lý thông tin hồ sơ cá nhân và bảo mật tài khoản.
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <Link className="button button-soft" to="/payment/history">
              <Icon name="assignment" size={15} /> Lịch sử thanh toán
            </Link>
            <Link className="button button-outline" to="/">
              <Icon name="arrow" size={14} style={{ transform: 'rotate(180deg)', marginRight: 6 }} /> Về trang
              chủ
            </Link>
          </div>
        </div>

        {/* Admin Quick Navigation if Admin */}
        {isAdmin && (
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              color: '#fff',
              borderRadius: 'var(--radius)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: 'var(--shadow)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🛡️</span>
              <strong style={{ fontSize: 17, color: '#fff' }}>Bảng điều khiển Quản trị viên</strong>
            </div>
            <p style={{ color: '#cbd5e1', fontSize: 14, margin: 0 }}>
              Bạn có quyền Quản trị viên hệ thống. Truy cập nhanh các tính năng quản trị:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <Link className="button button-primary" to="/admin/users" style={{ background: '#3b82f6' }}>
                👥 Quản lý người dùng
              </Link>
              <Link
                className="button button-outline"
                to="/admin/courses"
                style={{ color: '#fff', borderColor: '#475569' }}
              >
                📚 Quản lý khóa học
              </Link>
              <Link
                className="button button-outline"
                to="/admin/analytics"
                style={{ color: '#fff', borderColor: '#475569' }}
              >
                📊 Thống kê thanh toán
              </Link>
            </div>
          </div>
        )}

        {/* User Card Info */}
        <div
          style={{
            background: 'var(--canvas)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {user?.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ fontSize: 20, margin: 0, fontWeight: 700 }}>{user?.fullName || 'Người dùng'}</h2>
            <p style={{ color: 'var(--muted)', margin: '4px 0 8px', fontSize: 14 }}>{user?.email}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <StatusChip
                status={user?.status || 'ACTIVE'}
                label={user?.status === 'LOCKED' ? 'Bị khóa' : 'Đang hoạt động'}
              />
              {user?.roles?.map(role => (
                <span
                  key={role}
                  style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontWeight: 600,
                    background: role === 'ADMIN' ? '#e0e7ff' : '#f1f5f9',
                    color: role === 'ADMIN' ? '#4338ca' : '#475569',
                  }}
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Grid 2 Forms: Profile & Change Password */}
        <div
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}
        >
          {/* Card 1: Cập nhật thông tin */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 24,
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Cập nhật hồ sơ</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                Thay đổi tên hiển thị của bạn trên hệ thống.
              </p>
            </div>

            {profileSuccess && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#ecfdf5',
                  color: '#065f46',
                  fontSize: 13,
                }}
              >
                ✓ {profileSuccess}
              </div>
            )}
            {profileError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#fef2f2',
                  color: '#991b1b',
                  fontSize: 13,
                }}
              >
                ✕ {profileError}
              </div>
            )}

            <form
              onSubmit={handleProfileSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Email đăng ký (Read-only)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: '#f8fafc',
                    color: '#64748b',
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Họ và tên
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="Nhập họ và tên đầy đủ"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 14,
                  }}
                />
              </div>

              <button
                type="submit"
                className="button button-primary"
                disabled={profileLoading || !fullName.trim()}
                style={{ marginTop: 8 }}
              >
                {profileLoading ? 'Đang lưu...' : 'Lưu thông tin'}
              </button>
            </form>
          </div>

          {/* Card 2: Đổi mật khẩu */}
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 24,
              boxShadow: 'var(--shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Đổi mật khẩu</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
                Bảo vệ tài khoản với mật khẩu tối thiểu 8 ký tự.
              </p>
            </div>

            {passwordSuccess && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#ecfdf5',
                  color: '#065f46',
                  fontSize: 13,
                }}
              >
                ✓ {passwordSuccess}
              </div>
            )}
            {passwordError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: '#fef2f2',
                  color: '#991b1b',
                  fontSize: 13,
                }}
              >
                ✕ {passwordError}
              </div>
            )}

            <form
              onSubmit={handlePasswordSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Mật khẩu hiện tại
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    required
                    placeholder="Mật khẩu đang dùng"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: 14,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      padding: 4,
                      fontSize: 12,
                    }}
                  >
                    {showCurrentPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Mật khẩu mới
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="Tối thiểu 8 ký tự, gồm HOA, thường, số"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      fontSize: 14,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      padding: 4,
                      fontSize: 12,
                    }}
                  >
                    {showNewPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    fontSize: 14,
                  }}
                />
              </div>

              <button
                type="submit"
                className="button button-primary"
                disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                style={{ marginTop: 8 }}
              >
                {passwordLoading ? 'Đang đổi...' : 'Đổi mật khẩu'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
