import { useCallback, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckRounded,
  StarOutlineRounded,
  WorkspacePremiumOutlined,
  BoltOutlined,
  KeyOutlined,
} from '@mui/icons-material';
import { proApi } from '../api/proApi';
import usePro from '../hooks/usePro';
import ProMembershipCard from '../components/ProMembershipCard';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useWorkspaceMutation from '../../engagement/hooks/useWorkspaceMutation';
import { WorkspaceState } from '../../engagement/components/WorkspaceUi';
import { paymentApi } from '../../payment/api/paymentApi';
import { getCheckoutErrorMessage, readCheckoutRedirect } from '../../payment/utils/paymentFlow';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { formatCurrency } from '../../../shared/utils/formatCurrency';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { ROUTES } from '../../../shared/constants/routes';
import '../styles/pro.css';

const freeBenefits = [
  'Học các khóa miễn phí đã công bố',
  'Làm quiz và theo dõi tiến độ học tập',
  'Lưu tối đa 100 ghi chú từ vựng khi luyện thi TOEIC',
  'Chuỗi ngày học, XP, huy hiệu và cửa hàng',
  'Tham gia diễn đàn và bảng xếp hạng',
  'Chat AI với hạn mức theo ngày',
];
const proBenefits = [
  'Tất cả tính năng của gói Miễn phí',
  'Lưu không giới hạn ghi chú khi luyện thi TOEIC',
  'Học mọi khóa trả phí đang công bố trong thời hạn Pro',
  'Truy cập bài học, quiz và tài liệu của các khóa được mở',
  'Gia hạn cộng dồn vào thời gian Pro còn lại',
  'Giữ nguyên tiến độ khi gia hạn',
  'Kích hoạt bằng thanh toán hoặc mã Pro',
  'Chat AI với hạn mức cao hơn mỗi ngày',
];
const planLabel = plan =>
  !['PRO_MONTH', 'PRO_QUARTER', 'PRO_YEAR'].includes(plan.code)
    ? t(plan.name || plan.code)
    : plan.durationMonths === 12
      ? t('1 năm')
      : plan.durationMonths === 1
        ? t('1 tháng')
        : t('{months} tháng', { months: plan.durationMonths });
const codeMessages = {
  INVALID_ACTIVATION_CODE: 'Mã không hợp lệ, đã dùng, hết hạn hoặc đã bị thu hồi.',
  ACTIVATION_RATE_LIMITED: 'Bạn đã thử quá nhiều mã. Vui lòng thử lại sau 15 phút.',
};

export default function ProPage() {
  useLocale();
  const navigate = useNavigate();
  const { membership, refresh } = usePro();
  const load = useCallback(async options => {
    const [plans, methods] = await Promise.all([proApi.plans(options), paymentApi.getMethods()]);
    if (
      !Array.isArray(plans.data) ||
      !Array.isArray(methods.data) ||
      plans.data.some(
        plan =>
          !plan.code ||
          ![1, 3, 12].includes(plan.durationMonths) ||
          !Number.isFinite(Number(plan.price)) ||
          Number(plan.price) <= 0 ||
          plan.currency !== 'VND',
      )
    ) {
      throw new Error('Không thể tải danh sách gói Pro. Vui lòng thử lại.');
    }
    return { data: { plans: plans.data, methods: methods.data } };
  }, []);
  const resource = useLearningResource(load, null);
  const [selected, setSelected] = useState('PRO_YEAR');
  const [provider, setProvider] = useState('');
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
  const checkout = useWorkspaceMutation();
  const activation = useWorkspaceMutation();
  const intent = useRef(null);
  const plans = resource.data?.plans || [];
  const plan = plans.find(item => item.code === selected) || plans[0];
  const methods = (resource.data?.methods || []).filter(item => item.available);
  const selectedProvider = methods.some(item => item.provider === provider)
    ? provider
    : methods[0]?.provider || '';
  const busy = checkout.busy || activation.busy;
  const discount =
    plan && plan.originalPrice > plan.price ? Math.round((1 - plan.price / plan.originalPrice) * 100) : 0;

  function purchase() {
    const identity = `${plan.code}:${selectedProvider}`;
    if (intent.current?.identity !== identity) intent.current = { identity, key: crypto.randomUUID() };
    checkout.run(
      () =>
        paymentApi.createProCheckout({
          planCode: plan.code,
          provider: selectedProvider,
          idempotencyKey: intent.current.key,
          returnUrl: `${window.location.origin}${ROUTES.PAYMENT_RESULT}`,
          cancelUrl: `${window.location.origin}${ROUTES.PAYMENT_RESULT}`,
        }),
      response => {
        const url = readCheckoutRedirect(response.data.checkoutUrl, selectedProvider, window.location.origin);
        if (selectedProvider === 'VNPAY') window.location.assign(url.toString());
        else navigate(url.pathname + url.search);
      },
    );
  }
  function redeem(event) {
    event.preventDefault();
    setNotice('');
    activation.run(
      () => proApi.redeem(code.trim()),
      () => {
        setCode('');
        setNotice('Đã kích hoạt Pro thành công!');
        refresh();
      },
    );
  }

  return (
    <section className="pro-page container">
      <header className="pro-page-heading">
        <span className="eyebrow">ChitChatGo · PRO</span>
        <h1>{t('Chọn gói phù hợp với bạn')}</h1>
        <p>{t('Học tiếng Anh theo cách của bạn, mở rộng quyền học cùng Pro.')}</p>
      </header>
      <ProMembershipCard />
      <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {resource.data && !resource.error && (
        <div className="pro-pricing-grid">
          <article className="pro-plan-card free-plan">
            <div className="pro-plan-icon">
              <StarOutlineRounded />
            </div>
            <h2>{t('Miễn phí')}</h2>
            <p className="pro-plan-subtitle">{t('Hoàn hảo cho người mới bắt đầu')}</p>
            <strong className="pro-free-price">{t('Miễn phí')}</strong>
            <ul className="pro-benefits">
              {freeBenefits.map(benefit => (
                <li key={benefit}>
                  <CheckRounded />
                  {t(benefit)}
                </li>
              ))}
            </ul>
            <Link className="pro-primary-action free-action" to="/my-courses">
              {t('Tiếp tục học')}
            </Link>
          </article>
          <article className="pro-plan-card premium-plan">
            <span className="pro-plan-ribbon">{t('Mở rộng quyền học')}</span>
            <div className="pro-plan-icon">
              <WorkspacePremiumOutlined />
            </div>
            <h2>ChitChatGo Pro</h2>
            <p className="pro-plan-subtitle">{t('Chọn thời hạn phù hợp với bạn')}</p>
            <div className="pro-renewal-note">
              <BoltOutlined />
              {t('Học đều mỗi ngày · Gia hạn cộng dồn')}
            </div>
            <div className="pro-periods" aria-label={t('Thời hạn Pro')}>
              {plans.map(item => (
                <button
                  key={item.code}
                  type="button"
                  aria-pressed={plan?.code === item.code}
                  disabled={busy}
                  onClick={() => {
                    setSelected(item.code);
                    intent.current = null;
                  }}
                >
                  {planLabel(item)}
                </button>
              ))}
            </div>
            {plans.length === 0 && (
              <p className="pro-payment-unavailable">{t('Hiện chưa có gói Pro đang mở bán.')}</p>
            )}
            {plan && (
              <div className="pro-price-block">
                {discount > 0 && (
                  <del title={t('Chi phí khi mua từng tháng')}>{formatCurrency(plan.originalPrice)}</del>
                )}
                <div>
                  <strong>{formatCurrency(plan.price)}</strong>
                  {discount > 0 && (
                    <span className="pro-saving">{t('Tiết kiệm {percent}%', { percent: discount })}</span>
                  )}
                </div>
                <p>
                  {t('{price} / tháng', {
                    price: formatCurrency(Math.round(plan.price / plan.durationMonths)),
                  })}
                </p>
                <small>{t('Thanh toán một lần cho {period}', { period: planLabel(plan) })}</small>
              </div>
            )}
            <h3 className="pro-benefits-heading">{t('Quyền lợi Pro')}</h3>
            <ul className="pro-benefits">
              {proBenefits.map(benefit => (
                <li key={benefit}>
                  <CheckRounded />
                  {t(benefit)}
                </li>
              ))}
            </ul>
            <form className="pro-code-form" onSubmit={redeem}>
              <label htmlFor="pro-code">
                <KeyOutlined fontSize="small" />
                {t('Mã kích hoạt')}
              </label>
              <div>
                <input
                  id="pro-code"
                  autoComplete="off"
                  maxLength={64}
                  value={code}
                  onChange={event => setCode(event.target.value)}
                  placeholder={t('Nhập mã kích hoạt của bạn')}
                  disabled={busy}
                />
                <button type="submit" disabled={busy || !code.trim() || membership?.suspended}>
                  {activation.busy ? t('Đang xử lý…') : t('Kích hoạt')}
                </button>
              </div>
            </form>
            {activation.error && (
              <p className="workspace-error" role="alert">
                {t(codeMessages[activation.error.code] || 'Không thể kích hoạt Pro. Vui lòng thử lại.')}
              </p>
            )}
            {notice && (
              <p className="pro-success" role="status">
                {t(notice)}
              </p>
            )}
            {methods.length > 0 ? (
              <div className="pro-payment-method">
                <label htmlFor="pro-payment-provider">{t('Phương thức thanh toán')}</label>
                <select
                  id="pro-payment-provider"
                  value={selectedProvider}
                  disabled={busy}
                  onChange={event => {
                    setProvider(event.target.value);
                    intent.current = null;
                  }}
                >
                  {methods.map(method => (
                    <option key={method.provider} value={method.provider}>
                      {t(method.label)}
                    </option>
                  ))}
                </select>
                <small>
                  {t(methods.find(method => method.provider === selectedProvider)?.description || '')}
                </small>
              </div>
            ) : (
              <p className="pro-payment-unavailable">
                {t('Hiện chưa có phương thức thanh toán khả dụng. Bạn có thể sử dụng mã kích hoạt.')}
              </p>
            )}
            <button
              className="pro-primary-action"
              disabled={busy || !plan || !selectedProvider || membership?.suspended}
              onClick={() => setConfirm(true)}
            >
              {t(membership?.active ? 'Gia hạn Pro' : 'Đăng ký ngay')}
            </button>
          </article>
        </div>
      )}
      <div className="pro-faq">
        <h2>{t('Thông tin cần biết')}</h2>
        <details>
          <summary>{t('Khi Pro hết hạn thì sao?')}</summary>
          <p>
            {t('Quyền học qua Pro kết thúc khi gói hết hạn. Tiến độ được giữ để bạn tiếp tục khi gia hạn.')}
          </p>
        </details>
        <details>
          <summary>{t('Khóa đã mua riêng có bị ảnh hưởng không?')}</summary>
          <p>{t('Khóa đã mua riêng và khóa miễn phí vẫn giữ quyền truy cập độc lập với Pro.')}</p>
        </details>
        <details>
          <summary>{t('Gia hạn được tính như thế nào?')}</summary>
          <p>
            {t(
              'Gói mới cộng vào hạn Pro hiện tại nếu còn hiệu lực; nếu đã hết hạn, thời gian mới bắt đầu khi kích hoạt. Mỗi tháng tính theo lịch Việt Nam.',
            )}
          </p>
        </details>
      </div>
      <ConfirmDialog
        open={confirm}
        title="Xác nhận đăng ký Pro"
        description={
          plan
            ? t('Bạn chọn gói {period} với giá {price}. Thời gian được cộng vào hạn Pro còn lại nếu có.', {
                period: planLabel(plan),
                price: formatCurrency(plan.price),
              })
            : ''
        }
        confirmLabel={t('Tiếp tục thanh toán')}
        pending={checkout.busy}
        onClose={() => setConfirm(false)}
        onConfirm={purchase}
      >
        {checkout.error && (
          <p className="workspace-error" role="alert">
            {t(getCheckoutErrorMessage(checkout.error))}
          </p>
        )}
      </ConfirmDialog>
    </section>
  );
}
