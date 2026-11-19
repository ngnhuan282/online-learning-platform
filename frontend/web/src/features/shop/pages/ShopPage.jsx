import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AcUnitRounded,
  DiamondRounded,
  Inventory2Outlined,
  ShoppingBagOutlined,
  CheckRounded,
  GridViewRounded,
  WallpaperOutlined,
  FilterFramesOutlined,
  AddCircleOutlineRounded,
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

const TOPUP_PACKAGES = [
  { code: 'GEM_50',   gems: 50,   price: 0,     label: 'Mien phi',   badge: '\uD83C\uDF81 Demo',      color: '#22c55e' },
  { code: 'GEM_200',  gems: 200,  price: 19000, label: '19.000 \u20AB', badge: null,            color: '#24b8ec' },
  { code: 'GEM_500',  gems: 500,  price: 45000, label: '45.000 \u20AB', badge: '\uD83D\uDD25 Ph\u1ED5 bi\u1EBFn', color: '#a855f7' },
  { code: 'GEM_1200', gems: 1200, price: 99000, label: '99.000 \u20AB', badge: '\uD83D\uDC8E T\u1ED1t nh\u1EA5t', color: '#f59e0b' },
];

export default function ShopPage() {
  useLocale();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const load = useCallback(options => shopApi.state(options), []);
  const resource = useLearningResource(load, null);
  const mutation = useWorkspaceMutation();
  const [tab, setTab] = useState(() => (searchParams.get('tab') === 'topup' ? 'topup' : 'shop'));
  const [category, setCategory] = useState('ALL');
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [notice, setNotice] = useState('');
  const [topupBusy, setTopupBusy] = useState(false);

  useEffect(() => {
    if (searchParams.get('tab') === 'topup') setTab('topup');
  }, [searchParams]);

  const data = resource.data;
  const freeze = data?.items.find(item => item.itemType === 'FREEZE');
  const items =
    data?.items.filter(
      item =>
        item.itemType !== 'FREEZE' &&
        (tab === 'shop' ? item.active !== false : item.owned) &&
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
        setNotice('\u0110\u00E3 mua th\u00E0nh c\u00F4ng! V\u1EADt ph\u1EA9m \u0111\u00E3 c\u00F3 trong kho \u0111\u1ED3.');
        resource.reload();
      },
    );
  }
  function equip(item) {
    setNotice('');
    mutation.run(
      () => shopApi.equip(item.itemType, item.equipped ? null : item.code),
      () => {
        setNotice(item.equipped ? '\u0110\u00E3 th\u00E1o v\u1EADt ph\u1EA9m.' : '\u0110\u00E3 trang b\u1ECB v\u1EADt ph\u1EA9m!');
        resource.reload();
      },
    );
  }
  function handleTopUp(pkg) {
    if (pkg.price === 0) {
      // Free package: direct topup (demo)
      setNotice('');
      setTopupBusy(true);
      shopApi.topUp({ gems: pkg.gems, packageCode: pkg.code, amount: 0, paymentMethod: 'MOCK' })
        .then(() => {
          setNotice(`Đã nhận ${pkg.gems} kim cương! 💎`);
          resource.reload();
        })
        .catch(() => setNotice('Nhận gem thất bại, vui lòng thử lại.'))
        .finally(() => setTopupBusy(false));
    } else {
      // Paid package: go through payment flow
      navigate(`/payment/gem-checkout?package=${pkg.code}`);
    }
  }

  return (
    <section className="shop-workspace container">
      <header className="shop-heading">
        <div>
          <span className="eyebrow">ChitChatGo · COLLECT</span>
          <h1>{t('C\u1EEDa h\u00E0ng')}</h1>
          <p>{t('H\u1ECDc \u0111\u1EC1u m\u1ED7i ng\u00E0y \u0111\u1EC3 thu th\u1EADp kim c\u01B0\u01A1ng v\u00E0 m\u1EDF kh\u00F3a nh\u1EEFng v\u1EADt ph\u1EA9m y\u00EAu th\u00EDch.')}</p>
        </div>
        {data && (
          <span className="shop-wallet" aria-label={t('S\u1ED1 d\u01B0 kim c\u01B0\u01A1ng')}>
            <DiamondRounded />
            {number(data.gems)}
          </span>
        )}
      </header>

      <div className="shop-tabs" role="tablist" aria-label={t('C\u1EEDa h\u00E0ng v\u00E0 kho \u0111\u1ED3')}>
        {[
          ['shop', ShoppingBagOutlined, 'C\u1EEDa h\u00E0ng'],
          ['inventory', Inventory2Outlined, 'Kho \u0111\u1ED3'],
          ['topup', AddCircleOutlineRounded, 'N\u1EA1p Gem'],
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

          {/* ── NAP GEM TAB ── */}
          {tab === 'topup' && (
            <div className="topup-panel">
              <div className="topup-header">
                <div className="topup-header-icon">
                  <DiamondRounded />
                </div>
                <div className="topup-header-text">
                  <h2>{t('N\u1EA1p Kim C\u01B0\u01A1ng')}</h2>
                  <p>{t('Ch\u1ECDn g\u00F3i kim c\u01B0\u01A1ng ph\u00F9 h\u1EE3p v\u1EDBi b\u1EA1n. Kim c\u01B0\u01A1ng d\u00F9ng \u0111\u1EC3 mua v\u1EADt ph\u1EA9m trong c\u1EEDa h\u00E0ng.')}</p>
                </div>
                <span className="shop-wallet" aria-label={t('S\u1ED1 d\u01B0')}>
                  <DiamondRounded />
                  {number(data.gems)}
                </span>
              </div>

              {notice && (
                <p className="shop-notice" role="status">
                  <CheckRounded fontSize="small" />
                  {notice}
                </p>
              )}

              <div className="topup-grid">
                {TOPUP_PACKAGES.map(pkg => (
                  <article key={pkg.code} className="topup-card" style={{ '--topup-color': pkg.color }}>
                    {pkg.badge && <span className="topup-badge">{pkg.badge}</span>}
                    <div className="topup-gem-icon">
                      <DiamondRounded />
                    </div>
                    <div className="topup-gems">{number(pkg.gems)}</div>
                    <div className="topup-unit">{t('Kim c\u01B0\u01A1ng')}</div>
                    <div className="topup-price">{pkg.price === 0 ? t('Mi\u1EC5n ph\u00ED') : pkg.label}</div>
                    <button
                      className="shop-button topup-btn"
                      disabled={topupBusy}
                      onClick={() => handleTopUp(pkg)}
                    >
                      {pkg.price === 0 ? t('Nh\u1EADn ngay') : t('N\u1EA1p ngay')}
                    </button>
                  </article>
                ))}
              </div>

              <p className="topup-note">
                {t('\u0110\u00E2y l\u00E0 giao d\u1ECBch m\u00F4 ph\u1ECFng (demo). Kim c\u01B0\u01A1ng s\u1EBD \u0111\u01B0\u1EE3c c\u1ED9ng ngay v\u00E0o t\u00E0i kho\u1EA3n.')}
              </p>
            </div>
          )}

          {/* ── SHOP / INVENTORY TABS ── */}
          {tab !== 'topup' && (
            <>
              {tab === 'inventory' && <ProfileAppearance compact />}
              {freeze && (
                <article className="freeze-banner">
                  <span className="freeze-icon">
                    <AcUnitRounded />
                  </span>
                  <div className="freeze-description">
                    <h2>{t('B\u1EA3o v\u1EC7 chu\u1ED7i ng\u00E0y h\u1ECDc')}</h2>
                    <p>
                      {t(
                        'T\u1EF1 \u0111\u1ED9ng d\u00F9ng 1 streak freeze cho m\u1ED7i ng\u00E0y b\u1ECF l\u1EE1. Chu\u1ED7i \u0111\u01B0\u1EE3c gi\u1EEF, kh\u00F4ng c\u1ED9ng th\u00EAm ng\u00E0y h\u1ECDc.',
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
                    {t(data.streakFreezes >= data.freezeCapacity ? '\u0110\u00E3 \u0111\u1EA7y' : 'Mua freeze')}
                  </button>
                </article>
              )}
              <p className="shop-earning">
                <DiamondRounded fontSize="small" />
                {t('Nh\u1EADn {gems} kim c\u01B0\u01A1ng cho ng\u00E0y h\u1ECDc \u0111\u1EA7u ti\u00EAn trong ng\u00E0y. Nh\u1EADn th\u00EAm ph\u1EA7n th\u01B0\u1EDFng t\u1EA1i', {
                  gems: data.dailyGems ?? 25,
                })}{' '}
                <Link to="/achievements">{t('Th\u00E0nh t\u00EDch h\u1ECDc t\u1EADp')}</Link>.
              </p>
              <div className="shop-filters" aria-label={t('Lo\u1EA1i v\u1EADt ph\u1EA9m')}>
                {[
                  ['ALL', GridViewRounded, 'T\u1EA5t c\u1EA3'],
                  ['FRAME', FilterFramesOutlined, 'Khung avatar'],
                  ['BACKGROUND', WallpaperOutlined, '\u1EA2nh n\u1EC1n'],
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
                  {notice}
                </p>
              )}
              {items.length === 0 && (
                <div className="shop-empty">
                  <Inventory2Outlined />
                  <h2>{t('Kho \u0111\u1ED3 \u0111ang tr\u1ED1ng')}</h2>
                  <p>{t('Gh\u00E9 c\u1EEDa h\u00E0ng \u0111\u1EC3 nh\u1EADn v\u1EADt ph\u1EA9m mi\u1EC5n ph\u00ED v\u00E0 ch\u1ECDn m\u00F3n \u0111\u1ED3 \u0111\u1EA7u ti\u00EAn c\u1EEDa b\u1EA1n.')}</p>
                  <button
                    className="shop-button"
                    onClick={() => {
                      setTab('shop');
                      setCategory('ALL');
                    }}
                  >
                    {t('Kh\u00E1m ph\u00E1 c\u1EEDa h\u00E0ng')}
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
                      style={
                        item.itemType === 'BACKGROUND'
                          ? appearanceBackground(item.code, item.assetKey)
                          : undefined
                      }
                    >
                      {item.itemType === 'FRAME' ? (
                        <LearnerAvatar
                          name={user?.fullName}
                          avatarUrl={user?.avatarUrl}
                          frame={item.code}
                          assetKey={item.assetKey}
                          size="large"
                        />
                      ) : (
                        <span className="background-preview-card">
                          <LearnerAvatar
                            name={user?.fullName}
                            avatarUrl={user?.avatarUrl}
                            frame={data.activeFrame}
                            assetKey={data.items.find(value => value.code === data.activeFrame)?.assetKey}
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
                        {t(item.equipped ? '\u0110ang d\u00F9ng \u00B7 Th\u00E1o' : 'Trang b\u1ECB')}
                      </button>
                    ) : (
                      <button
                        className="shop-button"
                        disabled={mutation.busy || data.gems < item.price}
                        onClick={() => choosePurchase(item)}
                      >
                        {t(
                          item.price === 0
                            ? 'Nh\u1EADn mi\u1EC5n ph\u00ED'
                            : data.gems < item.price
                              ? 'Ch\u01B0a \u0111\u1EE7 kim c\u01B0\u01A1ng'
                              : 'Mua',
                        )}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingPurchase)}
        title="X\u00E1c nh\u1EADn mua v\u1EADt ph\u1EA9m"
        description={
          pendingPurchase
            ? t('D\u00F9ng {price} kim c\u01B0\u01A1ng \u0111\u1EC3 nh\u1EADn {name}?', {
                price: number(pendingPurchase.item.price),
                name: t(pendingPurchase.item.nameKey),
              })
            : undefined
        }
        confirmLabel={t('X\u00E1c nh\u1EADn mua')}
        pending={mutation.busy}
        onClose={() => setPendingPurchase(null)}
        onConfirm={purchase}
      >
        <ActionError error={mutation.error} />
      </ConfirmDialog>
    </section>
  );
}
