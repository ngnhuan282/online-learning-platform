import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { paymentApi } from '../api/paymentApi';
import { buildOrderSnapshot, formatDemoPrice, getCheckoutCourse } from '../data/paymentDemo';
import '../styles/payment.css';

const resultCopy = {
  SUCCESS: {
    tone: 'success',
    eyebrow: 'PAYMENT SUCCESS',
    title: 'Thanh toán thành công',
    description: 'Payment đã thành công và sẵn sàng kích hoạt enrollment ở bước tích hợp Learning.',
    icon: 'check',
  },
  FAILED: {
    tone: 'failed',
    eyebrow: 'PAYMENT FAILED',
    title: 'Thanh toán chưa hoàn tất',
    description: 'Giao dịch thất bại hoặc bị hủy. Retry UX sẽ được hoàn thiện ở các tuần tiếp theo.',
    icon: 'close',
  },
  PENDING: {
    tone: 'pending',
    eyebrow: 'PAYMENT PENDING',
    title: 'Đã tạo thanh toán nội bộ',
    description: 'Order và payment đã được lưu ở trạng thái PENDING để chuẩn bị cho mock provider flow.',
    icon: 'clock',
  },
};

function paymentTone(status) {
  if (status === 'SUCCESS') return resultCopy.SUCCESS;
  if (status === 'FAILED' || status === 'CANCELLED') return resultCopy.FAILED;
  return resultCopy.PENDING;
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

  const fallbackStatus = params.get('status') === 'failed' ? 'FAILED' : 'SUCCESS';
  const course = getCheckoutCourse(params.get('course'));
  const demoOrder = buildOrderSnapshot(course);
  const paymentStatus = order?.payment?.status || fallbackStatus;
  const copy = paymentTone(paymentStatus);
  const courseTitle = order?.items?.[0]?.courseTitle || course.title;
  const amount = order?.payment?.amount ?? order?.totalAmount ?? demoOrder.total;
  const provider = order?.payment?.provider || demoOrder.provider;

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
              <Link className="button button-primary" to="/#courses">
                Vào khu học tập <Icon name="arrow" size={17} />
              </Link>
            ) : (
              <Link className="button button-primary" to={ROUTES.PAYMENT_HISTORY}>
                Xem lịch sử thanh toán <Icon name="arrow" size={17} />
              </Link>
            )}
            <Link className="button button-outline" to={ROUTES.HOME}>
              Về trang chủ
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
