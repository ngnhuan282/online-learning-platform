import { useId, useRef, useState } from 'react';
import { ButtonBase, ListItemText, Menu, MenuItem } from '@mui/material';
import { CheckRounded, KeyboardArrowDownRounded } from '@mui/icons-material';
import useLocale from '../i18n/useLocale';
import { setLocale, t } from '../i18n/locale';
import './HeaderProgress.css';

const languages = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'English' },
];

function LanguageFlag({ locale }) {
  return locale === 'vi' ? (
    <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true">
      <path fill="#da251d" d="M0 0h30v20H0z" />
      <path fill="#ffdf00" d="m15 3 1.8 5.3h5.6l-4.5 3.3 1.7 5.3-4.6-3.3-4.6 3.3 1.7-5.3-4.5-3.3h5.6z" />
    </svg>
  ) : (
    <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true">
      <path fill="#253773" d="M0 0h30v20H0z" />
      <path stroke="#fff" strokeWidth="5" d="m0 0 30 20M30 0 0 20" />
      <path stroke="#d93846" strokeWidth="2" d="m0 0 30 20M30 0 0 20" />
      <path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30" />
      <path stroke="#d93846" strokeWidth="4" d="M15 0v20M0 10h30" />
    </svg>
  );
}

export default function LanguageSwitcher() {
  const locale = useLocale();
  const [anchor, setAnchor] = useState(null);
  const trigger = useRef(null);
  const restoreFocus = useRef(false);
  const id = useId();
  const open = Boolean(anchor);
  const current = languages.find(language => language.value === locale) || languages[0];

  return (
    <>
      <ButtonBase
        ref={trigger}
        id={`${id}-trigger`}
        className="language-picker language-switcher"
        aria-label={`${t('Ngôn ngữ')}: ${current.label}`}
        aria-haspopup="menu"
        aria-controls={open ? `${id}-menu` : undefined}
        aria-expanded={open}
        onClick={event => setAnchor(event.currentTarget)}
      >
        <LanguageFlag locale={locale} />
        <span className="language-label" lang={locale}>
          {current.label}
        </span>
        <KeyboardArrowDownRounded />
      </ButtonBase>
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={open}
        onClose={(_event, reason) => {
          restoreFocus.current = reason === 'escapeKeyDown';
          setAnchor(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          list: { 'aria-labelledby': `${id}-trigger` },
          paper: { className: 'language-menu-paper' },
          transition: {
            onExited: () => {
              if (restoreFocus.current) trigger.current?.focus();
              restoreFocus.current = false;
            },
          },
        }}
      >
        {languages.map(language => (
          <MenuItem
            key={language.value}
            lang={language.value}
            role="menuitemradio"
            aria-checked={locale === language.value}
            selected={locale === language.value}
            onClick={() => {
              setLocale(language.value);
              restoreFocus.current = true;
              setAnchor(null);
            }}
          >
            <LanguageFlag locale={language.value} />
            <ListItemText>{language.label}</ListItemText>
            {locale === language.value && <CheckRounded className="language-menu-check" />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
