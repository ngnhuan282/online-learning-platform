import { frameAssets, frameArt } from '../../features/shop/utils/shopAssets';
import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import './LearnerAvatar.css';

export default function LearnerAvatar({
  name,
  avatarUrl,
  frame,
  assetKey,
  level,
  size = 'medium',
  showLevel = false,
}) {
  useLocale();
  const asset = frameArt[assetKey] || frameAssets[frame];
  const initials =
    name
      ?.trim()
      .split(/\s+/)
      .slice(-2)
      .map(word => word[0])
      .join('')
      .toUpperCase() || 'U';
  const imageUrl = typeof avatarUrl === 'string' && /^https?:\/\//i.test(avatarUrl) ? avatarUrl : null;
  return (
    <span
      className={`learner-avatar avatar-size-${size} ${asset ? 'has-art-frame' : `ring-frame frame-${frame || 'default'}`}`}
      style={asset ? { '--portrait-y': asset.y, '--portrait-diameter': asset.diameter } : undefined}
    >
      <span className="learner-avatar-portrait">
        {initials}
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        )}
      </span>
      {asset && <img className="learner-avatar-art" src={asset.src} alt="" />}
      {showLevel && (
        <span className="learner-avatar-level" aria-label={t('Cấp độ {level}', { level: level ?? '—' })}>
          Lv.{level ?? '—'}
        </span>
      )}
    </span>
  );
}
