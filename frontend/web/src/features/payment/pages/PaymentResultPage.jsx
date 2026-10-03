import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { paymentApi } from '../api/paymentApi';
import {
  buildOrderSnapshot,
  formatDemoPrice,
  getCheckoutCourse,
  getCheckoutCourseParamFromPaymentCourseId,
} from '../data/paymentDemo';
import '../styles/payment.css';

const resultCopy = {
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
};

function paymentTone(status) {
  if (status === 'SUCCESS') return resultCopy.SUCCESS;
  if (status === 'FAILED') return resultCopy.FAILED;
  if (status === 'CANCELLED') return resultCopy.CANCELLED;
  return resultCopy.PENDING;
}

function fallbackStatusFromParams(status) {
  if (status === 'failed') return 'FAILED';
  if (status === 'cancelled') return 'CANCELLED';
  if (status === 'pending') return 'PENDING';
  return 'SUCCESS';
}

export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const orderCode = params.get('orderCode');
  const [remoteResult, setRemoteResult] = useState({ orderCode: null, order: null, error: null });

  useEffect(() => {
    if (!orderCode) return;
    let active = true;
    paymentApi
      .getOrder(orderCode)
      .then(response => {
        if (active) setRemoteResult({ orderCode, order: response.data, error: null });
      })
      .catch(fetchError => {
        if (active) setRemoteResult({ orderCode, order: null, error: fetchError });
      });
    return () => {
      active = false;
    };
  }, [orderCode]);

  const order = remoteResult.orderCode === orderCode ? remoteResult.order : null;
  const error = remoteResult.orderCode === orderCode ? remoteResult.error : null;
  const loading = Boolean(orderCode) && remoteResult.orderCode !== orderCode;

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
    return (
      <section className="payment-page payment-result-page">
        <div className="container payment-result-container">
          <article className="payment-panel result-card">
            <ErrorState error={error} title="Không thể tải kết quả thanh toán" />
          </article>
        </div>
      </section>
    );
  }

  const fallbackStatus = fallbackStatusFromParams(params.get('status'));
  const course = getCheckoutCourse(params.get('course'));
  const demoOrder = buildOrderSnapshot(course);
  const paymentStatus = order?.payment?.status || fallbackStatus;
  const copy = paymentTone(paymentStatus);
  const courseTitle = order?.items?.[0]?.courseTitle || course.title;
  const paymentCourseId = order?.items?.[0]?.courseId;
  const retryCourseParam = getCheckoutCourseParamFromPaymentCourseId(paymentCourseId) || course.id;
  const amount = order?.payment?.amount ?? order?.totalAmount ?? demoOrder.total;
  const provider = order?.payment?.provider || demoOrder.provider;
  const retryCheckoutUrl = `${ROUTES.CHECKOUT}?course=${encodeURIComponent(retryCourseParam)}`;
  const resumePaymentUrl = `${ROUTES.PAYMENT_MOCK}?orderCode=${encodeURIComponent(
    order?.orderCode || orderCode,
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

          <dl className="result-details">
            <div>
              <dt>Mã đơn hàng</dt>
              <dd>{order?.orderCode || demoOrder.orderCode}</dd>
            </div>
            <div>
              <dt>Khóa học</dt>
              <dd>{courseTitle}</dd>
            </div>
            <div>
              <dt>Số tiền</dt>
              <dd>{formatDemoPrice(Number(amount))}</dd>
            </div>
            <div>
              <dt>Phương thức</dt>
              <dd>{provider}</dd>
            </div>
          </dl>

          <div className="result-actions">
            {paymentStatus === 'SUCCESS' ? (
              <Link className="button button-primary" to="/my-courses">
                Vào khu học tập <Icon name="arrow" size={17} />
              </Link>
            ) : paymentStatus === 'PENDING' && orderCode ? (
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
