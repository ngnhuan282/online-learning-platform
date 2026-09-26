import { Link } from 'react-router-dom';
import { ROUTES } from '../shared/constants/routes';

export default function NotFoundPage() {
  return (
    <section className="container section">
      <h1>Không tìm thấy trang</h1>
      <p>Đường dẫn không tồn tại hoặc nội dung đã được chuyển đi.</p>
      <Link className="button button-primary" to={ROUTES.HOME}>
        Về trang chủ
      </Link>
    </section>
  );
}
