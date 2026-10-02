import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { getErrorMessage } from '../../../shared/utils/errorUtils';
import { paymentApi } from '../api/paymentApi';
import {
  buildOrderSnapshot,
  formatDemoPrice,
  getCheckoutCourse,
  getPaymentCourseId,
} from '../data/paymentDemo';
import '../styles/payment.css';

export default function PaymentCheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const course = getCheckoutCourse(params.get('course'));
  const order = buildOrderSnapshot(course);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleCheckout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await paymentApi.createCheckout({
        courseId: getPaymentCourseId(course),
        provider: 'MOCK',
        returnUrl: `${window.location.origin}${ROUTES.PAYMENT_RESULT}`,
        cancelUrl: `${window.location.origin}${ROUTES.CHECKOUT}?course=${encodeURIComponent(course.id)}`,
      });
      const checkoutUrl = new URL(response.data.checkoutUrl, window.location.origin);
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
    <section className="payment-page payment-checkout-page">
      <div className="container">
        <div className="payment-page-heading">
          <span className="eyebrow">CHECKOUT</span>
          <h1>Thanh toán khóa học</h1>
          <p>Kiểm tra thông tin khóa học trước khi chuyển sang bước thanh toán mô phỏng.</p>
        </div>

        <div className="checkout-grid">
          <article className="payment-panel checkout-course-panel">
            <div className="checkout-course-media">
              <img src={course.image} alt={course.imageAlt} />
              <span>{course.tag}</span>
            </div>
            <div className="checkout-course-body">
              <div className="payment-panel-title">
                <span className="feature-icon blue">
                  <Icon name="cap" size={20} />
                </span>
                <div>
                  <h2>{course.title}</h2>
                  <p>{course.description}</p>
                </div>
              </div>

              <dl className="checkout-course-meta">
                <div>
                  <dt>Thời lượng</dt>
                  <dd>{course.hours} giờ</dd>
                </div>
                <div>
                  <dt>Cấp độ</dt>
                  <dd>{course.level}</dd>
                </div>
                <div>
                  <dt>Học viên</dt>
                  <dd>{new Intl.NumberFormat('vi-VN').format(course.students)}</dd>
                </div>
              </dl>

              <ul className="payment-check-list">
                <li>
                  <Icon name="check" size={18} />
                  Số tiền thanh toán được lấy từ thông tin khóa học đã lưu trong hệ thống.
                </li>
                <li>
                  <Icon name="check" size={18} />
                  Giao dịch thành công sẽ sẵn sàng cho bước ghi danh khóa học.
                </li>
                <li>
                  <Icon name="check" size={18} />
                  Tuần này sử dụng cổng thanh toán mô phỏng để kiểm thử luồng nghiệp vụ.
                </li>
              </ul>
            </div>
          </article>

          <aside className="payment-panel checkout-summary-panel" aria-label="Tóm tắt đơn hàng">
            <div className="payment-panel-title compact">
              <span className="feature-icon green">
                <Icon name="shield" size={20} />
              </span>
              <div>
                <h2>Tóm tắt thanh toán</h2>
                <p>Mã đơn sẽ được tạo khi xác nhận thanh toán</p>
              </div>
            </div>

            <div className="checkout-lines">
              <div>
                <span>Giá gốc</span>
                <strong>{formatDemoPrice(order.subtotal)}</strong>
              </div>
              <div>
                <span>Ưu đãi khóa học</span>
                <strong>-{formatDemoPrice(order.discount)}</strong>
              </div>
              <div>
                <span>Phí nền tảng</span>
                <strong>{formatDemoPrice(0)}</strong>
              </div>
            </div>

            <div className="checkout-total">
              <span>Tổng thanh toán</span>
              <strong>{formatDemoPrice(order.total)}</strong>
            </div>

            <div className="payment-method-list" role="radiogroup" aria-label="Phương thức thanh toán">
              <label className="payment-method selected">
                <input type="radio" name="provider" defaultChecked />
                <span>
                  <b>Mock Payment</b>
                  <small>Thanh toán mô phỏng</small>
                </span>
              </label>
              <label className="payment-method">
                <input type="radio" name="provider" disabled />
                <span>
                  <b>VNPay Sandbox</b>
                  <small>Sẽ kích hoạt ở tuần 9</small>
                </span>
              </label>
            </div>

            {error && <p className="checkout-error">{getErrorMessage(error)}</p>}

            <button
              className="button button-primary checkout-submit"
              onClick={handleCheckout}
              disabled={submitting}
            >
              {submitting ? 'Đang tạo giao dịch...' : 'Tiếp tục thanh toán'}{' '}
              <Icon name="arrow" size={17} />
            </button>
            <Link className="button button-outline checkout-secondary" to={ROUTES.PAYMENT_HISTORY}>
              Xem lịch sử thanh toán
            </Link>
            <Link className="button button-outline checkout-secondary" to="/#courses">
              Chọn khóa học khác
            </Link>

            <p className="payment-safe-note">
              <Icon name="shield" size={16} />
              Bạn sẽ được chuyển sang màn mô phỏng để chọn kết quả thanh toán.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
