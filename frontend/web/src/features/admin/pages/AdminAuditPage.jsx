import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { adminApi } from '../api/adminApi';
import { date } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';

export default function AdminAuditPage() {
  useLocale();
  const [state, setState] = useState({ loading: true, data: [], error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    adminApi
      .audit()
      .then(result => {
        if (active) setState({ loading: false, data: result.data, error: null });
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
        description={t('50 thay đổi gần nhất về tài khoản, trạng thái và phân quyền.')}
      >
        <Button startIcon={<Refresh />} onClick={() => setRetry(r => r + 1)}>
          {t('Làm mới')}
        </Button>
      </PageHeading>
      <LoadState loading={state.loading} error={state.error} retry={() => setRetry(r => r + 1)} />
      <section className="admin-card admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              <th>{t('THỜI GIAN')}</th>
              <th>{t('NGƯỜI THỰC HIỆN')}</th>
              <th>{t('THAO TÁC')}</th>
              <th>{t('ĐỐI TƯỢNG')}</th>
              <th>{t('CHI TIẾT')}</th>
            </tr>
          </thead>
          <tbody>
            {state.data.map(item => (
              <tr key={item.id}>
                <td>{date(item.createdAt)}</td>
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
