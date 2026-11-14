import { ROUTES } from '../../../shared/constants/routes.js';

export function getPaymentDisplayStatus(order, now = Date.now()) {
  const status = order.payment?.status ?? order.paymentStatus ?? order.status;
  const provider = order.payment?.provider ?? order.provider;
  const orderStatus = order.payment ? order.status : order.orderStatus;
  const expiry = Date.parse(order.expiresAt);
  if (
    status === 'PENDING' &&
    provider === 'VNPAY' &&
    (orderStatus === 'EXPIRED' || (Number.isFinite(expiry) && expiry <= now))
  ) {
    return 'EXPIRED';
  }
  return status;
}

export function readCheckoutRedirect(value, provider, origin) {
  const url = new URL(value, origin);
  const trusted =
    provider === 'VNPAY'
      ? (url.origin === 'https://sandbox.vnpayment.vn' && url.pathname === '/paymentv2/vpcpay.html') ||
        (url.origin === 'https://pay.vnpay.vn' && url.pathname === '/vpcpay.html')
      : url.origin === origin && url.pathname === ROUTES.PAYMENT_MOCK;
  if (!trusted || url.username || url.password) {
    throw new Error('Không thể mở cổng thanh toán. Vui lòng thử lại sau.');
  }
  return url;
}

export function getResumePaymentUrl(order, origin, now = Date.now()) {
  if (order.payment?.status !== 'PENDING') return null;
  if (getPaymentDisplayStatus(order, now) === 'EXPIRED') return null;
  if (order.payment.provider === 'VNPAY') {
    const expiry = Date.parse(order.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now || !order.payment.checkoutUrl) return null;
    try {
      const url = readCheckoutRedirect(order.payment.checkoutUrl, 'VNPAY', origin);
      return url.searchParams.get('vnp_TxnRef') === order.orderCode ? url.toString() : null;
    } catch {
      return null;
    }
  }
  return `${ROUTES.PAYMENT_MOCK}?orderCode=${encodeURIComponent(order.orderCode)}&returnUrl=${encodeURIComponent(`${origin}${ROUTES.PAYMENT_RESULT}`)}`;
}

export function needsPaymentRefresh(order) {
  return (
    order.payment?.provider === 'VNPAY' &&
    (order.payment.status === 'PENDING' ||
      (order.payment.status === 'SUCCESS' && order.payment.enrollmentReady === false))
  );
}

export function getCheckoutErrorMessage(error) {
  if (error?.code === 'COURSE_ALREADY_PURCHASED') {
    return 'Bạn đã thanh toán khóa học này. Vui lòng xem lịch sử thanh toán để vào học hoặc kích hoạt lại quyền học; không cần thanh toán thêm.';
  }
  if (error?.code === 'CHECKOUT_EXPIRED') {
    return 'Đơn này đã hết hạn thanh toán. Vui lòng kiểm tra lịch sử trước khi tạo giao dịch mới.';
  }
  if (error?.code === 'VNPAY_UNAVAILABLE') {
    return 'VNPay hiện chưa sẵn sàng. Bạn có thể chọn phương thức khác hoặc thử lại sau.';
  }
  if (error?.status === 409 || error?.code === 'CONFLICT') {
    return 'Thông tin giao dịch đã thay đổi. Vui lòng kiểm tra lịch sử thanh toán trước khi thử lại.';
  }
  if (error?.status === 503 || error?.code === 'SERVICE_UNAVAILABLE') {
    return 'Dịch vụ thanh toán tạm thời chưa sẵn sàng. Vui lòng thử lại sau.';
  }
  return error?.message || 'Không thể tạo giao dịch. Vui lòng thử lại.';
}
