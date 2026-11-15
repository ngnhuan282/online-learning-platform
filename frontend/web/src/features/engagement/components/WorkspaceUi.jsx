import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import '../styles/community.css';

export function Pagination({ page, totalPages, onChange, disabled }) {
  useLocale();
  if (totalPages <= 1) return null;
  return (
    <nav
      className="workspace-pagination"
      aria-label={t('Trang {page} / {total}', { page: page + 1, total: totalPages })}
    >
      <button
        className="button button-outline"
        disabled={disabled || page <= 0}
        onClick={() => onChange(page - 1)}
      >
        {t('Trước')}
      </button>
      <span>{t('Trang {page} / {total}', { page: page + 1, total: totalPages })}</span>
      <button
        className="button button-outline"
        disabled={disabled || page + 1 >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        {t('Sau')}
      </button>
    </nav>
  );
}

export function ActionError({ error }) {
  useLocale();
  if (!error) return null;
  const messages = {
    INSUFFICIENT_GEMS: 'Bạn chưa có đủ kim cương để mua vật phẩm này.',
    INVENTORY_FULL: 'Kho streak freeze đã đầy. Bạn có thể giữ tối đa 7 lượt.',
    RATE_LIMITED: 'Vui lòng chờ trước khi đăng tiếp.',
    CONFLICT: 'Nội dung đã thay đổi hoặc không còn có thể chỉnh sửa. Hãy tải lại.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    NOT_FOUND: 'Không tìm thấy nội dung.',
  };
  return (
    <p className="workspace-error" role="alert">
      {t(messages[error.code] || 'Không thể thực hiện thao tác. Vui lòng thử lại.')}
    </p>
  );
}

export function WorkspaceState({ loading, error, retry }) {
  useLocale();
  if (loading) return <p role="status">{t('Đang tải...')}</p>;
  if (!error) return null;
  return (
    <div role="alert" className="workspace-error">
      <p>{t('Không thể tải dữ liệu')}</p>
      <button className="button button-outline" onClick={retry}>
        {t('Thử lại')}
      </button>
    </div>
  );
}
