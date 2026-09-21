import Icon from '../../../shared/components/Icon';
import { analyticsCards, formatDemoPrice, recentTransactions, revenueBars } from '../data/paymentDemo';
import '../styles/payment.css';

const statusLabel = {
  SUCCESS: 'Thành công',
  PENDING: 'Đang chờ',
  FAILED: 'Thất bại',
};

export default function AdminAnalyticsPage() {
  return (
    <section className="payment-page admin-analytics-page">
      <div className="container">
        <div className="payment-page-heading admin-heading">
          <div>
            <span className="eyebrow">ADMIN ANALYTICS</span>
            <h1>Payment analytics skeleton</h1>
            <p>Dashboard UI tuần 1 cho doanh thu, giao dịch và trạng thái thanh toán.</p>
          </div>
          <button className="button button-outline" type="button">
            Xuất báo cáo <Icon name="arrow" size={16} />
          </button>
        </div>

        <div className="analytics-card-grid">
          {analyticsCards.map(card => (
            <article className="analytics-card" key={card.label}>
              <span className={`feature-icon ${card.tone}`}>
                <Icon name={card.tone === 'blue' ? 'chart' : 'shield'} size={20} />
              </span>
              <p>{card.label}</p>
              <strong>{card.value}</strong>
              <small>{card.helper}</small>
            </article>
          ))}
        </div>

        <div className="admin-analytics-grid">
          <article className="payment-panel revenue-panel">
            <div className="payment-panel-title">
              <span className="feature-icon blue">
                <Icon name="chart" size={20} />
              </span>
              <div>
                <h2>Doanh thu theo tháng</h2>
                <p>Placeholder chart, sẽ nối aggregate API ở D3.</p>
              </div>
            </div>
            <div className="revenue-bars" aria-label="Biểu đồ doanh thu theo tháng">
              {revenueBars.map(item => (
                <div className="revenue-bar" key={item.label}>
                  <span style={{ height: `${item.value}%` }} />
                  <small>{item.label}</small>
                </div>
              ))}
            </div>
          </article>

          <article className="payment-panel admin-contract-panel">
            <div className="payment-panel-title">
              <span className="feature-icon green">
                <Icon name="check" size={20} />
              </span>
              <div>
                <h2>Contract checkpoints</h2>
                <p>Các ranh giới cần giữ khi triển khai payment core.</p>
              </div>
            </div>
            <ul className="payment-check-list">
              <li>
                <Icon name="check" size={18} />
                Payment Service lấy giá từ Course Service, không tin amount frontend.
              </li>
              <li>
                <Icon name="check" size={18} />
                Payment SUCCESS mới kích hoạt Enrollment qua Learning Service.
              </li>
              <li>
                <Icon name="check" size={18} />
                Admin route cần role ADMIN và response dùng envelope chung.
              </li>
            </ul>
          </article>
        </div>

        <article className="payment-panel transaction-panel">
          <div className="payment-panel-title">
            <span className="feature-icon purple">
              <Icon name="assignment" size={20} />
            </span>
            <div>
              <h2>Giao dịch gần đây</h2>
              <p>Dữ liệu minh họa cho wireframe quản trị giao dịch.</p>
            </div>
          </div>
          <div className="transaction-table-wrap">
            <table className="transaction-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Học viên</th>
                  <th>Khóa học</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map(transaction => (
                  <tr key={transaction.orderCode}>
                    <td>{transaction.orderCode}</td>
                    <td>{transaction.learner}</td>
                    <td>{transaction.course}</td>
                    <td>{formatDemoPrice(transaction.amount)}</td>
                    <td>
                      <span className={`payment-status ${transaction.status.toLowerCase()}`}>
                        {statusLabel[transaction.status]}
                      </span>
                    </td>
                    <td>{transaction.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}
