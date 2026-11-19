import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { paymentApi } from '../api/paymentApi';
import { getCheckoutErrorMessage, readCheckoutRedirect } from '../utils/paymentFlow';
import { DiamondRounded } from '@mui/icons-material';
import '../styles/payment.css';

const GEM_PACKAGES = {
  GEM_200:  { gems: 200,  price: 19000,  label: '200 Kim Cương' },
  GEM_500:  { gems: 500,  price: 45000,  label: '500 Kim Cương' },
  GEM_1200: { gems: 1200, price: 99000,  label: '1.200 Kim Cương' },
};

export default function GemCheckoutPage() {
  useLocale();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const packageCode = params.get('package') || '';
  const pkg = GEM_PACKAGES[packageCode] || null;
  const idempotencyKey = useRef(crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [methodState, setMethodState] = useState({ loading: true, methods: [], error: null });
  const [methodRetry, setMethodRetry] = useState(0);
  const [provider, setProvider] = useState('MOCK');

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

  function retryMethodLoad() {
    setMethodState({ loading: true, methods: [], error: null });
    setMethodRetry(value => value + 1);
  }

  if (!pkg) {
    return (
      <section className="workspace-scope payment-page payment-checkout-page">
        <div className="container checkout-state-panel">
          <ErrorState
            error={new Error('Gói nạp kim cương không hợp lệ. Vui lòng chọn gói khác.')}
            title={t('Gói không hợp lệ')}
          />
        </div>
      </section>
    );
  }

  const selectedMethod = methodState.methods.find(method => method.provider === provider);
  const canCheckout = !methodState.loading && !methodState.error && selectedMethod?.available === true;

  const handleCheckout = async () => {
    if (submitting || !canCheckout) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await paymentApi.createGemCheckout({
        packageCode,
        provider,
        idempotencyKey: idempotencyKey.current,
        returnUrl: `${window.location.origin}${ROUTES.PAYMENT_RESULT}`,
        cancelUrl: `${window.location.origin}${ROUTES.GEM_CHECKOUT}?package=${packageCode}`,
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
            <span className="workspace-kicker">{t('Nạp kim cương')}</span>
            <h1>{t('Thanh toán Kim Cương')}</h1>
            <p>{t('Kiểm tra gói kim cương và chọn phương thức thanh toán.')}</p>
          </div>
        </div>

        <ol className="checkout-steps" aria-label={t('Các bước thanh toán')}>
          <li className="is-current" aria-current="step">
            <span>1</span> {t('Kiểm tra đơn hàng')}
          </li>
          <li>
            <span>2</span> {t('Thanh toán')}
          </li>
          <li>
            <span>3</span> {t('Nhận kim cương')}
          </li>
        </ol>

        <div className="checkout-grid">
          <article className="payment-panel checkout-course-panel">
            <div className="checkout-course-body">
              <div className="payment-panel-title">
                <span className="feature-icon blue">
                  <DiamondRounded sx={{ fontSize: 20 }} />
                </span>
                <div>
                  <h2>{t(pkg.label)}</h2>
                  <p>{t('Kim cương dùng để mua vật phẩm trong cửa hàng.')}</p>
                </div>
              </div>

              <dl className="checkout-course-meta">
                <div>
                  <dt>{t('Số kim cương')}</dt>
                  <dd>{pkg.gems.toLocaleString()}</dd>
                </div>
                <div>
                  <dt>{t('Giá')}</dt>
                  <dd>{formatCurrency(pkg.price)}</dd>
                </div>
              </dl>

              <ul className="payment-check-list">
                <li>
                  <Icon name="check" size={18} />
                  {t('Kim cương sẽ được cộng ngay sau khi thanh toán thành công.')}
                </li>
                <li>
                  <Icon name="check" size={18} />
                  {t('Kim cương dùng để mua vật phẩm trang trí trong cửa hàng.')}
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
                <span>{t('Số kim cương')}</span>
                <strong>{pkg.gems.toLocaleString()}</strong>
              </div>
              <div>
                <span>{t('Giá')}</span>
                <strong>{formatCurrency(pkg.price)}</strong>
              </div>
            </div>

            <div className="checkout-total">
              <span>{t('Tổng thanh toán')}</span>
              <strong>{formatCurrency(pkg.price)}</strong>
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
