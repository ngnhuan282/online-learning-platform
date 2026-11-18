import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import SearchRounded from '@mui/icons-material/SearchRounded';
import VolumeUpRounded from '@mui/icons-material/VolumeUpRounded';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import WorkspacePremiumOutlined from '@mui/icons-material/WorkspacePremiumOutlined';
import StickyNote2Outlined from '@mui/icons-material/StickyNote2Outlined';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import ErrorState from '../../../shared/components/ErrorState';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { ROUTES } from '../../../shared/constants/routes';
import { toeicApi } from '../api/toeicApi';
import useLearningResource from '../hooks/useLearningResource';
import LearningHeader from '../components/LearningHeader';
import StudyTextAssistant from '../components/StudyTextAssistant';
import { speakEnglishText } from '../utils/dictionaryClient';
import '../styles/workspace.css';
import '../styles/notes-dictionary.css';

const EMPTY_DATA = { items: [], count: 0, limit: 100, isPro: false };
const COLOR_OPTIONS = [
  { id: 'all', label: 'Tất cả màu' },
  { id: 'yellow', label: 'Vàng' },
  { id: 'blue', label: 'Xanh dương' },
  { id: 'green', label: 'Xanh lá' },
  { id: 'pink', label: 'Hồng' },
];

export default function MyNotesPage() {
  useLocale();
  const load = useCallback(options => toeicApi.notes(null, options), []);
  const { data, loading, error, reload } = useLearningResource(load, EMPTY_DATA);

  const [query, setQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('all');
  const [examFilter, setExamFilter] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editColor, setEditColor] = useState('yellow');
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState(null);

  const items = data?.items ?? [];
  const count = data?.count ?? items.length;
  const isPro = Boolean(data?.isPro);
  const limit = data?.limit ?? 100;
  const percent = isPro ? 100 : Math.min(100, Math.round((count / Math.max(limit, 1)) * 100));

  const exams = Array.from(new Map(items.map(note => [String(note.examId), note.examTitle])).entries());

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = items.filter(note => {
    if (colorFilter !== 'all' && note.color !== colorFilter) return false;
    if (examFilter !== 'all' && String(note.examId) !== examFilter) return false;
    if (!normalizedQuery) return true;
    return `${note.selectedText} ${note.noteContent} ${note.examTitle}`
      .toLowerCase()
      .includes(normalizedQuery);
  });

  function beginEdit(note) {
    setEditingId(note.id);
    setEditContent(note.noteContent ?? '');
    setEditColor(note.color ?? 'yellow');
    setActionError(null);
  }

  async function saveEdit(noteId) {
    setBusyId(noteId);
    setActionError(null);
    try {
      await toeicApi.updateNote(noteId, { noteContent: editContent, color: editColor });
      setEditingId(null);
      reload();
    } catch (failure) {
      setActionError(failure);
    } finally {
      setBusyId(null);
    }
  }

  async function removeNote(noteId) {
    setBusyId(noteId);
    setActionError(null);
    try {
      await toeicApi.deleteNote(noteId);
      if (editingId === noteId) setEditingId(null);
      reload();
    } catch (failure) {
      setActionError(failure);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="learning-workspace container">
      <LearningHeader
        title="Ghi chú của tôi"
        description="Lưu trữ từ vựng, cụm từ và cấu trúc hay được bạn tô đen trong lúc luyện thi TOEIC."
      >
        <Link className="button button-primary" to={ROUTES.TOEIC}>
          {t('Đến Luyện thi TOEIC')}
          <ArrowForwardRounded fontSize="small" />
        </Link>
      </LearningHeader>

      <StudyTextAssistant allowNotes={false}>
        <section className="my-notes-quota-banner" aria-label={t('Hạn mức ghi chú')}>
          <div className="my-notes-quota-info">
            <div className="my-notes-quota-head">
              <strong>
                {isPro
                  ? t('{count} ghi chú đã lưu', { count })
                  : t('{count} / {limit} ghi chú đã dùng', { count, limit })}
              </strong>
              <span className={`study-quota-pill ${isPro ? 'is-pro' : count >= limit ? 'is-full' : ''}`}>
                {isPro ? t('PRO · Không giới hạn') : t('Gói Miễn phí · Tối đa 100')}
              </span>
            </div>
            {!isPro && (
              <div className="my-notes-progress-track" aria-hidden="true">
                <div
                  className={`my-notes-progress-fill ${percent >= 85 ? 'is-warning' : ''}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
            <p>
              {t(
                'Ghi chú chỉ được thêm bằng thao tác kéo chuột tô đen từ/cụm từ khi đang làm hoặc xem kết quả đề Luyện thi TOEIC.',
              )}
            </p>
          </div>
          {!isPro && (
            <Link className="header-pro-button" to={ROUTES.PRO}>
              <WorkspacePremiumOutlined fontSize="small" />
              <span>{t('Mở khóa PRO không giới hạn')}</span>
            </Link>
          )}
        </section>

        {actionError && <ErrorState error={actionError} />}

        <div className="my-notes-filter-bar">
          <label className="my-notes-search">
            <SearchRounded fontSize="small" />
            <input
              type="search"
              value={query}
              aria-label={t('Tìm trong ghi chú của tôi')}
              placeholder={t('Tìm theo từ vựng, nội dung ghi chú hoặc tên đề...')}
              onChange={event => setQuery(event.target.value)}
            />
          </label>

          <div className="my-notes-color-filters" role="group" aria-label={t('Lọc theo nhãn màu')}>
            {COLOR_OPTIONS.map(option => (
              <button
                key={option.id}
                type="button"
                className={`my-notes-color-chip ${colorFilter === option.id ? 'is-active' : ''}`}
                aria-pressed={colorFilter === option.id}
                onClick={() => setColorFilter(option.id)}
              >
                {option.id !== 'all' && <span className={`study-color-dot tone-${option.id}`} />}
                {t(option.label)}
              </button>
            ))}
          </div>

          {exams.length > 0 && (
            <select
              className="my-notes-select"
              aria-label={t('Lọc theo bộ đề TOEIC')}
              value={examFilter}
              onChange={event => setExamFilter(event.target.value)}
            >
              <option value="all">{t('Tất cả bộ đề')}</option>
              {exams.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <p className="toeic-loading" role="status">
            {t('Đang tải ghi chú của bạn...')}
          </p>
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : filtered.length === 0 ? (
          <div className="learning-empty-card">
            <StickyNote2Outlined sx={{ fontSize: 44, color: 'var(--primary)' }} />
            <h2>
              {items.length === 0 ? t('Bạn chưa có ghi chú TOEIC nào') : t('Không tìm thấy ghi chú phù hợp')}
            </h2>
            <p>
              {items.length === 0
                ? t(
                    'Khi luyện thi TOEIC, hãy kéo chuột tô đen từ vựng hoặc cấu trúc bất kỳ trên màn hình để mở hộp thoại lưu ghi chú nhanh.',
                  )
                : t('Hãy thử từ khóa khác hoặc đặt lại bộ lọc màu sắc / bộ đề.')}
            </p>
            <Link className="button button-primary" to={ROUTES.TOEIC}>
              {t('Vào Luyện thi TOEIC ngay')}
            </Link>
          </div>
        ) : (
          <div className="my-notes-grid">
            {filtered.map(note => {
              const isEditing = editingId === note.id;
              const isBusy = busyId === note.id;
              return (
                <article key={note.id} className={`my-note-card tone-${note.color || 'yellow'}`}>
                  <div className="my-note-card-top">
                    <span className="my-note-source">
                      <Link to={`/exams/toeic/tests/${note.examId}`}>{note.examTitle}</Link>
                      {note.part && <span>· Part {note.part}</span>}
                      {note.questionNumber && (
                        <span>· {t('Câu {number}', { number: note.questionNumber })}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      className="dict-audio-btn"
                      aria-label={t('Phát âm {text}', { text: note.selectedText })}
                      onClick={() => speakEnglishText(note.selectedText, 'en-US')}
                    >
                      <VolumeUpRounded fontSize="small" />
                    </button>
                  </div>

                  <div className="my-note-phrase">
                    <strong>“{note.selectedText}”</strong>
                  </div>

                  {isEditing ? (
                    <div>
                      <div className="study-color-row">
                        <span>{t('Nhãn màu')}</span>
                        <div className="study-color-dots">
                          {COLOR_OPTIONS.filter(c => c.id !== 'all').map(color => (
                            <button
                              key={color.id}
                              type="button"
                              className={`study-color-dot tone-${color.id} ${editColor === color.id ? 'is-active' : ''}`}
                              aria-label={t(color.label)}
                              onClick={() => setEditColor(color.id)}
                            />
                          ))}
                        </div>
                      </div>
                      <textarea
                        className="study-note-textarea"
                        value={editContent}
                        aria-label={t('Chỉnh sửa nội dung ghi chú')}
                        onChange={event => setEditContent(event.target.value)}
                      />
                      <div className="study-popover-footer">
                        <button
                          type="button"
                          className="button button-outline"
                          disabled={isBusy}
                          onClick={() => setEditingId(null)}
                        >
                          {t('Hủy')}
                        </button>
                        <button
                          type="button"
                          className="button button-primary"
                          disabled={isBusy}
                          onClick={() => void saveEdit(note.id)}
                        >
                          {isBusy ? t('Đang lưu...') : t('Lưu thay đổi')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`my-note-body ${!note.noteContent ? 'is-empty' : ''}`}>
                      {note.noteContent || t('Chưa có lời ghi chú bổ sung.')}
                    </p>
                  )}

                  <div className="my-note-card-footer">
                    <span>
                      {note.createdAt
                        ? new Intl.DateTimeFormat(getIntlLocale(), {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(note.createdAt))
                        : ''}
                    </span>
                    {!isEditing && (
                      <div className="my-note-card-actions">
                        <button
                          type="button"
                          className="study-switch-btn"
                          disabled={isBusy}
                          onClick={() => beginEdit(note)}
                        >
                          <EditOutlined fontSize="inherit" /> {t('Sửa')}
                        </button>
                        <button
                          type="button"
                          className="study-switch-btn"
                          style={{ color: '#be123c', borderColor: '#fecdd3', background: '#fff1f2' }}
                          disabled={isBusy}
                          onClick={() => void removeNote(note.id)}
                        >
                          <DeleteOutlineRounded fontSize="inherit" /> {t('Xóa')}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </StudyTextAssistant>
    </main>
  );
}
