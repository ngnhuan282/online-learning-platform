import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AcUnitRounded,
  DiamondRounded,
  Inventory2Outlined,
  ShoppingBagOutlined,
  CheckRounded,
  GridViewRounded,
  WallpaperOutlined,
  FilterFramesOutlined,
} from '@mui/icons-material';
import { shopApi } from '../api/shopApi';
import { appearanceBackground } from '../utils/shopAssets';
import ProfileAppearance from '../components/ProfileAppearance';
import useAuth from '../../auth/hooks/useAuth';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useWorkspaceMutation from '../../engagement/hooks/useWorkspaceMutation';
import { ActionError, WorkspaceState } from '../../engagement/components/WorkspaceUi';
import LearnerAvatar from '../../../shared/components/LearnerAvatar';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import '../styles/shop.css';

export default function ShopPage() {
  useLocale();
  const { user } = useAuth();
  const load = useCallback(options => shopApi.state(options), []);
  const resource = useLearningResource(load, null);
  const mutation = useWorkspaceMutation();
  const [tab, setTab] = useState('shop');
  const [category, setCategory] = useState('ALL');
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [notice, setNotice] = useState('');
  const data = resource.data;
  const freeze = data?.items.find(item => item.itemType === 'FREEZE');
  const items =
    data?.items.filter(
      item =>
        item.itemType !== 'FREEZE' &&
        (tab === 'shop' || item.owned) &&
        (category === 'ALL' || item.itemType === category),
    ) || [];
  const number = value => value.toLocaleString(getIntlLocale());
  function choosePurchase(item) {
    setNotice('');
    setPendingPurchase({ item, requestId: crypto.randomUUID() });
  }
  function purchase() {
    mutation.run(
      () => shopApi.purchase(pendingPurchase.item.code, pendingPurchase.requestId),
      () => {
        setPendingPurchase(null);
        setNotice('Đã mua thành công! Vật phẩm đã có trong kho đồ.');
        resource.reload();
      },
    );
  }
  function equip(item) {
    setNotice('');
    mutation.run(
      () => shopApi.equip(item.itemType, item.equipped ? null : item.code),
      () => {
        setNotice(item.equipped ? 'Đã tháo vật phẩm.' : 'Đã trang bị vật phẩm!');
        resource.reload();
      },
    );
  }
  return (
    <section className="shop-workspace container">
      <header className="shop-heading">
        <div>
          <span className="eyebrow">ChitChatGo · COLLECT</span>
          <h1>{t('Cửa hàng')}</h1>
          <p>{t('Học đều mỗi ngày để thu thập kim cương và mở khóa những vật phẩm yêu thích.')}</p>
        </div>
        {data && (
          <span className="shop-wallet" aria-label={t('Số dư kim cương')}>
            <DiamondRounded />
            {number(data.gems)}
          </span>
        )}
      </header>
      <div className="shop-tabs" role="tablist" aria-label={t('Cửa hàng và kho đồ')}>
        {[
          ['shop', ShoppingBagOutlined, 'Cửa hàng'],
          ['inventory', Inventory2Outlined, 'Kho đồ'],
        ].map(([value, Icon, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            aria-controls="shop-content"
            id={`tab-${value}`}
            onClick={() => setTab(value)}
          >
            <Icon fontSize="small" />
            {t(label)}
          </button>
        ))}
      </div>
      <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {data && !resource.error && (
        <div id="shop-content" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'inventory' && <ProfileAppearance compact />}
          {freeze && (
            <article className="freeze-banner">
              <span className="freeze-icon">
                <AcUnitRounded />
              </span>
              <div className="freeze-description">
                <h2>{t('Bảo vệ chuỗi ngày học')}</h2>
                <p>
                  {t(
                    'Tự động dùng 1 streak freeze cho mỗi ngày bỏ lỡ. Chuỗi được giữ, không cộng thêm ngày học.',
                  )}
                </p>
                <div className="freeze-details">
                  <span>
                    <AcUnitRounded fontSize="small" />
                    {data.streakFreezes} / {data.freezeCapacity}
                  </span>
                  <span>
                    <DiamondRounded fontSize="small" />
                    {number(freeze.price)}
                  </span>
                </div>
              </div>
              <button
                className="shop-button"
                disabled={
                  mutation.busy || data.gems < freeze.price || data.streakFreezes >= data.freezeCapacity
                }
                onClick={() => choosePurchase(freeze)}
              >
                <ShoppingBagOutlined fontSize="small" />
                {t(data.streakFreezes >= data.freezeCapacity ? 'Đã đầy' : 'Mua freeze')}
              </button>
            </article>
          )}
          <p className="shop-earning">
            <DiamondRounded fontSize="small" />
            {t('Nhận 25 kim cương cho ngày học đầu tiên trong ngày. Nhận thêm phần thưởng tại')}{' '}
            <Link to="/achievements">{t('Thành tích học tập')}</Link>.
          </p>
          <div className="shop-filters" aria-label={t('Loại vật phẩm')}>
            {[
              ['ALL', GridViewRounded, 'Tất cả'],
              ['FRAME', FilterFramesOutlined, 'Khung avatar'],
              ['BACKGROUND', WallpaperOutlined, 'Ảnh nền'],
            ].map(([value, Icon, label]) => (
              <button key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>
                <Icon fontSize="small" />
                {t(label)}
              </button>
            ))}
          </div>
          <ActionError error={mutation.error} />
          {notice && (
            <p className="shop-notice" role="status">
              <CheckRounded fontSize="small" />
              {t(notice)}
            </p>
          )}
          {items.length === 0 && (
            <div className="shop-empty">
              <Inventory2Outlined />
              <h2>{t('Kho đồ đang trống')}</h2>
              <p>{t('Ghé cửa hàng để nhận vật phẩm miễn phí và chọn món đồ đầu tiên của bạn.')}</p>
              <button
                className="shop-button"
                onClick={() => {
                  setTab('shop');
                  setCategory('ALL');
                }}
              >
                {t('Khám phá cửa hàng')}
              </button>
            </div>
          )}
          <div className="shop-grid">
            {items.map(item => (
              <article
                key={item.code}
                className={`shop-card rarity-${item.rarity.toLowerCase()} ${item.equipped ? 'is-equipped' : ''}`}
              >
                <div
                  className={`shop-item-preview ${item.itemType === 'BACKGROUND' ? 'is-background' : ''}`}
                  style={item.itemType === 'BACKGROUND' ? appearanceBackground(item.code) : undefined}
                >
                  {item.itemType === 'FRAME' ? (
                    <LearnerAvatar
                      name={user?.fullName}
                      avatarUrl={user?.avatarUrl}
                      frame={item.code}
                      size="large"
                    />
                  ) : (
                    <span className="background-preview-card">
                      <LearnerAvatar
                        name={user?.fullName}
                        avatarUrl={user?.avatarUrl}
                        frame={data.activeFrame}
                        size="medium"
                      />
                      <span>{user?.fullName}</span>
                    </span>
                  )}
                  <span className="shop-rarity">{item.rarity}</span>
                  {item.originalPrice > item.price && (
                    <span className="shop-discount">
                      -{Math.round((1 - item.price / item.originalPrice) * 100)}%
                    </span>
                  )}
                </div>
                <h2>{t(item.nameKey)}</h2>
                <div className="shop-price">
                  <DiamondRounded fontSize="small" />
                  <strong>{number(item.price)}</strong>
                  {item.originalPrice > item.price && <del>{number(item.originalPrice)}</del>}
                </div>
                {item.owned ? (
                  <button
                    className={`shop-button ${item.equipped ? 'equipped' : ''}`}
                    disabled={mutation.busy}
                    onClick={() => equip(item)}
                  >
                    {item.equipped && <CheckRounded fontSize="small" />}
                    {t(item.equipped ? 'Đang dùng · Tháo' : 'Trang bị')}
                  </button>
                ) : (
                  <button
                    className="shop-button"
                    disabled={mutation.busy || data.gems < item.price}
                    onClick={() => choosePurchase(item)}
                  >
                    {t(
                      item.price === 0
                        ? 'Nhận miễn phí'
                        : data.gems < item.price
                          ? 'Chưa đủ kim cương'
                          : 'Mua',
                    )}
                  </button>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingPurchase)}
        title="Xác nhận mua vật phẩm"
        description={
          pendingPurchase
            ? t('Dùng {price} kim cương để nhận {name}?', {
                price: number(pendingPurchase.item.price),
                name: t(pendingPurchase.item.nameKey),
              })
            : undefined
        }
        confirmLabel={t('Xác nhận mua')}
        pending={mutation.busy}
        onClose={() => setPendingPurchase(null)}
        onConfirm={purchase}
      >
        <ActionError error={mutation.error} />
      </ConfirmDialog>
    </section>
  );
}
