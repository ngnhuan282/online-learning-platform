import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { adminApi } from '../api/adminApi';
import { date } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';
import { commerceAdminApi } from '../api/commerceAdminApi';
import { Alert } from '@mui/material';

export default function AdminAuditPage() {
  useLocale();
  const [state, setState] = useState({ loading: true, data: [], error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.allSettled([adminApi.audit(), commerceAdminApi.learningAudit(), commerceAdminApi.paymentAudit()])
      .then(results => {
        const sources = ['Auth', 'Learning', 'Payment'];
        const data = results
          .flatMap((result, index) =>
            result.status === 'fulfilled'
              ? result.value.data.map(row => ({ ...row, source: sources[index] }))
              : [],
          )
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        const unavailable = results.flatMap((result, index) =>
          result.status === 'rejected' ? [sources[index]] : [],
        );
        if (active)
          setState({
            loading: false,
            data,
            unavailable,
            error: unavailable.length === 3 ? results[0].reason : null,
          });
      })
      .catch(error => {
        if (active) setState({ loading: false, data: [], error });
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <>
      <PageHeading
        title={t('Nhật ký quản trị')}
        description={t('Nhật ký tài khoản, phân quyền, học tập, cửa hàng và Pro.')}
      >
        <Button startIcon={<Refresh />} onClick={() => setRetry(r => r + 1)}>
          {t('Làm mới')}
        </Button>
      </PageHeading>
      <LoadState loading={state.loading} error={state.error} retry={() => setRetry(r => r + 1)} />
      {!!state.unavailable?.length && !state.error && (
        <Alert severity="warning">
          {t('Chưa tải được một số nguồn nhật ký:')} {state.unavailable.join(', ')}
        </Alert>
      )}
      <section className="admin-card admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('THỜI GIAN')}</th>
              <th>{t('Nguồn')}</th>
              <th>{t('NGƯỜI THỰC HIỆN')}</th>
              <th>{t('THAO TÁC')}</th>
              <th>{t('ĐỐI TƯỢNG')}</th>
              <th>{t('CHI TIẾT')}</th>
            </tr>
          </thead>
          <tbody>
            {state.data.map(item => (
              <tr key={`${item.source}:${item.id}`}>
                <td>{date(item.createdAt)}</td>
                <td>{item.source}</td>
                <td>{item.actorName || `#${item.actorId}`}</td>
                <td>{item.action}</td>
                <td>{item.target}</td>
                <td>{t(item.description)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!state.loading && !state.error && !state.data.length && (
          <div className="admin-empty">{t('Chưa có thao tác quản trị được ghi nhận.')}</div>
        )}
      </section>
    </>
  );
}
