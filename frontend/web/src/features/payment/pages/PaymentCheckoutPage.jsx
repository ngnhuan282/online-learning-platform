import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { buildOrderSnapshot, formatDemoPrice, getCheckoutCourse } from '../data/paymentDemo';
import '../styles/payment.css';

export default function PaymentCheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const course = getCheckoutCourse(params.get('course'));
  const order = buildOrderSnapshot(course);

  return (
    <section className="payment-page payment-checkout-page">
      <div className="container">
        <div className="payment-page-heading">
          <span className="eyebrow">PAYMENT FOUNDATION</span>
          <h1>Thanh toán khóa học</h1>
          <p>Hợp đồng checkout tuần 1, dùng dữ liệu khóa học hiện có và chưa gọi provider thật.</p>
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
                  Backend sẽ xác minh giá với Course Service ở D6.
                </li>
                <li>
                  <Icon name="check" size={18} />
                  Enrollment chỉ kích hoạt sau khi Payment SUCCESS.
                </li>
                <li>
                  <Icon name="check" size={18} />
                  VNPay Sandbox được tách sang D9.
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
                <p>Mã đơn dự kiến {order.orderCode}</p>
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
                  <small>Mô phỏng flow tuần 5</small>
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

            <button
              className="button button-primary checkout-submit"
              onClick={() => navigate(`${ROUTES.PAYMENT_RESULT}?status=success&course=${course.id}`)}
            >
              Thanh toán skeleton <Icon name="arrow" size={17} />
            </button>
            <Link className="button button-outline checkout-secondary" to="/#courses">
              Chọn khóa học khác
            </Link>

            <p className="payment-safe-note">
              <Icon name="shield" size={16} />
              FE không gửi amount/status. Giá trị này chỉ là UI skeleton cho hợp đồng D1.
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
