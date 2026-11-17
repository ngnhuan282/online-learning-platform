import CatMascot from '../../../shared/components/CatMascot';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';

export default function LoginCompanion({ focusedField, busy }) {
  useLocale();
  const expression = busy
    ? 'busy'
    : focusedField === 'password'
      ? 'shy'
      : focusedField === 'email'
        ? 'attentive'
        : 'welcome';
  const greeting = busy
    ? 'Chờ mình một chút nhé…'
    : expression === 'shy'
      ? 'Mình không nhìn đâu!'
      : expression === 'attentive'
        ? 'Sẵn sàng học cùng bạn!'
        : 'Chào bạn, lại gặp nhau rồi!';

  return (
    <aside className={`login-companion is-${expression}`} aria-label={t('Mèo đồng hành ChitChatGo')}>
      <div className="login-companion-bubble">{t(greeting)}</div>
      <div className="login-companion-art">
        <span className="login-companion-halo" aria-hidden="true" />
        <span className="login-companion-spark spark-one" aria-hidden="true">
          ✦
        </span>
        <span className="login-companion-spark spark-two" aria-hidden="true">
          ✧
        </span>
        <CatMascot />
        <span className="login-companion-shadow" aria-hidden="true" />
      </div>
      <p className="login-companion-caption">{t('Thêm một ngày học, thêm một chút tự tin.')}</p>
    </aside>
  );
}
