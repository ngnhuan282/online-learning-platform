import { Outlet } from 'react-router-dom';
import '../styles/toeic.css';

export default function ToeicLayout() {
  return (
    <div className="toeic-app">
      <div className="toeic-main">
        <Outlet />
      </div>
    </div>
  );
}
