import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
export default function LearningNotice({ error, usingFallback }) {
  useLocale();
  if (!usingFallback && !error) return null;

  return (
    <div className="learning-notice" role="status">
      <strong>{usingFallback ? t('Đang hiển thị dữ liệu mẫu.') : t('Không thể tải dữ liệu học tập.')}</strong>
      <span>{error?.message || t('Learning Service chưa trả dữ liệu cho màn hình này.')}</span>
    </div>
  );
}
