import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar, ButtonBase, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { KeyboardArrowDown, Logout, PersonOutlineOutlined } from '@mui/icons-material';
import useAuth from '../../features/auth/hooks/useAuth';
import { ROUTES } from '../constants/routes';
import { can } from '../../features/admin/utils/adminUtils';
import './AccountMenu.css';

export default function AccountMenu({ profileTo = ROUTES.ACCOUNT, showDetails = false }) {
  const { user, logout, isLoggingOut } = useAuth();
  const [anchor, setAnchor] = useState(null);
  const navigate = useNavigate();
  const id = useId();
  const open = Boolean(anchor);
  if (!user) return null;
  const initials =
    user.fullName
      ?.trim()
      .split(/\s+/)
      .slice(-2)
      .map(word => word[0])
      .join('')
      .toUpperCase() || 'U';

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
        aria-label={`Menu tài khoản của ${user.fullName || user.email}`}
        aria-haspopup="menu"
        aria-controls={open ? `${id}-menu` : undefined}
        aria-expanded={open}
        disabled={isLoggingOut}
        onClick={event => setAnchor(event.currentTarget)}
      >
        <Avatar className="account-menu-avatar">{initials}</Avatar>
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
          <ListItemText>Hồ sơ cá nhân</ListItemText>
        </MenuItem>
        {can(user, 'ADMIN_ACCESS') && (
          <MenuItem component={Link} to="/admin" onClick={() => setAnchor(null)}>
            <ListItemText>Không gian quản trị</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={signOut} disabled={isLoggingOut} className="account-menu-logout">
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
