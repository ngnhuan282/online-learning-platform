import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { Add, Refresh } from '@mui/icons-material';
import { commerceAdminApi as api } from '../api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useAuth from '../../auth/hooks/useAuth';
import { can, date, number } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';
import {
  AdminActionDialog,
  CommerceTable,
  CommercePager,
  Field,
  ReasonField,
} from '../components/CommerceAdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';

const assets = {
  FRAME: ['classic', 'kitty-scholar', 'koala-garden', 'owl-wizard', 'bunny-bloom'],
  BACKGROUND: ['sky', 'campus-sunrise', 'moonlit-library'],
  FREEZE: ['freeze'],
};
export default function AdminShopPage() {
  useLocale();
  const { user } = useAuth();
  const [tab, setTab] = useState('items'),
    [page, setPage] = useState(0),
    [userId, setUserId] = useState(''),
    [filter, setFilter] = useState(''),
    [form, setForm] = useState(null);
  const load = useCallback(
    options =>
      tab === 'items'
        ? api.items(options)
        : api.purchases({ page, size: 20, ...(filter ? { userId: filter } : {}) }, options),
    [tab, page, filter],
  );
  const resource = useLearningResource(load, null);
  function edit(item) {
    setForm(
      item
        ? { ...item, reason: '', create: false }
        : {
            code: 'FRAME_',
            nameKey: '',
            itemType: 'FRAME',
            rarity: 'EPIC',
            price: 0,
            originalPrice: '',
            assetKey: 'classic',
            position: 10,
            active: true,
            version: 0,
            reason: '',
            create: true,
          },
    );
  }
  const change = key => event =>
    setForm({ ...form, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value });
  return (
    <>
      <PageHeading title="Quản lý cửa hàng" description="Quản lý vật phẩm, giá gem, hiển thị và lịch sử mua.">
        <Button startIcon={<Refresh />} onClick={resource.reload}>
          {t('Làm mới')}
        </Button>
        {can(user, 'SHOP_CREATE') && (
          <Button variant="contained" startIcon={<Add />} onClick={() => edit(null)}>
            {t('Thêm vật phẩm')}
          </Button>
        )}
      </PageHeading>
      <div className="commerce-toolbar">
        <Button variant={tab === 'items' ? 'contained' : 'outlined'} onClick={() => setTab('items')}>
          {t('Vật phẩm')}
        </Button>
        <Button variant={tab === 'purchases' ? 'contained' : 'outlined'} onClick={() => setTab('purchases')}>
          {t('Giao dịch gem')}
        </Button>
      </div>
      {tab === 'purchases' && (
        <form
          className="commerce-search"
          onSubmit={e => {
            e.preventDefault();
            setFilter(userId);
            setPage(0);
          }}
        >
          <Field
            label="ID học viên (để trống để xem tất cả)"
            type="number"
            min="1"
            value={userId}
            onChange={e => setUserId(e.target.value)}
          />
          <Button type="submit">{t('Lọc')}</Button>
        </form>
      )}
      <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {resource.data &&
        !resource.error &&
        (tab === 'items' ? (
          <CommerceTable
            rowKey="code"
            rows={resource.data}
            columns={[
              ['Mã vật phẩm', 'code'],
              ['Tên', row => t(row.nameKey)],
              ['Loại', 'itemType'],
              ['Độ hiếm', 'rarity'],
              ['Giá gem', row => number(row.price)],
              ['Trạng thái', row => t(row.active ? 'Đang hiển thị' : 'Đã ẩn')],
              [
                'Thao tác',
                row =>
                  can(user, 'SHOP_UPDATE') ? (
                    <Button size="small" onClick={() => edit(row)}>
                      {t('Chỉnh sửa')}
                    </Button>
                  ) : (
                    '—'
                  ),
              ],
            ]}
          />
        ) : (
          <>
            <CommerceTable
              rows={resource.data.content}
              columns={[
                ['ID học viên', 'userId'],
                ['Vật phẩm', r => t(r.nameKey)],
                ['Gem đã dùng', r => number(r.gemsSpent)],
                ['Thời gian', r => date(r.createdAt)],
                ['Mã yêu cầu', 'requestId'],
              ]}
            />
            <CommercePager data={resource.data} page={page} onChange={setPage} />
          </>
        ))}
      {form && (
        <AdminActionDialog
          title={form.create ? 'Thêm vật phẩm' : 'Chỉnh sửa vật phẩm'}
          onClose={() => setForm(null)}
          onSubmit={() =>
            api.saveItem(
              {
                ...form,
                price: Number(form.price),
                originalPrice:
                  form.originalPrice === '' || form.originalPrice == null ? null : Number(form.originalPrice),
                position: Number(form.position),
              },
              form.create,
            )
          }
          onSaved={() => {
            setForm(null);
            resource.reload();
          }}
        >
          <Field
            label="Mã vật phẩm"
            required
            maxLength={32}
            pattern="[A-Z][A-Z0-9_]{1,31}"
            disabled={!form.create}
            value={form.code}
            onChange={change('code')}
          />
          <Field
            label="Tên vật phẩm"
            required
            maxLength={120}
            value={form.nameKey}
            onChange={change('nameKey')}
          />
          <Field label="Loại">
            <select
              disabled={!form.create}
              value={form.itemType}
              onChange={e =>
                setForm({
                  ...form,
                  itemType: e.target.value,
                  code: e.target.value + '_',
                  assetKey: assets[e.target.value][0],
                })
              }
            >
              {(form.create ? ['FRAME', 'BACKGROUND'] : ['FRAME', 'BACKGROUND', 'FREEZE']).map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Hình minh họa">
            <select value={form.assetKey} onChange={change('assetKey')}>
              {assets[form.itemType].map(key => (
                <option key={key}>{key}</option>
              ))}
            </select>
          </Field>
          <Field label="Độ hiếm">
            <select value={form.rarity} onChange={change('rarity')}>
              {['RARE', 'EPIC', 'LEGENDARY'].map(value => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Giá gem"
            type="number"
            min="0"
            max="1000000"
            required
            value={form.price}
            onChange={change('price')}
          />
          <Field
            label="Giá tham chiếu (tùy chọn)"
            type="number"
            min={form.price}
            max="1000000"
            value={form.originalPrice ?? ''}
            onChange={change('originalPrice')}
          />
          <Field
            label="Thứ tự hiển thị"
            type="number"
            min="0"
            max="10000"
            required
            value={form.position}
            onChange={change('position')}
          />
          <label className="commerce-check">
            <input type="checkbox" checked={form.active} onChange={change('active')} />
            {t('Hiển thị trong cửa hàng')}
          </label>
          <p className="commerce-info">
            {t('Ẩn vật phẩm không xóa vật phẩm đã mua trong kho của học viên.')}
          </p>
          <ReasonField value={form.reason} onChange={change('reason')} />
        </AdminActionDialog>
      )}
    </>
  );
}
