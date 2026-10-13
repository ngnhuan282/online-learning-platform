import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { paymentApi } from '../api/paymentApi';
import { learningApi } from '../../learning/api/learningApi';
import '../styles/payment.css';

const resultCopy = {
  SUCCESS: {
    tone: 'success',
    eyebrow: 'THANH TOÁN THÀNH CÔNG',
    title: 'Thanh toán thành công',
    description: 'Giao dịch đã được xác nhận thành công.',
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
};

function paymentTone(status) {
  if (status === 'SUCCESS') return resultCopy.SUCCESS;
  if (status === 'FAILED') return resultCopy.FAILED;
  if (status === 'CANCELLED') return resultCopy.CANCELLED;
  return resultCopy.PENDING;
}

export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const orderCode = params.get('orderCode');
  const [remoteResult, setRemoteResult] = useState({ orderCode: null, order: null, error: null });
  const [retryCount, setRetryCount] = useState(0);
  const [enrollmentState, setEnrollmentState] = useState({ orderCode: null, ready: false, error: null });

  useEffect(() => {
    if (!orderCode) return;
    let active = true;
    paymentApi
      .getOrder(orderCode)
      .then(response => {
        if (!active) return;
        setRemoteResult({ orderCode, order: response.data, error: null });
        if (response.data.payment?.status !== 'SUCCESS') return;
        const courseId = response.data.items?.[0]?.courseId;
        return learningApi
          .getMyEnrollments()
          .then(enrollments => {
            if (active)
              setEnrollmentState({
                orderCode,
                ready: enrollments.data.some(
                  item =>
                    String(item.courseId) === String(courseId) &&
                    ['ACTIVE', 'COMPLETED'].includes(item.status),
                ),
                error: null,
              });
          })
          .catch(error => {
            if (active) setEnrollmentState({ orderCode, ready: false, error });
          });
      })
      .catch(fetchError => {
        if (active) setRemoteResult({ orderCode, order: null, error: fetchError });
      });
    return () => {
      active = false;
    };
  }, [orderCode, retryCount]);

  function retryResultLoad() {
    setRemoteResult({ orderCode: null, order: null, error: null });
    setRetryCount(value => value + 1);
    setEnrollmentState({ orderCode: null, ready: false, error: null });
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
              error={new Error('Không tìm thấy mã đơn hàng để kiểm tra kết quả.')}
              title="Chưa có thông tin thanh toán"
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

  if (orderCode && error) {
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

  const paymentStatus = order.payment.status;
  const enrollmentReady = enrollmentState.orderCode === orderCode && enrollmentState.ready;
  const copy = paymentTone(paymentStatus);
  const courseTitle = order.items?.[0]?.courseTitle || 'Khóa học';
  const paymentCourseId = order.items?.[0]?.courseId;
  const amount = order.payment.amount ?? order.totalAmount;
  const provider = order.payment.provider;
  const retryCheckoutUrl = `${ROUTES.CHECKOUT}?course=${encodeURIComponent(paymentCourseId)}`;
  const resumePaymentUrl = `${ROUTES.PAYMENT_MOCK}?orderCode=${encodeURIComponent(
    order.orderCode,
  )}&returnUrl=${encodeURIComponent(`${window.location.origin}${ROUTES.PAYMENT_RESULT}`)}`;

  return (
    <section className="payment-page payment-result-page">
      <div className="container payment-result-container">
        <article className={`payment-panel result-card ${copy.tone}`}>
          <span className={`result-icon ${copy.tone}`}>
            <Icon name={copy.icon} size={30} />
          </span>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          {paymentStatus === 'SUCCESS' && !enrollmentReady && (
            <p role="status">
              {enrollmentState.error
                ? 'Chưa kiểm tra được quyền học. Vui lòng kiểm tra lại.'
                : 'Thanh toán đã được xác nhận. Đang chờ quyền học được đồng bộ.'}
            </p>
          )}

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
              <dd>{provider}</dd>
            </div>
          </dl>

          <div className="result-actions">
            {paymentStatus === 'SUCCESS' && enrollmentReady ? (
              <Link className="button button-primary" to="/my-courses">
                Vào khu học tập <Icon name="arrow" size={17} />
              </Link>
            ) : paymentStatus === 'SUCCESS' ? (
              <button className="button button-primary" onClick={retryResultLoad}>
                Kiểm tra lại quyền học
              </button>
            ) : paymentStatus === 'PENDING' && provider === 'MOCK' && orderCode ? (
              <Link className="button button-primary" to={resumePaymentUrl}>
                Tiếp tục thanh toán <Icon name="arrow" size={17} />
              </Link>
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
