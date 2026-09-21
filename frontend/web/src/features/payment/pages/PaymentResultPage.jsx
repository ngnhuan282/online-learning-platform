import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { buildOrderSnapshot, formatDemoPrice, getCheckoutCourse } from '../data/paymentDemo';
import '../styles/payment.css';

export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const status = params.get('status') === 'failed' ? 'failed' : 'success';
  const course = getCheckoutCourse(params.get('course'));
  const order = buildOrderSnapshot(course);
  const success = status === 'success';

  return (
    <section className="payment-page payment-result-page">
      <div className="container payment-result-container">
        <article className={`payment-panel result-card ${success ? 'success' : 'failed'}`}>
          <span className={`result-icon ${success ? 'success' : 'failed'}`}>
            <Icon name={success ? 'check' : 'close'} size={30} />
          </span>
          <span className="eyebrow">{success ? 'PAYMENT SUCCESS' : 'PAYMENT FAILED'}</span>
          <h1>{success ? 'Thanh toán thành công' : 'Thanh toán chưa hoàn tất'}</h1>
          <p>
            {success
              ? 'Đơn hàng skeleton đã được đánh dấu thành công để demo luồng kết quả.'
              : 'Trạng thái thất bại/hủy dùng cho UI retry và thông báo lỗi ở các tuần tiếp theo.'}
          </p>

          <dl className="result-details">
            <div>
              <dt>Mã đơn hàng</dt>
              <dd>{order.orderCode}</dd>
            </div>
            <div>
              <dt>Khóa học</dt>
              <dd>{course.title}</dd>
            </div>
            <div>
              <dt>Số tiền</dt>
              <dd>{formatDemoPrice(order.total)}</dd>
            </div>
            <div>
              <dt>Phương thức</dt>
              <dd>{order.provider}</dd>
            </div>
          </dl>

          <div className="result-actions">
            {success ? (
              <Link className="button button-primary" to="/#courses">
                Vào khu học tập <Icon name="arrow" size={17} />
              </Link>
            ) : (
              <Link className="button button-primary" to={`${ROUTES.CHECKOUT}?course=${course.id}`}>
                Thử lại thanh toán <Icon name="arrow" size={17} />
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
