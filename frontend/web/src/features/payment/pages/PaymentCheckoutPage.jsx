import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppLoading from '../../../shared/components/AppLoading';
import Skeleton from '@mui/material/Skeleton';
import ErrorState from '../../../shared/components/ErrorState';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import { courseApi } from '../../courses/api/courseApi';
import { paymentApi } from '../api/paymentApi';
import { getCheckoutErrorMessage, readCheckoutRedirect } from '../utils/paymentFlow';
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

  useEffect(() => {
    if (!validCourseId) return;
    idempotencyKey.current = crypto.randomUUID();
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
      <section className="workspace-scope payment-page payment-checkout-page">
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
      <section className="workspace-scope payment-page payment-checkout-page">
        <div className="container checkout-state-panel">
          <div
            className="payment-panel workspace-skeleton"
            role="status"
            aria-label="Đang tải thông tin khóa học"
          >
            <Skeleton variant="rounded" height={240} />
            <Skeleton height={48} />
            <Skeleton width="70%" height={32} />
          </div>
        </div>
      </section>
    );
  }

  if (courseState.error || !courseState.course) {
    return (
      <section className="workspace-scope payment-page payment-checkout-page">
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
  const selectedMethod = methodState.methods.find(method => method.provider === provider);
  const canCheckout = !methodState.loading && !methodState.error && selectedMethod?.available === true;

  const handleCheckout = async () => {
    if (submitting || !canCheckout) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await paymentApi.createCheckout({
        courseId: course.id,
        provider,
        idempotencyKey: idempotencyKey.current,
        returnUrl: `${window.location.origin}${ROUTES.PAYMENT_RESULT}`,
        cancelUrl: `${window.location.origin}${ROUTES.CHECKOUT}?course=${encodeURIComponent(course.id)}`,
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
            <span className="workspace-kicker">Sẵn sàng cho bài học tiếp theo</span>
            <h1>Thanh toán khóa học</h1>
            <p>Kiểm tra thông tin khóa học và chọn phương thức thanh toán.</p>
          </div>
          <Link className="button button-outline checkout-back" to={`${ROUTES.COURSES}/${course.id}`}>
            <span aria-hidden="true">←</span> Quay lại khóa học
          </Link>
        </div>

        <ol className="checkout-steps" aria-label="Các bước thanh toán">
          <li className="is-current" aria-current="step">
            <span>1</span> Kiểm tra đơn hàng
          </li>
          <li>
            <span>2</span> Thanh toán qua VNPay
          </li>
          <li>
            <span>3</span> Bắt đầu học
          </li>
        </ol>

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
                  Các phương thức thử nghiệm không phát sinh thanh toán bằng tiền thật.
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
              {methodState.loading && <AppLoading label="Đang tải phương thức thanh toán..." />}
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
                      <b>{method.label}</b>
                      <small>{method.description}</small>
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
                  Hiện chưa có phương thức thanh toán khả dụng. Vui lòng thử lại sau.
                </p>
              )}

            {methodState.error && (
              <ErrorState
                error={methodState.error}
                title="Không thể tải phương thức thanh toán"
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
              {submitting ? 'Đang tạo giao dịch...' : error ? 'Thử lại thanh toán' : 'Tiếp tục thanh toán'}{' '}
              <Icon name="arrow" size={17} />
            </button>
            <Link className="button button-outline checkout-secondary" to={ROUTES.PAYMENT_HISTORY}>
              Xem lịch sử thanh toán
            </Link>
            <Link className="checkout-other-link" to={ROUTES.COURSES}>
              Chọn khóa học khác
            </Link>

            <p className="payment-safe-note">
              <Icon name="shield" size={16} />
              {provider === 'VNPAY'
                ? 'Bạn sẽ được chuyển tới VNPay Sandbox để hoàn tất thanh toán thử nghiệm.'
                : 'Bạn sẽ được chuyển sang màn mô phỏng để chọn kết quả thanh toán.'}
            </p>
          </aside>
        </div>
      </div>
    </section>
  );
}
