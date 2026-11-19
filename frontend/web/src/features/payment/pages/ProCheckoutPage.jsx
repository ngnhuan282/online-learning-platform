import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { paymentApi } from '../api/paymentApi';
import { proApi } from '../../pro/api/proApi';
import { getCheckoutErrorMessage, readCheckoutRedirect } from '../utils/paymentFlow';
import { WorkspacePremiumOutlined } from '@mui/icons-material';
import '../styles/payment.css';

const planNameMap = {
  PRO_MONTH: '1 tháng',
  PRO_QUARTER: '3 tháng',
  PRO_YEAR: '1 năm (12 tháng)',
};

export default function ProCheckoutPage() {
  useLocale();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const planCode = params.get('plan') || 'PRO_YEAR';
  const idempotencyKey = useRef(crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [planState, setPlanState] = useState({ loading: true, plans: [], error: null });
  const [planRetry, setPlanRetry] = useState(0);

  const [methodState, setMethodState] = useState({ loading: true, methods: [], error: null });
  const [methodRetry, setMethodRetry] = useState(0);
  const [provider, setProvider] = useState('MOCK');

  useEffect(() => {
    let active = true;
    proApi
      .plans()
      .then(response => {
        if (!active) return;
        if (!Array.isArray(response.data)) {
          throw new Error('Không thể tải danh sách gói Pro.');
        }
        setPlanState({ loading: false, plans: response.data, error: null });
      })
      .catch(fetchError => {
        if (active) {
          setPlanState({ loading: false, plans: [], error: fetchError });
        }
      });
    return () => {
      active = false;
    };
  }, [planRetry]);

  useEffect(() => {
    let active = true;
    paymentApi
      .getMethods()
      .then(response => {
        if (!active) return;
        if (!Array.isArray(response.data)) {
          throw new Error('Không thể tải phương thức thanh toán. Vui lòng thử lại.');
        }
        setMethodState({ loading: false, methods: response.data, error: null });
        setProvider(
          current =>
            response.data.find(method => method.provider === current && method.available)?.provider ??
            response.data.find(method => method.provider === 'VNPAY' && method.available)?.provider ??
            response.data.find(method => method.available)?.provider ??
            '',
        );
      })
      .catch(fetchError => {
        if (active) {
          const message =
            fetchError.status === 403
              ? 'Bạn không có quyền truy cập phương thức thanh toán.'
              : 'Không thể tải phương thức thanh toán. Vui lòng thử lại sau.';
          setMethodState({ loading: false, methods: [], error: new Error(message) });
        }
      });
    return () => {
      active = false;
    };
  }, [methodRetry]);

  function retryPlanLoad() {
    setPlanState({ loading: true, plans: [], error: null });
    setPlanRetry(value => value + 1);
  }

  function retryMethodLoad() {
    setMethodState({ loading: true, methods: [], error: null });
    setMethodRetry(value => value + 1);
  }

  if (planState.loading) {
    return (
      <section className="workspace-scope payment-page payment-checkout-page">
        <div className="container checkout-state-panel">
          <AppLoading label={t('Đang tải thông tin gói Pro...')} />
        </div>
      </section>
    );
  }

  if (planState.error) {
    return (
      <section className="workspace-scope payment-page payment-checkout-page">
        <div className="container checkout-state-panel">
          <ErrorState
            error={planState.error}
            title={t('Không thể tải thông tin gói Pro')}
            onRetry={retryPlanLoad}
          />
        </div>
      </section>
    );
  }

  const selectedPlan = planState.plans.find(p => p.code === planCode) || planState.plans[0];

  if (!selectedPlan) {
    return (
      <section className="workspace-scope payment-page payment-checkout-page">
        <div className="container checkout-state-panel">
          <ErrorState
            error={new Error('Không tìm thấy gói Pro phù hợp.')}
            title={t('Gói Pro không hợp lệ')}
          />
          <Link className="button button-primary" to={ROUTES.PRO}>
            {t('Xem các gói Pro')}
          </Link>
        </div>
      </section>
    );
  }

  const subtotal = Math.max(Number(selectedPlan.originalPrice || selectedPlan.price), Number(selectedPlan.price));
  const discount = Math.max(subtotal - Number(selectedPlan.price), 0);
  const selectedMethod = methodState.methods.find(method => method.provider === provider);
  const canCheckout = !methodState.loading && !methodState.error && selectedMethod?.available === true;

  const handleCheckout = async () => {
    if (submitting || !canCheckout) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await paymentApi.createProCheckout({
        planCode: selectedPlan.code,
        provider,
        idempotencyKey: idempotencyKey.current,
        returnUrl: `${window.location.origin}${ROUTES.PAYMENT_RESULT}`,
        cancelUrl: `${window.location.origin}${ROUTES.PRO_CHECKOUT}?plan=${selectedPlan.code}`,
      });
      const checkoutUrl = readCheckoutRedirect(response.data.checkoutUrl, provider, window.location.origin);
      if (checkoutUrl.origin === window.location.origin) {
        navigate(`${checkoutUrl.pathname}${checkoutUrl.search}${checkoutUrl.hash}`);
      } else {
        window.location.assign(checkoutUrl.toString());
      }
    } catch (checkoutError) {
      setError(checkoutError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="workspace-scope payment-page payment-checkout-page">
      <div className="container">
        <div className="checkout-heading-row">
          <div className="payment-page-heading">
            <span className="workspace-kicker">{t('Nâng cấp tài khoản')}</span>
            <h1>{t('Thanh toán gói Pro')}</h1>
            <p>{t('Kiểm tra gói thành viên Pro và chọn phương thức thanh toán.')}</p>
          </div>
          <Link className="button button-outline checkout-back" to={ROUTES.PRO}>
            <span aria-hidden="true">←</span> {t('Quay lại trang Pro')}
          </Link>
        </div>

        <ol className="checkout-steps" aria-label={t('Các bước thanh toán')}>
          <li className="is-current" aria-current="step">
            <span>1</span> {t('Kiểm tra gói Pro')}
          </li>
          <li>
            <span>2</span> {t('Thanh toán')}
          </li>
          <li>
            <span>3</span> {t('Kích hoạt Pro')}
          </li>
        </ol>

        <div className="checkout-grid">
          <article className="payment-panel checkout-course-panel">
            <div className="checkout-course-body">
              <div className="payment-panel-title">
                <span className="feature-icon blue">
                  <WorkspacePremiumOutlined sx={{ fontSize: 24 }} />
                </span>
                <div>
                  <h2>ChitChatGo Pro - {t(planNameMap[selectedPlan.code] || selectedPlan.name || selectedPlan.code)}</h2>
                  <p>{t('Mở rộng toàn bộ quyền học các khóa trả phí trong thời hạn Pro.')}</p>
                </div>
              </div>

              <dl className="checkout-course-meta">
                <div>
                  <dt>{t('Thời hạn')}</dt>
                  <dd>{selectedPlan.durationMonths} {t('tháng (cộng dồn)')}</dd>
                </div>
                <div>
                  <dt>{t('Giá gói')}</dt>
                  <dd>{formatCurrency(Number(selectedPlan.price))}</dd>
                </div>
                {discount > 0 && (
                  <div>
                    <dt>{t('Ưu đãi')}</dt>
                    <dd>{t('Tiết kiệm {amount}', { amount: formatCurrency(discount) })}</dd>
                  </div>
                )}
              </dl>

              <ul className="payment-check-list">
                <li>
                  <Icon name="check" size={18} />
                  {t('Học mọi khóa trả phí đang công bố trong thời hạn Pro.')}
                </li>
                <li>
                  <Icon name="check" size={18} />
                  {t('Gia hạn cộng dồn vào thời gian Pro còn lại, giữ nguyên tiến độ học.')}
                </li>
                <li>
                  <Icon name="check" size={18} />
                  {t('Các phương thức thử nghiệm không phát sinh thanh toán bằng tiền thật.')}
                </li>
              </ul>
            </div>
          </article>

          <aside className="payment-panel checkout-summary-panel" aria-label={t('Tóm tắt đơn hàng')}>
            <div className="payment-panel-title compact">
              <span className="feature-icon green">
                <Icon name="shield" size={20} />
              </span>
              <div>
                <h2>{t('Tóm tắt thanh toán')}</h2>
                <p>{t('Mã đơn sẽ được tạo khi xác nhận thanh toán')}</p>
              </div>
            </div>

            <div className="checkout-lines">
              <div>
                <span>{t('Gói Pro')}</span>
                <strong>{t(planNameMap[selectedPlan.code] || selectedPlan.name || selectedPlan.code)}</strong>
              </div>
              <div>
                <span>{t('Giá gốc')}</span>
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              {discount > 0 && (
                <div>
                  <span>{t('Ưu đãi gói')}</span>
                  <strong>-{formatCurrency(discount)}</strong>
                </div>
              )}
            </div>

            <div className="checkout-total">
              <span>{t('Tổng thanh toán')}</span>
              <strong>{formatCurrency(Number(selectedPlan.price))}</strong>
            </div>

            <div className="payment-method-list" role="radiogroup" aria-label={t('Phương thức thanh toán')}>
              {methodState.loading && <AppLoading label={t('Đang tải phương thức thanh toán...')} />}
              {methodState.methods
                .filter(method => method.provider !== 'MOCK' || method.available)
                .map(method => (
                  <label
                    key={method.provider}
                    className={`payment-method${provider === method.provider ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="provider"
                      value={method.provider}
                      checked={provider === method.provider}
                      disabled={!method.available || submitting}
                      onChange={() => {
                        idempotencyKey.current = crypto.randomUUID();
                        setProvider(method.provider);
                        setError(null);
                      }}
                    />
                    <span>
                      <b>{t(method.label)}</b>
                      <small>{t(method.description)}</small>
                    </span>
                    {method.provider === 'VNPAY' && (
                      <span className="payment-provider-mark" aria-hidden="true">
                        VN<span>Pay</span>
                      </span>
                    )}
                  </label>
                ))}
            </div>

            {!methodState.loading &&
              !methodState.error &&
              !methodState.methods.some(method => method.available) && (
                <p className="checkout-error" role="status">
                  {t('Hiện chưa có phương thức thanh toán khả dụng. Vui lòng thử lại sau.')}
                </p>
              )}

            {methodState.error && (
              <ErrorState
                error={methodState.error}
                title={t('Không thể tải phương thức thanh toán')}
                onRetry={retryMethodLoad}
              />
            )}

            {error && (
              <p className="checkout-error" role="alert">
                {getCheckoutErrorMessage(error)}
              </p>
            )}

            <button
              className="button button-primary checkout-submit"
              onClick={handleCheckout}
              disabled={submitting || !canCheckout}
            >
              {submitting
                ? t('Đang tạo giao dịch...')
                : error
                  ? t('Thử lại thanh toán')
                  : t('Tiếp tục thanh toán')}{' '}
              <Icon name="arrow" size={17} />
            </button>

            <p className="payment-safe-note">
              <Icon name="shield" size={16} />
              {provider === 'VNPAY'
                ? t('Bạn sẽ được chuyển tới VNPay Sandbox để hoàn tất thanh toán thử nghiệm.')
                : t('Bạn sẽ được chuyển sang màn mô phỏng để chọn kết quả thanh toán.')}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
