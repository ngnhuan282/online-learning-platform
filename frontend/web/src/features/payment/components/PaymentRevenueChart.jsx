import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { money } from '../../admin/utils/adminUtils';

export default function PaymentRevenueChart({ data, loading, unavailable }) {
  useLocale();
  if (loading)
    return (
      <div className="payment-chart-state" role="status">
        {t('Đang tải doanh thu…')}
      </div>
    );
  if (unavailable) {
    return (
      <div className="payment-chart-state" role="status">
        {t('Chưa tải được doanh thu. Hãy làm mới dữ liệu.')}
      </div>
    );
  }
  if (!data?.length) return <div className="payment-chart-state">{t('Chưa có dữ liệu doanh thu.')}</div>;

  const maximum = Math.max(1, ...data.map(point => Number(point.amount)));
  const hasRevenue = data.some(point => Number(point.amount) > 0);
  return (
    <>
      <div
        className="payment-revenue-chart"
        role="region"
        aria-label={t('Doanh thu thanh toán theo ngày')}
        tabIndex={0}
      >
        <div className="payment-revenue-axis" aria-hidden="true">
          <span>{money(maximum === 1 ? 0 : maximum)}</span>
          <span>{money(maximum === 1 ? 0 : maximum / 2)}</span>
          <span>0 ₫</span>
        </div>
        <div className="payment-revenue-columns">
          {data.map((point, index) => (
            <div className="payment-revenue-column" key={point.label}>
              <div className="payment-revenue-track">
                <div
                  className={`payment-revenue-fill${index === data.length - 1 ? ' is-current' : ''}`}
                  style={{ height: `${(Number(point.amount) / maximum) * 100}%` }}
                  title={`${point.label}: ${money(point.amount)}`}
                />
              </div>
              <span>{t(point.label)}</span>
            </div>
          ))}
        </div>
      </div>
      {!hasRevenue && (
        <p className="payment-chart-empty">{t('Chưa có thanh toán thành công trong khoảng này.')}</p>
      )}
      <details className="payment-chart-data">
        <summary>{t('Xem số liệu theo ngày')}</summary>
        <table>
          <caption>{t('Doanh thu theo ngày thanh toán, múi giờ UTC')}</caption>
          <thead>
            <tr>
              <th>{t('Ngày')}</th>
              <th>Doanh thu</th>
              <th>{t('Giao dịch tạo mới')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(point => (
              <tr key={point.label}>
                <th>{t(point.label)}</th>
                <td>{money(point.amount)}</td>
                <td>{point.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
