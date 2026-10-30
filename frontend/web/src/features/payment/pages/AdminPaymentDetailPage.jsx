import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, MenuItem, TextField } from '@mui/material';
import {
  AccountBalanceWalletOutlined,
  ArrowBack,
  HistoryOutlined,
  Refresh,
  SaveOutlined,
  TaskAlt,
} from '@mui/icons-material';
import useAuth from '../../auth/hooks/useAuth';
import { PageHeading, StatCard, LoadState } from '../../admin/components/AdminUi';
import { date, money, number } from '../../admin/utils/adminUtils';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import useToast from '../../../shared/hooks/useToast';
import { paymentApi } from '../api/paymentApi';
import { getPaymentDisplayStatus } from '../utils/paymentFlow';
import '../styles/payment-admin.css';

const paymentStatuses = {
  EXPIRED: 'Hết hạn thanh toán',
  PENDING: 'Đang chờ',
  SUCCESS: 'Thành công',
  FAILED: 'Thất bại',
  CANCELLED: 'Đã hủy',
  REFUNDED: 'Hoàn tiền',
};

const orderStatuses = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn',
};

const eventLabels = {
  CREATED: 'Tạo giao dịch',
  PROVIDER_REQUESTED: 'Gửi sang cổng thanh toán',
  PROVIDER_RETURNED: 'Người dùng quay lại',
  PROVIDER_CALLBACK: 'Nhận xác nhận từ cổng thanh toán',
  STATUS_CHANGED: 'Cập nhật trạng thái',
};

function statusTone(status) {
  if (status === 'SUCCESS' || status === 'PAID') return 'green';
  if (status === 'FAILED' || status === 'CANCELLED') return 'red';
  if (status === 'REFUNDED') return 'purple';
  return 'amber';
}

function currency(amount, code) {
  return code === 'VND' || !code ? money(amount) : `${number(amount)} ${code}`;
}

function displayDate(value) {
  return value ? date(value) : 'Chưa có';
}

function getStatusConfirmCopy(status, orderCode, amount) {
  if (status === 'SUCCESS') {
    return {
      title: 'Xác nhận thanh toán thành công',
      description: `Bạn sắp ghi nhận giao dịch ${orderCode} đã thanh toán thành công với số tiền ${amount}. Hãy kiểm tra lại trước khi xác nhận.`,
      confirmLabel: 'Xác nhận thành công',
      destructive: false,
    };
  }
  if (status === 'FAILED') {
    return {
      title: 'Xác nhận giao dịch thất bại',
      description: `Bạn sắp đánh dấu giao dịch ${orderCode} là thất bại. Sau khi xác nhận, giao dịch sẽ được đóng theo trạng thái này.`,
      confirmLabel: 'Xác nhận thất bại',
      destructive: true,
    };
  }
  if (status === 'CANCELLED') {
    return {
      title: 'Xác nhận hủy giao dịch',
      description: `Bạn sắp hủy giao dịch ${orderCode}. Sau khi xác nhận, giao dịch sẽ được đóng theo trạng thái này.`,
      confirmLabel: 'Xác nhận hủy',
      destructive: true,
    };
  }
  if (status === 'REFUNDED') {
    return {
      title: 'Xác nhận hoàn tiền',
      description: `Bạn sắp chuyển giao dịch ${orderCode} sang trạng thái Hoàn tiền với số tiền ${amount}. Sau khi xác nhận, giao dịch sẽ được đóng và không thể chuyển sang trạng thái khác.`,
      confirmLabel: 'Xác nhận hoàn tiền',
      destructive: true,
    };
  }
  return {
    title: 'Xác nhận cập nhật trạng thái',
    description: `Bạn sắp chuyển giao dịch ${orderCode} sang trạng thái ${paymentStatuses[status] || status}.`,
    confirmLabel: 'Xác nhận cập nhật',
    destructive: false,
  };
}

export default function AdminPaymentDetailPage() {
  const { orderCode } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState({ status: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState(null);
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false);
  const isAdmin = Boolean(user?.roles?.includes('ADMIN'));

  useEffect(() => {
    let active = true;
    paymentApi
      .getAdminOrder(orderCode)
      .then(response => {
        if (active) setState({ loading: false, data: response.data, error: null });
      })
      .catch(error => {
        if (active) setState(current => ({ ...current, loading: false, error }));
      });
    return () => {
      active = false;
    };
  }, [orderCode, retry]);

  const order = state.data?.order;
  const payment = order?.payment;
  const isVnpay = payment?.provider === 'VNPAY';
  const transactions = state.data?.transactions || [];
  const availableStatuses = state.data?.availableStatuses || [];
  const selectedStatus = availableStatuses.includes(form.status) ? form.status : availableStatuses[0] || '';
  const needsFailureReason = selectedStatus === 'FAILED' || selectedStatus === 'CANCELLED';
  const needsRefundConfirmation = selectedStatus === 'REFUNDED';
  const statusConfirmCopy = getStatusConfirmCopy(
    selectedStatus,
    order?.orderCode || orderCode,
    currency(order?.totalAmount, order?.currency),
  );

  function refreshDetail() {
    setState(current => ({ ...current, loading: true, error: null }));
    setRetry(value => value + 1);
  }

  function submitStatusUpdate(event) {
    event.preventDefault();
    if (!selectedStatus || busy) return;
    setStatusConfirmOpen(true);
  }

  async function updateStatus() {
    if (!selectedStatus || busy) return;
    setBusy(true);
    setMutationError(null);
    try {
      const payload = {
        status: selectedStatus,
        failureMessage: needsFailureReason ? form.note.trim() || undefined : undefined,
      };
      const response = await paymentApi.updateAdminOrderStatus(orderCode, payload);
      setState({ loading: false, data: response.data, error: null });
      setForm({ status: '', note: '' });
      setStatusConfirmOpen(false);
      toast('Đã cập nhật trạng thái giao dịch.');
    } catch (error) {
      setStatusConfirmOpen(false);
      setMutationError(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-scope admin-payment-workspace admin-payment-detail-workspace">
      <span className="workspace-kicker">Chi tiết thanh toán</span>
      <PageHeading
        title="Chi tiết giao dịch thanh toán"
        description={orderCode ? `Theo dõi toàn bộ thông tin xử lý của giao dịch ${orderCode}.` : ''}
      >
        <Button component={Link} to="/admin/payments" variant="outlined" startIcon={<ArrowBack />}>
          Về danh sách
        </Button>
        <Button variant="outlined" startIcon={<Refresh />} disabled={state.loading} onClick={refreshDetail}>
          Làm mới
        </Button>
      </PageHeading>

      <LoadState loading={state.loading} error={state.error} retry={refreshDetail} />
      {!state.loading && !state.error && order && (
        <>
          <div className="admin-stats">
            <StatCard
              title="SỐ TIỀN"
              value={currency(order.totalAmount, order.currency)}
              detail="Giá trị giao dịch tại thời điểm thanh toán"
              icon={<AccountBalanceWalletOutlined />}
            />
            <StatCard
              title="TRẠNG THÁI THANH TOÁN"
              value={paymentStatuses[getPaymentDisplayStatus(order)] || payment?.status || '—'}
              detail={`Đơn hàng: ${orderStatuses[order.status] || order.status}`}
              icon={<TaskAlt />}
              tone={statusTone(payment?.status)}
            />
            <StatCard
              title="MÃ HỌC VIÊN"
              value={`#${order.userId}`}
              detail={`Tạo giao dịch lúc ${date(order.createdAt)}`}
              icon={<HistoryOutlined />}
              tone="cyan"
            />
          </div>

          <div
            className={`admin-payment-detail-grid${isVnpay ? ' admin-payment-detail-grid--readonly' : ''}`}
          >
            <section className="admin-card">
              <div className="admin-card-heading">
                <div>
                  <h2>Thông tin giao dịch</h2>
                  <p>Mã giao dịch, cổng thanh toán và thời gian xử lý.</p>
                </div>
              </div>
              <dl className="admin-detail-list">
                <div>
                  <dt>Mã giao dịch</dt>
                  <dd>{order.orderCode}</dd>
                </div>
                <div>
                  <dt>Cổng thanh toán</dt>
                  <dd>{payment?.provider || 'MOCK'}</dd>
                </div>
                <div>
                  <dt>Mã từ cổng thanh toán</dt>
                  <dd>{payment?.providerTransactionCode || 'Chưa có'}</dd>
                </div>
                <div>
                  <dt>Hoàn tất lúc</dt>
                  <dd>{displayDate(payment?.paidAt)}</dd>
                </div>
                {payment?.provider === 'VNPAY' && (
                  <div>
                    <dt>Thời hạn thanh toán</dt>
                    <dd>{displayDate(order.expiresAt)}</dd>
                  </div>
                )}
                <div>
                  <dt>Cập nhật gần nhất</dt>
                  <dd>
                    {displayDate(
                      Date.parse(order.updatedAt) > Date.parse(payment?.updatedAt)
                        ? order.updatedAt
                        : payment?.updatedAt || order.updatedAt,
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            {!isVnpay && (
              <section className="admin-card">
                <div className="admin-card-heading">
                  <div>
                    <h2>Cập nhật trạng thái</h2>
                    <p>Chọn trạng thái tiếp theo phù hợp với giao dịch này.</p>
                  </div>
                </div>
                {!isAdmin ? (
                  <Alert severity="info">
                    Bạn có thể xem giao dịch. Chỉ tài khoản ADMIN mới được cập nhật trạng thái thanh toán.
                  </Alert>
                ) : availableStatuses.length === 0 ? (
                  <Alert severity="success">Giao dịch này đã hoàn tất xử lý.</Alert>
                ) : (
                  <form className="admin-status-form" onSubmit={submitStatusUpdate}>
                    <LoadState error={mutationError} />
                    <TextField
                      select
                      required
                      label="Trạng thái mới"
                      value={selectedStatus}
                      onChange={event => setForm(current => ({ ...current, status: event.target.value }))}
                    >
                      {availableStatuses.map(status => (
                        <MenuItem key={status} value={status}>
                          {paymentStatuses[status] || status}
                        </MenuItem>
                      ))}
                    </TextField>
                    {needsFailureReason && (
                      <TextField
                        multiline
                        minRows={3}
                        label="Lý do thất bại/hủy"
                        value={form.note}
                        onChange={event => setForm(current => ({ ...current, note: event.target.value }))}
                        placeholder="Ví dụ: học viên hủy giao dịch hoặc thanh toán không thành công..."
                      />
                    )}
                    <Button variant="contained" type="submit" startIcon={<SaveOutlined />} disabled={busy}>
                      {busy
                        ? 'Đang cập nhật...'
                        : needsRefundConfirmation
                          ? 'Tiếp tục hoàn tiền'
                          : 'Cập nhật trạng thái'}
                    </Button>
                  </form>
                )}
              </section>
            )}
          </div>

          <section className="admin-card">
            <div className="admin-card-heading">
              <div>
                <h2>Khóa học trong giao dịch</h2>
                <p>Dữ liệu khóa học được lưu tại thời điểm học viên tạo thanh toán.</p>
              </div>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>KHÓA HỌC</th>
                    <th>GIÁ GỐC</th>
                    <th>GIẢM GIÁ</th>
                    <th>THÀNH TIỀN</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map(item => (
                    <tr key={item.courseId}>
                      <td>{item.courseTitle}</td>
                      <td>{currency(item.unitPrice, order.currency)}</td>
                      <td>{currency(item.discountAmount, order.currency)}</td>
                      <td>{currency(item.finalPrice, order.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="admin-card admin-table-card admin-payment-timeline">
            <div className="admin-card-heading">
              <div>
                <h2>Lịch sử xử lý</h2>
                <p>Các sự kiện được ghi nhận trong quá trình xử lý giao dịch.</p>
              </div>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>SỰ KIỆN</th>
                    <th>TRẠNG THÁI</th>
                    <th>MÃ THAM CHIẾU</th>
                    <th>SỐ TIỀN</th>
                    <th>THỜI GIAN</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(transaction => (
                    <tr key={transaction.id}>
                      <td>{eventLabels[transaction.eventType] || transaction.eventType}</td>
                      <td>
                        <span className={`admin-pill ${statusTone(transaction.status)}`}>
                          {paymentStatuses[transaction.status] || transaction.status}
                        </span>
                      </td>
                      <td>{transaction.providerTransactionCode || '—'}</td>
                      <td>{currency(transaction.amount, transaction.currency)}</td>
                      <td>{displayDate(transaction.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!transactions.length && <div className="admin-empty">Chưa có lịch sử xử lý.</div>}
            </div>
          </section>
        </>
      )}
      <ConfirmDialog
        open={statusConfirmOpen}
        title={statusConfirmCopy.title}
        description={statusConfirmCopy.description}
        confirmLabel={statusConfirmCopy.confirmLabel}
        destructive={statusConfirmCopy.destructive}
        pending={busy}
        onClose={() => setStatusConfirmOpen(false)}
        onConfirm={updateStatus}
      />
    </div>
  );
}
