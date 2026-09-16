import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function Brand() {
  return (
    <Link to="/" className="brand" aria-label="LearnSphere English — Trang chủ">
      <span className="brand-icon">
        <Icon name="language" size={23} />
      </span>
      <span className="brand-wordmark">
        <span>
          Learn<span className="brand-accent">Sphere</span>
          <span className="brand-english">English</span>
        </span>
        <small>ENGLISH ACADEMY</small>
      </span>
    </Link>
  );
}
