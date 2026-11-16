import useAuth from '../../auth/hooks/useAuth';
import useEngagement from '../../engagement/hooks/useEngagement';
import LearnerAvatar from '../../../shared/components/LearnerAvatar';
import { appearanceBackground } from '../utils/shopAssets';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import '../styles/shop.css';

export default function ProfileAppearance({ compact = false, background, frame }) {
  useLocale();
  const { user } = useAuth();
  const { summary } = useEngagement();
  return (
    <div
      className={`profile-appearance ${compact ? 'compact' : ''}`}
      style={appearanceBackground(
        background ?? summary?.activeBackground,
        background == null || background === summary?.activeBackground
          ? summary?.activeBackgroundAssetKey
          : null,
      )}
    >
      <div className="profile-appearance-card">
        <LearnerAvatar
          name={user?.fullName}
          avatarUrl={user?.avatarUrl}
          frame={frame ?? summary?.activeFrame}
          assetKey={frame == null || frame === summary?.activeFrame ? summary?.activeFrameAssetKey : null}
          level={summary?.level}
          showLevel
          size={compact ? 'header' : 'large'}
        />
        <div>
          <strong>{user?.fullName}</strong>
          <span>{t('Góc học tập của bạn')}</span>
        </div>
      </div>
    </div>
  );
}
