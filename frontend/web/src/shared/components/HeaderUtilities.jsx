import { useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ButtonBase, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import {
  AutoAwesomeOutlined,
  ForumOutlined,
  KeyboardArrowDownRounded,
  LeaderboardOutlined,
  MenuBookOutlined,
  PaymentsOutlined,
  ShoppingBagOutlined,
  StickyNote2Outlined,
} from '@mui/icons-material';
import useAuth from '../../features/auth/hooks/useAuth';
import { ROUTES } from '../constants/routes';
import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';

export default function HeaderUtilities() {
  useLocale();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [anchor, setAnchor] = useState(null);
  const trigger = useRef(null);
  const restoreFocus = useRef(false);
  const id = useId();
  const open = Boolean(anchor);
  const items = [
    ...(user
      ? [
          { to: '/my-courses', label: 'Khóa của tôi', icon: MenuBookOutlined },
          { to: ROUTES.MY_NOTES, label: 'Ghi chú của tôi', icon: StickyNote2Outlined },
        ]
      : []),
    { to: ROUTES.COMMUNITY, label: 'Diễn đàn', icon: ForumOutlined },
    { to: ROUTES.LEADERBOARD, label: 'Bảng xếp hạng', icon: LeaderboardOutlined },
    { to: ROUTES.SHOP, label: 'Cửa hàng', icon: ShoppingBagOutlined },
    ...(user
      ? [
          { to: ROUTES.PAYMENT_HISTORY, label: 'Thanh toán', icon: PaymentsOutlined },
          { to: ROUTES.AI_ASSISTANT, label: 'Trợ lý AI', icon: AutoAwesomeOutlined },
        ]
      : []),
  ];
  const isCurrent = item => pathname === item.to || pathname.startsWith(`${item.to}/`);

  return (
    <>
      <ButtonBase
        ref={trigger}
        id={`${id}-trigger`}
        className={`header-utilities-trigger ${items.some(isCurrent) ? 'active' : ''}`}
        aria-haspopup="menu"
        aria-controls={open ? `${id}-menu` : undefined}
        aria-expanded={open}
        onClick={event => setAnchor(event.currentTarget)}
      >
        {t('Tiện ích khác')}
        <KeyboardArrowDownRounded fontSize="small" />
      </ButtonBase>
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={open}
        onClose={(_event, reason) => {
          restoreFocus.current = reason === 'escapeKeyDown';
          setAnchor(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          list: { 'aria-labelledby': `${id}-trigger` },
          paper: { className: 'header-utilities-paper' },
          transition: {
            onExited: () => {
              if (restoreFocus.current) trigger.current?.focus();
              restoreFocus.current = false;
            },
          },
        }}
      >
        {items.map(item => (
          <MenuItem
            key={item.to}
            component={Link}
            to={item.to}
            selected={isCurrent(item)}
            aria-current={isCurrent(item) ? 'page' : undefined}
            onClick={() => setAnchor(null)}
          >
            <ListItemIcon>
              <item.icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t(item.label)}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
