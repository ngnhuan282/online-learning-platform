import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { userApi } from '../api/userApi';
import Icon from '../../../shared/components/Icon';
import StatusChip from '../../../shared/components/StatusChip';
import SignInMethods from '../components/SignInMethods';
import { can } from '../../admin/utils/adminUtils';
import ProfileAppearance from '../../shop/components/ProfileAppearance';
import ProMembershipCard from '../../pro/components/ProMembershipCard';

export default function AccountPage() {
  useLocale();
  const { user, updateCurrentUser } = useAuth();

  const [fullName, setFullName] = useState(user?.fullName || '');
  const [profile, setProfile] = useState({
    avatarUrl: user?.avatarUrl || '',
    phone: user?.phone || '',
    dateOfBirth: user?.dateOfBirth || '',
    biography: user?.biography || '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [methods, setMethods] = useState(null);

  const hasAdminAccess = can(user, 'ADMIN_ACCESS');

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
      const result = await userApi.updateProfile({
        fullName: fullName.trim(),
        ...profile,
        dateOfBirth: profile.dateOfBirth || null,
      });
      updateCurrentUser(result.data);
      setProfileSuccess('Cập nhật thông tin tài khoản thành công!');
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
    <section className="account-page">
      <div className="container account-shell">
        <div className="account-header">
          <div>
            <span className="eyebrow">
              {hasAdminAccess ? t('KHÔNG GIAN QUẢN TRỊ') : t('THÔNG TIN CÁ NHÂN')}
            </span>
            <h1>{t('Hồ sơ cá nhân')}</h1>
            <p>{t('Quản lý thông tin hồ sơ cá nhân và bảo mật tài khoản.')}</p>
          </div>
          <div className="account-header-actions">
            <Link className="button button-soft" to="/payment/history">
              <Icon name="assignment" size={16} /> {t('Lịch sử thanh toán')}
            </Link>
            <Link className="button button-outline" to="/">
              {t('Về trang chủ')}
            </Link>
          </div>
        </div>

        <ProfileAppearance />
        <ProMembershipCard />

        {hasAdminAccess && (
          <div className="account-admin-card">
            <strong>{t('Bảng điều khiển Quản trị viên')}</strong>
            <p>{t('Truy cập nhanh các tính năng quản trị bạn được cấp quyền:')}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {can(user, 'USER_VIEW') && (
                <Link className="button button-primary" to="/admin/users">
                  {t('Quản lý người dùng')}
                </Link>
              )}
              {can(user, 'COURSE_VIEW') && (
                <Link className="button button-soft" to="/admin/courses">
                  {t('Quản lý khóa học')}
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="account-identity-card">
          <div className="account-identity-avatar">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={t('Ảnh đại diện')} referrerPolicy="no-referrer" />
            ) : user?.fullName ? (
              user.fullName.charAt(0).toUpperCase()
            ) : (
              'U'
            )}
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800 }}>{user?.fullName || t('Người dùng')}</h2>
            <p style={{ color: 'var(--muted)', margin: '4px 0 10px', fontSize: 14 }}>{user?.email}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <StatusChip
                status={user?.status || 'ACTIVE'}
                label={user?.status === 'LOCKED' ? t('Bị khóa') : t('Đang hoạt động')}
              />
              {user?.roles?.map(role => (
                <span key={role} className={`account-role-pill ${role === 'ADMIN' ? 'is-admin' : ''}`}>
                  {role}
                </span>
              ))}
            </div>
          </div>
        </div>

        <SignInMethods onStatus={setMethods} />

        <div className="account-forms-grid">
          <div className="account-form-card">
            <div>
              <h3>{t('Cập nhật hồ sơ')}</h3>
              <p>{t('Cập nhật thông tin cá nhân và liên hệ của bạn.')}</p>
            </div>

            {profileSuccess && <div className="account-feedback is-success">✓ {profileSuccess}</div>}
            {profileError && <div className="account-feedback is-error">✕ {profileError}</div>}

            <form
              onSubmit={handleProfileSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <label className="account-field-label">
                {t('Email đăng ký (Read-only)')}
                <input className="account-input" type="email" disabled value={user?.email || ''} />
              </label>

              <label className="account-field-label">
                {t('Họ và tên')}
                <input
                  className="account-input"
                  type="text"
                  required
                  maxLength={100}
                  placeholder={t('Nhập họ và tên đầy đủ')}
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </label>

              {[
                ['avatarUrl', 'URL ảnh đại diện', 'url', 500],
                ['phone', 'Số điện thoại', 'tel', 25],
                ['dateOfBirth', 'Ngày sinh', 'date'],
              ].map(([field, label, type, maxLength]) => (
                <label key={field} className="account-field-label">
                  {t(label)}
                  <input
                    className="account-input"
                    name={field}
                    type={type}
                    value={profile[field]}
                    maxLength={maxLength}
                    max={type === 'date' ? new Date().toLocaleDateString('en-CA') : undefined}
                    onChange={event => setProfile(previous => ({ ...previous, [field]: event.target.value }))}
                  />
                </label>
              ))}

              <label className="account-field-label">
                {t('Giới thiệu bản thân')}
                <textarea
                  className="account-input"
                  name="biography"
                  rows={4}
                  maxLength={1000}
                  value={profile.biography}
                  onChange={event => setProfile(previous => ({ ...previous, biography: event.target.value }))}
                  style={{ resize: 'vertical', minHeight: 96 }}
                />
              </label>

              <button
                type="submit"
                className="button button-primary"
                disabled={profileLoading || !fullName.trim()}
                style={{ marginTop: 6 }}
              >
                {profileLoading ? t('Đang lưu...') : t('Lưu thông tin')}
              </button>
            </form>
          </div>

          {methods?.passwordEnabled !== false && (
            <div className="account-form-card">
              <div>
                <h3>{t('Đổi mật khẩu')}</h3>
                <p>{t('Bảo vệ tài khoản với mật khẩu tối thiểu 8 ký tự.')}</p>
              </div>

              {passwordSuccess && <div className="account-feedback is-success">✓ {passwordSuccess}</div>}
              {passwordError && <div className="account-feedback is-error">✕ {passwordError}</div>}

              <form
                onSubmit={handlePasswordSubmit}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <label className="account-field-label">
                  {t('Mật khẩu hiện tại')}
                  <div className="account-pw-wrap">
                    <input
                      className="account-input"
                      type={showCurrentPassword ? 'text' : 'password'}
                      required
                      placeholder={t('Mật khẩu đang dùng')}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="account-pw-toggle"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? t('Ẩn') : t('Hiện')}
                    </button>
                  </div>
                </label>

                <label className="account-field-label">
                  {t('Mật khẩu mới')}
                  <div className="account-pw-wrap">
                    <input
                      className="account-input"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder={t('Tối thiểu 8 ký tự, gồm HOA, thường, số')}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="account-pw-toggle"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? t('Ẩn') : t('Hiện')}
                    </button>
                  </div>
                </label>

                <label className="account-field-label">
                  {t('Xác nhận mật khẩu mới')}
                  <input
                    className="account-input"
                    type="password"
                    required
                    placeholder={t('Nhập lại mật khẩu mới')}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </label>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={passwordLoading || !currentPassword || !newPassword || !confirmPassword}
                  style={{ marginTop: 6 }}
                >
                  {passwordLoading ? t('Đang đổi...') : t('Đổi mật khẩu')}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
