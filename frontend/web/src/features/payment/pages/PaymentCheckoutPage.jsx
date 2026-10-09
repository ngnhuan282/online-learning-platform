import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { getErrorMessage } from '../../../shared/utils/errorUtils';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import { courseApi } from '../../courses/api/courseApi';
import { paymentApi } from '../api/paymentApi';
import '../styles/payment.css';

function normalizeCourse(value) {
  const course = value?.data ?? value;
  if (!course || typeof course !== 'object') return null;
  return {
    id: Number(course.id),
    title: course.title,
    description: course.description,
    categoryName: course.categoryName || 'Khóa học Tiếng Anh',
    level: course.level || 'Chưa cập nhật',
    status: course.status,
    price: Number(course.price),
    originalPrice: Number(course.originalPrice ?? course.price),
    thumbnailUrl: course.thumbnailUrl || '/images/english-ielts.jpg',
  };
}

function unavailableCourseError() {
  return new Error('Khóa học này hiện không thể thanh toán. Vui lòng chọn khóa học khác.');
}

export default function PaymentCheckoutPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const courseId = Number(params.get('course'));
  const validCourseId = Number.isSafeInteger(courseId) && courseId > 0;
  const idempotencyKey = useRef(crypto.randomUUID());
  const [courseState, setCourseState] = useState({ courseId: null, course: null, error: null });
  const [courseRetry, setCourseRetry] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!validCourseId) return;
    let active = true;
    courseApi
      .getById(courseId)
      .then(response => {
        if (!active) return;
        const course = normalizeCourse(response?.data ?? response);
        const unavailable =
          !course || course.status !== 'PUBLISHED' || !Number.isFinite(course.price) || course.price <= 0;
        setCourseState({
          courseId,
          course: unavailable ? null : course,
          error: unavailable ? unavailableCourseError() : null,
        });
      })
      .catch(fetchError => {
        if (active) setCourseState({ courseId, course: null, error: fetchError });
      });
    return () => {
      active = false;
    };
  }, [courseId, validCourseId, courseRetry]);

  function retryCourseLoad() {
    setCourseState({ courseId: null, course: null, error: null });
    setCourseRetry(value => value + 1);
  }

  if (!validCourseId) {
    return (
      <section className="payment-page payment-checkout-page">
        <div className="container checkout-state-panel">
          <ErrorState error={unavailableCourseError()} title="Chưa chọn khóa học" />
          <Link className="button button-primary" to={ROUTES.COURSES}>
            Chọn khóa học
          </Link>
        </div>
      </section>
    );
  }

  const loading = courseState.courseId !== courseId;
  if (loading) {
    return (
      <section className="payment-page payment-checkout-page">
        <div className="container checkout-state-panel">
          <AppLoading label="Đang tải thông tin khóa học..." />
        </div>
      </section>
    );
  }

  if (courseState.error || !courseState.course) {
    return (
      <section className="payment-page payment-checkout-page">
        <div className="container checkout-state-panel">
          <ErrorState
            error={courseState.error}
            title="Không thể mở trang thanh toán"
            onRetry={retryCourseLoad}
          />
          <Link className="button button-primary" to={ROUTES.COURSES}>
            Chọn khóa học khác
          </Link>
        </div>
      </section>
    );
  }

  const course = courseState.course;
  const subtotal = Math.max(course.originalPrice || course.price, course.price);
  const discount = Math.max(subtotal - course.price, 0);

  const handleCheckout = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await paymentApi.createCheckout({
        courseId: course.id,
        provider: 'MOCK',
        idempotencyKey: idempotencyKey.current,
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
              <img src={resolveMediaUrl(course.thumbnailUrl)} alt={course.title} />
              <span>{course.categoryName}</span>
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
                  <dt>Danh mục</dt>
                  <dd>{course.categoryName}</dd>
                </div>
                <div>
                  <dt>Cấp độ</dt>
                  <dd>{course.level}</dd>
                </div>
                <div>
                  <dt>Trạng thái</dt>
                  <dd>Đang mở bán</dd>
                </div>
              </dl>

              <ul className="payment-check-list">
                <li>
                  <Icon name="check" size={18} />
                  Số tiền được xác nhận lại theo giá hiện tại của khóa học khi tạo giao dịch.
                </li>
                <li>
                  <Icon name="check" size={18} />
                  Thanh toán thành công sẽ tự động thêm khóa học vào khu học tập của bạn.
                </li>
                <li>
                  <Icon name="check" size={18} />
                  Cổng mô phỏng cho phép kiểm tra đầy đủ luồng thanh toán trước khi dùng VNPay.
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
                <strong>{formatCurrency(subtotal)}</strong>
              </div>
              <div>
                <span>Ưu đãi khóa học</span>
                <strong>-{formatCurrency(discount)}</strong>
              </div>
              <div>
                <span>Phí nền tảng</span>
                <strong>{formatCurrency(0)}</strong>
              </div>
            </div>

            <div className="checkout-total">
              <span>Tổng thanh toán</span>
              <strong>{formatCurrency(course.price)}</strong>
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
              {submitting
                ? 'Đang tạo giao dịch...'
                : error
                  ? 'Thử lại thanh toán'
                  : 'Tiếp tục thanh toán'}{' '}
              <Icon name="arrow" size={17} />
            </button>
            <Link className="button button-outline checkout-secondary" to={ROUTES.PAYMENT_HISTORY}>
              Xem lịch sử thanh toán
            </Link>
            <Link className="button button-outline checkout-secondary" to={ROUTES.COURSES}>
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
