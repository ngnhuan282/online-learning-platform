import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { authApi } from '../api/authApi';
import { waitForRefresh } from '../../../shared/apis/axiosClient';
import { can } from '../../admin/utils/adminUtils';
import { ROUTES } from '../../../shared/constants/routes';
import {
  clearGoogleAttempt,
  googleErrorMessage,
  loginDestination,
  readGoogleAttempt,
} from '../utils/googleLogin';
import '../styles/auth.css';

export default function GoogleCallbackPage() {
  const { completeGoogleLogin, user, isLoading, sessionError } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [callback] = useState(() => {
    const params = new URLSearchParams(location.search);
    const flow = params.get('flow') === 'link' ? 'link' : 'login';
    return { params, flow, attempt: readGoogleAttempt(flow) };
  });
  const [error, setError] = useState('');
  const flight = useRef(null);
  const linking = callback.flow === 'link';
  const profilePath =
    callback.attempt?.from === ROUTES.ADMIN_PROFILE && can(user, 'ADMIN_ACCESS')
      ? ROUTES.ADMIN_PROFILE
      : ROUTES.ACCOUNT;

  useEffect(() => {
    // Remove the one-time code from browser history before starting the exchange.
    window.history.replaceState(window.history.state, '', ROUTES.GOOGLE_CALLBACK);
    // LINK keeps the local session and waits for its authoritative restore/refresh to finish.
    if (linking && !callback.params.get('error') && isLoading) return undefined;
    let active = true;
    if (!flight.current) {
      const code = callback.params.get('code');
      const failure = callback.params.get('error');
      if (failure || !callback.attempt || !/^[A-Za-z0-9_-]{43}$/.test(code)) {
        flight.current = Promise.reject({
          code: failure || (linking ? 'GOOGLE_LINK_INVALID' : 'GOOGLE_EXCHANGE_INVALID'),
        });
      } else if (linking) {
        flight.current =
          !user || sessionError || String(user.id) !== String(callback.attempt.userId)
            ? Promise.reject({ code: 'GOOGLE_LINK_SESSION_INVALID' })
            : waitForRefresh()
                .then(() => authApi.completeGoogleLink({ code, verifier: callback.attempt.verifier }))
                .then(response => response.data);
      } else {
        flight.current = completeGoogleLogin({ code, verifier: callback.attempt.verifier });
      }
    }
    flight.current
      .then(result => {
        if (!active) return;
        clearGoogleAttempt(callback.flow);
        if (linking) {
          navigate(`${profilePath}#sign-in-methods`, {
            replace: true,
            state: { googleLinkUpdated: true, alreadyLinked: result.alreadyLinked },
          });
        } else {
          navigate(loginDestination(result, callback.attempt?.from), { replace: true });
        }
      })
      .catch(failure => {
        if (!active) return;
        clearGoogleAttempt(callback.flow);
        setError(googleErrorMessage(failure.code, callback.flow));
      });
    return () => {
      active = false;
    };
  }, [callback, completeGoogleLogin, navigate, linking, isLoading, user, sessionError, profilePath]);

  return (
    <section className="auth-section" aria-busy={!error}>
      <div className="auth-card">
        <h1>{linking ? 'Liên kết Google' : 'Đăng nhập bằng Google'}</h1>
        <p role="status">
          {error || (linking ? 'Đang khôi phục phiên và hoàn tất liên kết...' : 'Đang hoàn tất đăng nhập...')}
        </p>
        {error && (
          <Link to={linking ? `${profilePath}#sign-in-methods` : ROUTES.LOGIN} replace>
            {linking ? 'Quay lại Hồ sơ' : 'Quay lại đăng nhập'}
          </Link>
        )}
      </div>
    </section>
  );
}
