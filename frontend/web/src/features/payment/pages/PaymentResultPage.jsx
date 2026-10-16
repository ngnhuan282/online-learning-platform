import { useEffect, useState } from 'react';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import { Link, useSearchParams } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { paymentApi } from '../api/paymentApi';
import { getPaymentDisplayStatus, getResumePaymentUrl, needsPaymentRefresh } from '../utils/paymentFlow';
import '../styles/payment.css';

const resultCopy = {
  EXPIRED: {
    tone: 'pending',
    eyebrow: 'HẾT HẠN THANH TOÁN',
    title: 'Đơn đã hết hạn thanh toán',
    description:
      'Link thanh toán này không còn sử dụng được. Nếu bạn đã thanh toán, hãy kiểm tra kết quả trước khi tạo giao dịch mới.',
    icon: 'clock',
  },
  SUCCESS: {
    tone: 'success',
    eyebrow: 'THANH TOÁN THÀNH CÔNG',
    title: 'Thanh toán thành công',
    description: 'Giao dịch đã được ghi nhận thành công. Bạn có thể tiếp tục tới khu học tập.',
    icon: 'check',
  },
  FAILED: {
    tone: 'failed',
    eyebrow: 'THANH TOÁN THẤT BẠI',
    title: 'Thanh toán không thành công',
    description: 'Giao dịch chưa được xử lý thành công. Bạn có thể thử thanh toán lại khóa học này.',
    icon: 'close',
  },
  CANCELLED: {
    tone: 'failed',
    eyebrow: 'ĐÃ HỦY THANH TOÁN',
    title: 'Bạn đã hủy thanh toán',
    description: 'Giao dịch đã được hủy theo yêu cầu của bạn. Bạn có thể thanh toán lại khi sẵn sàng.',
    icon: 'close',
  },
  PENDING: {
    tone: 'pending',
    eyebrow: 'ĐANG CHỜ THANH TOÁN',
    title: 'Giao dịch đang chờ xử lý',
    description: 'Bạn có thể tiếp tục thanh toán trên cổng mô phỏng hoặc quay lại lịch sử thanh toán.',
    icon: 'clock',
  },
  REFUNDED: {
    tone: 'pending',
    eyebrow: 'ĐÃ HOÀN TIỀN',
    title: 'Giao dịch đã hoàn tiền',
    description: 'Giao dịch này đã được ghi nhận hoàn tiền.',
    icon: 'check',
  },
};

function paymentTone(status, provider) {
  if (status === 'EXPIRED') return resultCopy.EXPIRED;
  if (status === 'SUCCESS') return resultCopy.SUCCESS;
  if (status === 'FAILED') return resultCopy.FAILED;
  if (status === 'CANCELLED') return resultCopy.CANCELLED;
  if (status === 'REFUNDED') return resultCopy.REFUNDED;
  if (provider === 'VNPAY') {
    return {
      ...resultCopy.PENDING,
      eyebrow: 'ĐANG XÁC NHẬN THANH TOÁN',
      title: 'Đang chờ xác nhận từ VNPay',
      description:
        'Kết quả thanh toán sẽ được cập nhật khi nhận được xác nhận từ VNPay. Bạn không cần tạo giao dịch mới.',
    };
  }
  return resultCopy.PENDING;
}

export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const orderCode = params.get('orderCode');
  const invalidCallback = params.get('callbackError') === 'invalid';
  const [remoteResult, setRemoteResult] = useState({ orderCode: null, order: null, error: null });
  const [retryCount, setRetryCount] = useState(0);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState(null);

  useEffect(() => {
    if (!orderCode) return;
    let active = true;
    let timer;
    let attempts = 0;
    async function loadResult() {
      try {
        const response = await paymentApi.getOrder(orderCode);
        if (!active) return;
        setRemoteResult({ orderCode, order: response.data, error: null });
        attempts += 1;
        if (needsPaymentRefresh(response.data) && attempts < 6) {
          timer = setTimeout(loadResult, 3000);
        }
      } catch (fetchError) {
        if (active)
          setRemoteResult(current => ({
            orderCode,
            order: current.orderCode === orderCode ? current.order : null,
            error: fetchError,
          }));
      }
    }
    loadResult();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orderCode, retryCount]);

  function retryResultLoad() {
    setRemoteResult({ orderCode: null, order: null, error: null });
    setRetryCount(value => value + 1);
  }

  const order = remoteResult.orderCode === orderCode ? remoteResult.order : null;
  const error = remoteResult.orderCode === orderCode ? remoteResult.error : null;
  const loading = Boolean(orderCode) && remoteResult.orderCode !== orderCode;

  if (!orderCode) {
    return (
      <section className="payment-page payment-result-page">
        <div className="container payment-result-container">
          <article className="payment-panel result-card">
            <ErrorState
              error={
                new Error(
                  invalidCallback
                    ? 'Không thể xác minh thông tin trả về từ VNPay. Vui lòng xem trạng thái giao dịch trong lịch sử thanh toán.'
                    : 'Không tìm thấy mã đơn hàng để kiểm tra kết quả.',
                )
              }
              title={invalidCallback ? 'Chưa xác minh được kết quả' : 'Chưa có thông tin thanh toán'}
            />
            <div className="result-actions result-error-actions">
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

  if (orderCode && loading) {
    return (
      <section className="payment-page payment-result-page">
        <div className="container payment-result-container">
          <article className="payment-panel result-card">
            <AppLoading label="Đang tải kết quả thanh toán..." />
          </article>
        </div>
      </section>
    );
  }

  if (orderCode && error && !order) {
    const forbidden = error.status === 403 || error.code === 'FORBIDDEN';
    return (
      <section className="payment-page payment-result-page">
        <div className="container payment-result-container">
          <article className="payment-panel result-card">
            <ErrorState
              error={forbidden ? new Error('Bạn không có quyền xem giao dịch này.') : error}
              title={forbidden ? 'Không thể xem giao dịch' : 'Không thể tải kết quả thanh toán'}
              onRetry={forbidden ? undefined : retryResultLoad}
            />
            {forbidden && (
              <div className="result-actions result-error-actions">
                <Link className="button button-primary" to={ROUTES.PAYMENT_HISTORY}>
                  Về lịch sử thanh toán
                </Link>
              </div>
            )}
          </article>
        </div>
      </section>
    );
  }

  const paymentStatus = getPaymentDisplayStatus(order);
  const copy = paymentTone(paymentStatus, order.payment.provider);
  const courseTitle = order.items?.[0]?.courseTitle || 'Khóa học';
  const paymentCourseId = order.items?.[0]?.courseId;
  const amount = order.payment.amount ?? order.totalAmount;
  const provider = order.payment.provider;
  const retryCheckoutUrl = `${ROUTES.CHECKOUT}?course=${encodeURIComponent(paymentCourseId)}`;
  const resumePaymentUrl = getResumePaymentUrl(order, window.location.origin);
  const awaitingActivation =
    paymentStatus === 'SUCCESS' && provider === 'VNPAY' && order.payment.enrollmentReady === false;

  async function retryActivation() {
    if (activating) return;
    setActivating(true);
    setActivationError(null);
    try {
      const response = await paymentApi.retryActivation(orderCode);
      setRemoteResult({ orderCode, order: response.data, error: null });
    } catch {
      setActivationError(
        new Error(
          'Khóa học chưa thể kích hoạt lúc này. Thanh toán của bạn đã được ghi nhận, vui lòng thử lại sau.',
        ),
      );
    } finally {
      setActivating(false);
    }
  }

  return (
    <section className="payment-page payment-result-page">
      <div className="container payment-result-container">
        <article className={`payment-panel result-card ${copy.tone}`}>
          <span className={`result-icon ${copy.tone}`}>
            <Icon name={copy.icon} size={30} />
          </span>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>
            {awaitingActivation
              ? 'Thanh toán đã thành công. Khóa học đang được kích hoạt, bạn không cần thanh toán lại.'
              : copy.description}
          </p>
          {error && <ErrorState error={error} title="Chưa thể cập nhật kết quả" onRetry={retryResultLoad} />}
          {activationError && <ErrorState error={activationError} title="Đang chờ kích hoạt khóa học" />}

          <dl className="result-details">
            <div>
              <dt>Mã đơn hàng</dt>
              <dd>{order.orderCode}</dd>
            </div>
            <div>
              <dt>Khóa học</dt>
              <dd>{courseTitle}</dd>
            </div>
            <div>
              <dt>Số tiền</dt>
              <dd>{formatCurrency(Number(amount), order.payment.currency || order.currency)}</dd>
            </div>
            <div>
              <dt>Phương thức</dt>
              <dd>{provider === 'VNPAY' ? 'VNPay' : 'Thanh toán mô phỏng'}</dd>
            </div>
          </dl>

          <div className="result-actions">
            {awaitingActivation ? (
              <button className="button button-primary" onClick={retryActivation} disabled={activating}>
                {activating ? 'Đang kích hoạt...' : 'Thử kích hoạt khóa học'}{' '}
                <RefreshOutlined sx={{ fontSize: 17 }} />
              </button>
            ) : paymentStatus === 'SUCCESS' ? (
              <Link className="button button-primary" to="/my-courses">
                Vào khu học tập <Icon name="arrow" size={17} />
              </Link>
            ) : paymentStatus === 'EXPIRED' ? (
              <>
                <button className="button button-primary" onClick={retryResultLoad}>
                  Kiểm tra kết quả <RefreshOutlined sx={{ fontSize: 17 }} />
                </button>
                <Link className="button button-outline" to={retryCheckoutUrl}>
                  Tạo giao dịch mới <Icon name="arrow" size={17} />
                </Link>
              </>
            ) : paymentStatus === 'PENDING' ? (
              <>
                {provider === 'VNPAY' && (
                  <button className="button button-primary" onClick={retryResultLoad}>
                    Kiểm tra kết quả <RefreshOutlined sx={{ fontSize: 17 }} />
                  </button>
                )}
                {resumePaymentUrl &&
                  (provider === 'VNPAY' ? (
                    <a className="button button-outline" href={resumePaymentUrl} rel="noreferrer">
                      Tiếp tục thanh toán <Icon name="arrow" size={17} />
                    </a>
                  ) : (
                    <Link className="button button-primary" to={resumePaymentUrl}>
                      Tiếp tục thanh toán <Icon name="arrow" size={17} />
                    </Link>
                  ))}
              </>
            ) : (
              <Link className="button button-primary" to={retryCheckoutUrl}>
                Thanh toán lại <Icon name="arrow" size={17} />
              </Link>
            )}
            <Link className="button button-outline" to={ROUTES.PAYMENT_HISTORY}>
              Lịch sử thanh toán
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
