import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ButtonBase, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import {
  KeyboardArrowDown,
  Logout,
  PersonOutlineOutlined,
  AdminPanelSettingsOutlined,
  EmojiEventsOutlined,
  ShoppingBagOutlined,
  LeaderboardOutlined,
  ForumOutlined,
  WorkspacePremiumOutlined,
  StickyNote2Outlined,
} from '@mui/icons-material';
import useAuth from '../../features/auth/hooks/useAuth';
import { ROUTES } from '../constants/routes';
import { can } from '../../features/admin/utils/adminUtils';
import './AccountMenu.css';
import useEngagement from '../../features/engagement/hooks/useEngagement';
import LearnerAvatar from './LearnerAvatar';

export default function AccountMenu({ profileTo = ROUTES.ACCOUNT, showDetails = false }) {
  useLocale();
  const { user, logout, isLoggingOut } = useAuth();
  const { summary } = useEngagement();
  const [anchor, setAnchor] = useState(null);
  const navigate = useNavigate();
  const id = useId();
  const open = Boolean(anchor);
  if (!user) return null;

  async function signOut() {
    setAnchor(null);
    const { error } = await logout();
    navigate(ROUTES.LOGIN, { replace: true, state: { logoutFailed: Boolean(error) } });
  }

  return (
    <>
      <ButtonBase
        id={`${id}-trigger`}
        className="account-menu-trigger"
        aria-label={t('Menu tài khoản của {name}', { name: user.fullName || user.email })}
        aria-haspopup="menu"
        aria-controls={open ? `${id}-menu` : undefined}
        aria-expanded={open}
        disabled={isLoggingOut}
        onClick={event => setAnchor(event.currentTarget)}
      >
        <LearnerAvatar
          name={user.fullName}
          avatarUrl={user.avatarUrl}
          frame={summary?.activeFrame}
          assetKey={summary?.activeFrameAssetKey}
          level={summary?.level}
          size="header"
          showLevel
        />
        {showDetails && (
          <span className="account-menu-details">
            <strong>{user.fullName}</strong>
            <small>{user.roles?.join(' · ')}</small>
          </span>
        )}
        <KeyboardArrowDown className="account-menu-chevron" fontSize="small" />
      </ButtonBase>
      <Menu
        id={`${id}-menu`}
        anchorEl={anchor}
        open={open}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          list: { 'aria-labelledby': `${id}-trigger` },
          paper: { className: 'account-menu-paper' },
        }}
      >
        <MenuItem component={Link} to={profileTo} onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <PersonOutlineOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('Hồ sơ cá nhân')}</ListItemText>
        </MenuItem>
        {can(user, 'ADMIN_ACCESS') && (
          <MenuItem component={Link} to="/admin" onClick={() => setAnchor(null)}>
            <ListItemIcon>
              <AdminPanelSettingsOutlined fontSize="small" />
            </ListItemIcon>
            <ListItemText>{t('Không gian quản trị')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem component={Link} to={ROUTES.MY_NOTES} onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <StickyNote2Outlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('Ghi chú của tôi')}</ListItemText>
        </MenuItem>
        <MenuItem component={Link} to={ROUTES.ACHIEVEMENTS} onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <EmojiEventsOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('Thành tích học tập')}</ListItemText>
        </MenuItem>
        <MenuItem component={Link} to={ROUTES.SHOP} onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <ShoppingBagOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('Cửa hàng & kho đồ')}</ListItemText>
        </MenuItem>
        <MenuItem component={Link} to={ROUTES.PRO} onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <WorkspacePremiumOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('Gói Pro của bạn')}</ListItemText>
        </MenuItem>
        <MenuItem component={Link} to={ROUTES.LEADERBOARD} onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <LeaderboardOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('Bảng xếp hạng')}</ListItemText>
        </MenuItem>
        <MenuItem component={Link} to={ROUTES.COMMUNITY} onClick={() => setAnchor(null)}>
          <ListItemIcon>
            <ForumOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t('Diễn đàn')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={signOut} disabled={isLoggingOut} className="account-menu-logout">
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isLoggingOut ? t('Đang đăng xuất...') : t('Đăng xuất')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
