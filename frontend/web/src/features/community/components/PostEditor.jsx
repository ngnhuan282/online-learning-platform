import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent } from '@mui/material';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { topicLabels } from '../utils/communityUi';
import { ActionError } from '../../engagement/components/WorkspaceUi';

export default function PostEditor({ post, topics, onSave, onClose, busy, error }) {
  useLocale();
  const [form, setForm] = useState({
    topicId: post?.topicId || topics[0]?.id || '',
    kind: post?.kind || 'DISCUSSION',
    title: post?.title || '',
    body: post?.body || '',
  });
  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby="post-editor-title"
    >
      <DialogTitle id="post-editor-title">{t(post ? 'Sửa bài viết' : 'Viết bài mới')}</DialogTitle>
      <DialogContent>
        <form
          className="workspace-form"
          onSubmit={event => {
            event.preventDefault();
            if (form.title.trim() && form.body.trim()) onSave({ ...form, topicId: Number(form.topicId) });
          }}
        >
          <label>
            {t('Chủ đề')}
            <select name="topicId" required value={form.topicId} onChange={change} disabled={busy}>
              {topics.map(topic => (
                <option key={topic.id} value={topic.id}>
                  {t(topicLabels[topic.code] || topic.code)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('Loại bài')}
            <select
              name="kind"
              value={form.kind}
              onChange={change}
              disabled={busy || Boolean(post?.acceptedCommentId)}
            >
              <option value="DISCUSSION">{t('Thảo luận')}</option>
              <option value="QUESTION">{t('Hỏi đáp')}</option>
            </select>
          </label>
          <label>
            {t('Tiêu đề')}
            <input
              name="title"
              required
              maxLength={160}
              value={form.title}
              onChange={change}
              disabled={busy}
            />
          </label>
          <label>
            {t('Nội dung')}
            <textarea
              name="body"
              required
              maxLength={12000}
              rows={8}
              value={form.body}
              onChange={change}
              disabled={busy}
            />
          </label>
          <ActionError error={error} />
          <div className="workspace-actions">
            <button className="button button-outline" type="button" onClick={onClose} disabled={busy}>
              {t('Hủy')}
            </button>
            <button
              className="button button-primary"
              disabled={busy || !form.title.trim() || !form.body.trim() || !form.topicId}
            >
              {t(busy ? 'Đang lưu...' : post ? 'Lưu thay đổi' : 'Đăng bài')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
