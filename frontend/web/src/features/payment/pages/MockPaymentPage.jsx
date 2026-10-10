import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { getErrorMessage } from '../../../shared/utils/errorUtils';
import { paymentApi } from '../api/paymentApi';
import { formatDemoPrice } from '../data/paymentDemo';
import '../styles/payment.css';

const statusLabel = {
  PENDING: 'Đang chờ thanh toán',
  SUCCESS: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Đã hoàn tiền',
};

function getMockPaymentErrorMessage(error) {
  if (error?.code === 'SERVICE_UNAVAILABLE' || error?.status === 503) {
    return 'Chưa thể kích hoạt khóa học. Giao dịch vẫn đang chờ, vui lòng thử lại sau ít phút.';
  }
  if (error?.code === 'CONFLICT' || error?.status === 409) {
    return 'Giao dịch này đã được xử lý hoặc không còn ở trạng thái chờ. Vui lòng xem kết quả mới nhất.';
  }
  return getErrorMessage(error);
}

function buildReturnPath(returnUrl, orderCode, status) {
  let target;
  try {
    target = new URL(returnUrl || ROUTES.PAYMENT_RESULT, window.location.origin);
  } catch {
    target = new URL(ROUTES.PAYMENT_RESULT, window.location.origin);
  }
  if (target.origin !== window.location.origin) {
    target = new URL(ROUTES.PAYMENT_RESULT, window.location.origin);
  }
  target.searchParams.set('orderCode', orderCode);
  target.searchParams.set(
    'status',
    status === 'SUCCESS' ? 'success' : status === 'CANCELLED' ? 'cancelled' : 'failed',
  );
  return `${target.pathname}${target.search}${target.hash}`;
}

export default function MockPaymentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderCode = params.get('orderCode');
  const returnUrl = params.get('returnUrl') || ROUTES.PAYMENT_RESULT;
  const [state, setState] = useState({ loading: Boolean(orderCode), order: null, error: null });
  const [retryCount, setRetryCount] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!orderCode) return undefined;
    let active = true;
    paymentApi
      .getOrder(orderCode)
      .then(response => {
        if (active) setState({ loading: false, order: response.data, error: null });
      })
      .catch(error => {
        if (active) setState({ loading: false, order: null, error });
      });
    return () => {
      active = false;
    };
  }, [orderCode, retryCount]);

  function retryOrderLoad() {
    setState({ loading: true, order: null, error: null });
    setSubmitError(null);
    setRetryCount(value => value + 1);
  }

  const payment = state.order?.payment;
  const item = state.order?.items?.[0];
  const amount = Number(payment?.amount ?? state.order?.totalAmount ?? 0);
  const alreadyProcessed = payment && payment.status !== 'PENDING';

  const resultPath = useMemo(
    () => (orderCode ? buildReturnPath(returnUrl, orderCode, payment?.status || 'PENDING') : ROUTES.PAYMENT_RESULT),
    [orderCode, payment?.status, returnUrl],
  );

  async function completePayment(status) {
    if (!orderCode || processingStatus || alreadyProcessed) return;
    setProcessingStatus(status);
    setSubmitError(null);
    try {
      await paymentApi.completeMockPayment(orderCode, {
        status,
        failureMessage:
          status === 'FAILED'
            ? 'Thanh toán mô phỏng không thành công.'
            : status === 'CANCELLED'
              ? 'Học viên hủy thanh toán mô phỏng.'
              : undefined,
      });
      navigate(buildReturnPath(returnUrl, orderCode, status), { replace: true });
    } catch (error) {
      setSubmitError(error);
    } finally {
      setProcessingStatus('');
    }
  }

  if (!orderCode) {
    return (
      <section className="payment-page payment-result-page">
        <div className="container payment-result-container">
          <article className="payment-panel result-card failed">
            <span className="result-icon failed">
              <Icon name="close" size={30} />
            </span>
            <span className="eyebrow">MOCK PAYMENT</span>
            <h1>Thiếu mã giao dịch</h1>
            <p>Không tìm thấy mã đơn hàng để mô phỏng thanh toán.</p>
            <div className="result-actions">
              <Link className="button button-primary" to={ROUTES.PAYMENT_HISTORY}>
                Xem lịch sử thanh toán
              </Link>
              <Link className="button button-outline" to={ROUTES.COURSES}>
                Chọn khóa học
              </Link>
            </div>
          </article>
        </div>
      </section>
    );
  }

  if (state.loading) {
    return (
      <section className="payment-page payment-result-page">
        <div className="container payment-result-container">
          <article className="payment-panel result-card">
            <AppLoading label="Đang tải giao dịch thanh toán..." />
          </article>
        </div>
      </section>
    );
  }

  if (state.error) {
    return (
      <section className="payment-page payment-result-page">
        <div className="container payment-result-container">
          <article className="payment-panel result-card">
            <ErrorState
              error={state.error}
              title="Không thể tải giao dịch"
              onRetry={retryOrderLoad}
            />
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="payment-page payment-mock-page">
      <div className="container">
        <div className="payment-page-heading">
          <span className="eyebrow">MOCK PAYMENT</span>
          <h1>Cổng thanh toán mô phỏng</h1>
          <p>Chọn kết quả giao dịch để kiểm thử luồng thanh toán khóa học.</p>
        </div>

        <div className="mock-payment-grid">
          <article className="payment-panel mock-payment-card">
            <div className="payment-panel-title">
              <span className="feature-icon blue">
                <Icon name="shield" size={20} />
              </span>
              <div>
                <h2>Thông tin giao dịch</h2>
                <p>Kiểm tra lại khóa học và số tiền trước khi chọn kết quả.</p>
              </div>
            </div>

            <dl className="result-details mock-payment-details">
              <div>
                <dt>Mã đơn hàng</dt>
                <dd>{state.order.orderCode}</dd>
              </div>
              <div>
                <dt>Trạng thái</dt>
                <dd>{statusLabel[payment?.status] || payment?.status}</dd>
              </div>
              <div>
                <dt>Khóa học</dt>
                <dd>{item?.courseTitle || 'Khóa học'}</dd>
              </div>
              <div>
                <dt>Số tiền</dt>
                <dd>{formatDemoPrice(amount)}</dd>
              </div>
            </dl>

            {alreadyProcessed ? (
              <div className="mock-provider-note success">
                <Icon name="check" size={18} />
                Giao dịch này đã có kết quả. Bạn có thể xem trang kết quả hoặc lịch sử thanh toán.
              </div>
            ) : (
              <div className="mock-provider-note">
                <Icon name="clock" size={18} />
                Đây là cổng thanh toán mô phỏng cho tuần 5, chưa gọi nhà cung cấp bên ngoài.
              </div>
            )}
          </article>

          <aside className="payment-panel mock-provider-panel">
            <div className="payment-panel-title compact">
              <span className="feature-icon green">
                <Icon name="check" size={20} />
              </span>
              <div>
                <h2>Kết quả thanh toán</h2>
                <p>Mô phỏng phản hồi từ cổng thanh toán.</p>
              </div>
            </div>

            {submitError && <p className="checkout-error">{getMockPaymentErrorMessage(submitError)}</p>}

            <div className="mock-result-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={alreadyProcessed || Boolean(processingStatus)}
                onClick={() => completePayment('SUCCESS')}
              >
                {processingStatus === 'SUCCESS' ? 'Đang xử lý...' : 'Thanh toán thành công'}
                <Icon name="check" size={17} />
              </button>
              <button
                className="button button-outline mock-failed-button"
                type="button"
                disabled={alreadyProcessed || Boolean(processingStatus)}
                onClick={() => completePayment('FAILED')}
              >
                {processingStatus === 'FAILED' ? 'Đang xử lý...' : 'Thanh toán thất bại'}
                <Icon name="close" size={17} />
              </button>
              <button
                className="button button-soft"
                type="button"
                disabled={alreadyProcessed || Boolean(processingStatus)}
                onClick={() => completePayment('CANCELLED')}
              >
                {processingStatus === 'CANCELLED' ? 'Đang xử lý...' : 'Hủy giao dịch'}
              </button>
            </div>

            <div className="result-actions mock-secondary-actions">
              <Link className="button button-outline" to={resultPath}>
                Xem kết quả
              </Link>
              <Link className="button button-outline" to={ROUTES.PAYMENT_HISTORY}>
                Lịch sử thanh toán
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
