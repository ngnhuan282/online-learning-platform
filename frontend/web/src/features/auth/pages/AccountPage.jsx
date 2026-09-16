import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function AccountPage({ admin = false }) {
  const { user } = useAuth();
  return (
    <section className="container section">
      <h1>{admin ? 'Tài khoản quản trị' : 'Tài khoản của bạn'}</h1>
      <p>Xin chào, {user.fullName}.</p>
      <p>{user.email}</p>
      <p>Quyền: {user.roles.join(', ')}</p>
      <Link className="button button-primary" to="/">
        Về trang chủ
      </Link>
    </section>
  );
}
