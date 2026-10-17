import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function Brand() {
  return (
    <Link to="/" className="brand" aria-label="SGEdu English — Trang chủ">
      <span className="brand-icon">
        <Icon name="language" size={23} />
      </span>
      <span className="brand-wordmark">
        <span>
          SG<span className="brand-accent">Edu</span>
          <span className="brand-english">English</span>
        </span>
        <small>ENGLISH ACADEMY</small>
      </span>
    </Link>
  );
}
