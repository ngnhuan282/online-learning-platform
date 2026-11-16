import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import BookmarkBorderOutlined from '@mui/icons-material/BookmarkBorderOutlined';
import BookmarkRounded from '@mui/icons-material/BookmarkRounded';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import RestartAltRounded from '@mui/icons-material/RestartAltRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { ROUTES } from '../../../shared/constants/routes';
import { toeicCatalog } from '../data/toeicResources';
import { DOCUMENT_TYPES, toeicTestUrl, toeicDocumentLabel } from '../utils/toeicCatalog';
import useToeicBookmarks from '../hooks/useToeicBookmarks';

const typeIcons = {
  reading: MenuBookOutlined,
  listening: HeadphonesOutlined,
  solution: FactCheckOutlined,
  answer: FactCheckOutlined,
  document: DescriptionOutlined,
};
const resourceKey = resource =>
  resource.type === 'answer'
    ? `answer-${resource.section?.toLowerCase() ?? 'all'}`
    : resource.type + (resource.format === 'WORD' ? '-word' : '');

function StudyTimer({ minutes }) {
  const [clock, setClock] = useState({ remaining: minutes * 60, deadline: null });
  useEffect(() => {
    if (!clock.deadline) return undefined;
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((clock.deadline - Date.now()) / 1000));
      setClock(previous => ({ remaining, deadline: remaining === 0 ? null : previous.deadline }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [clock.deadline]);
  const toggle = () =>
    setClock(previous =>
      previous.deadline
        ? { remaining: Math.max(0, Math.ceil((previous.deadline - Date.now()) / 1000)), deadline: null }
        : { remaining: previous.remaining, deadline: Date.now() + previous.remaining * 1000 },
    );
  return (
    <div className="toeic-study-timer">
      <div>
        <AccessTimeRounded fontSize="small" />
        <span>{t('Đồng hồ tự luyện')}</span>
      </div>
      <strong role="timer" aria-label={t('Thời gian còn lại')}>
        {String(Math.floor(clock.remaining / 60)).padStart(2, '0')}:
        {String(clock.remaining % 60).padStart(2, '0')}
      </strong>
      <div className="toeic-timer-actions">
        <button
          className="toeic-button toeic-button-outline"
          type="button"
          disabled={clock.remaining === 0}
          onClick={toggle}
        >
          {clock.deadline ? <PauseRounded fontSize="small" /> : <PlayArrowRounded fontSize="small" />}
          {t(clock.deadline ? 'Tạm dừng' : 'Bắt đầu')}
        </button>
        <button
          className="toeic-icon-button"
          type="button"
          aria-label={t('Đặt lại đồng hồ')}
          onClick={() => setClock({ remaining: minutes * 60, deadline: null })}
        >
          <RestartAltRounded fontSize="small" />
        </button>
      </div>
      {clock.remaining === 0 && <p role="status">{t('Đã hết thời gian tự luyện.')}</p>}
    </div>
  );
}

function DocumentViewer({ resource }) {
  const [state, setState] = useState({ loading: true, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (resource.format === 'WORD') return undefined;
    const controller = new AbortController();
    fetch(resource.url, { method: 'HEAD', signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Document unavailable');
        if (!controller.signal.aborted) setState({ loading: false, error: false });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ loading: false, error: true });
      });
    return () => controller.abort();
  }, [resource.url, resource.format, retry]);
  if (resource.format === 'WORD')
    return (
      <div className="toeic-empty toeic-word-preview">
        <DescriptionOutlined />
        <h2>{t('Tài liệu Word')}</h2>
        <p>{resource.filename}</p>
        <a className="toeic-button toeic-button-dark" href={resource.url} download={resource.filename}>
          <DownloadRounded fontSize="small" />
          {t('Tải tài liệu Word')}
        </a>
      </div>
    );
  if (state.error)
    return (
      <div className="toeic-empty" role="alert">
        <DescriptionOutlined />
        <h2>{t('Không thể mở tài liệu')}</h2>
        <p>{t('Kiểm tra kết nối hoặc thử mở PDF trong thẻ mới.')}</p>
        <div className="toeic-inline-actions">
          <button
            className="toeic-button toeic-button-outline"
            type="button"
            onClick={() => {
              setState({ loading: true, error: false });
              setRetry(value => value + 1);
            }}
          >
            {t('Thử lại')}
          </button>
          <a
            className="toeic-button toeic-button-dark"
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('Mở PDF trong thẻ mới')}
          </a>
        </div>
      </div>
    );
  return (
    <div className="toeic-pdf-container" aria-busy={state.loading}>
      {state.loading ? (
        <p className="toeic-pdf-loading" role="status">
          {t('Đang mở tài liệu...')}
        </p>
      ) : (
        <iframe
          className="toeic-pdf-viewer"
          title={t('Đọc {name}', { name: toeicDocumentLabel(resource, t) })}
          src={`${resource.url}#view=FitH&navpanes=0`}
        />
      )}
    </div>
  );
}

export default function ToeicReaderPage() {
  useLocale();
  const { testId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { bookmarks, toggle } = useToeicBookmarks();
  const test = toeicCatalog.tests.find(item => item.id === testId);
  if (!test)
    return (
      <div className="toeic-empty">
        <MenuBookOutlined />
        <h1>{t('Không tìm thấy bộ đề')}</h1>
        <p>{t('Bộ đề này hiện không có trong thư viện tài liệu.')}</p>
        <Link className="toeic-button toeic-button-dark" to={ROUTES.TOEIC}>
          {t('Về thư viện TOEIC')}
        </Link>
      </div>
    );
  const resources = [
    ...test.resources,
    ...toeicCatalog.documents.filter(resource => resource.type === 'answer' && resource.testNumber == null),
  ];
  const resource =
    resources.find(item => resourceKey(item) === params.get('document')) ??
    resources.find(item => item.type === 'reading') ??
    resources[0];
  const saved = bookmarks.includes(test.id);
  const currentIndex = toeicCatalog.tests.indexOf(test);
  const Icon = typeIcons[resource.type];
  return (
    <>
      <div className="toeic-reader-back">
        <Link to={ROUTES.TOEIC}>
          <ArrowBackRounded fontSize="small" />
          {t('Tất cả bộ đề')}
        </Link>
        <label>
          {t('Chuyển bộ đề')}
          <select
            aria-label={t('Chuyển bộ đề')}
            value={test.id}
            onChange={event =>
              navigate(toeicTestUrl(event.target.value, params.get('document') ?? 'reading'))
            }
          >
            {toeicCatalog.tests.map(item => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      <header className="toeic-page-heading">
        <div>
          <h1>{test.title}</h1>
          <p>{t('Mở đề, tự luyện và đối chiếu lời giải trong cùng một không gian.')}</p>
        </div>
        <button
          className={`toeic-button toeic-button-outline ${saved ? 'is-saved' : ''}`}
          type="button"
          aria-pressed={saved}
          onClick={() => toggle(test.id)}
        >
          {saved ? <BookmarkRounded fontSize="small" /> : <BookmarkBorderOutlined fontSize="small" />}
          {t(saved ? 'Đã lưu bộ đề' : 'Lưu bộ đề')}
        </button>
      </header>
      <div className="toeic-reader-grid">
        <section className="toeic-reader-stage" aria-label={t('Trình đọc tài liệu')}>
          <div className="toeic-reader-toolbar">
            <div>
              <span className={`toeic-document-icon tone-${DOCUMENT_TYPES[resource.type].tone}`}>
                <Icon />
              </span>
              <div>
                <h2>{toeicDocumentLabel(resource, t)}</h2>
                <span>{resource.format}</span>
              </div>
            </div>
            <div className="toeic-reader-tools">
              <a
                className="toeic-icon-button"
                href={resource.url}
                download={resource.filename}
                aria-label={t('Tải xuống tài liệu')}
              >
                <DownloadRounded />
              </a>
              <a
                className="toeic-icon-button"
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('Mở tài liệu trong thẻ mới')}
              >
                <OpenInNewRounded />
              </a>
            </div>
          </div>
          <DocumentViewer key={resource.id} resource={resource} />
          {resource.format === 'PDF' && (
            <div className="toeic-pdf-help">
              <InfoOutlined fontSize="small" />
              <p>{t('Nếu trình duyệt không hiển thị PDF, hãy mở trong thẻ mới hoặc tải xuống để đọc.')}</p>
              <a href={resource.url} target="_blank" rel="noopener noreferrer">
                {t('Mở PDF trong thẻ mới')}
              </a>
            </div>
          )}
        </section>
        <aside className="toeic-reader-sidebar">
          <section className="toeic-reader-resources">
            <h2>{t('Tài liệu trong bộ đề')}</h2>
            <p>{t('Đề thi, đáp án và giải chi tiết')}</p>
            <div>
              {resources.map(item => {
                const ResourceIcon = typeIcons[item.type];
                return (
                  <button
                    type="button"
                    key={item.id}
                    className={item.id === resource.id ? 'is-active' : ''}
                    aria-pressed={item.id === resource.id}
                    onClick={() => setParams({ document: resourceKey(item) }, { replace: true })}
                  >
                    <ResourceIcon fontSize="small" />
                    <span>
                      <strong>
                        {item.type === 'answer'
                          ? toeicDocumentLabel(item, t)
                          : t(DOCUMENT_TYPES[item.type].label)}
                      </strong>
                      <small>
                        {item.format}
                        {item.section ? ` — ${item.section}` : ''}
                      </small>
                    </span>
                    <ArrowForwardRounded fontSize="small" />
                  </button>
                );
              })}
            </div>
          </section>
          {['reading', 'listening'].includes(resource.type) && (
            <StudyTimer key={resource.id} minutes={resource.type === 'reading' ? 75 : 45} />
          )}
          <div className="toeic-reader-note">
            <InfoOutlined fontSize="small" />
            <p>
              {t(
                resource.type === 'listening'
                  ? 'Đây là đề Listening dạng PDF. Audio không nằm trong thư viện này.'
                  : 'Tự đối chiếu bài làm với bảng đáp án và lời giải. Trang đọc PDF không tự chấm điểm.',
              )}
            </p>
          </div>
        </aside>
      </div>
      <nav className="toeic-test-pagination" aria-label={t('Chuyển bộ đề')}>
        {currentIndex > 0 ? (
          <Link
            className="toeic-button toeic-button-outline"
            to={toeicTestUrl(toeicCatalog.tests[currentIndex - 1].id)}
          >
            <ArrowBackRounded fontSize="small" />
            {t('Bộ đề trước')}
          </Link>
        ) : (
          <span />
        )}
        <span>
          {t('Bộ đề {current} / {total}', { current: currentIndex + 1, total: toeicCatalog.tests.length })}
        </span>
        {currentIndex < toeicCatalog.tests.length - 1 ? (
          <Link
            className="toeic-button toeic-button-outline"
            to={toeicTestUrl(toeicCatalog.tests[currentIndex + 1].id)}
          >
            {t('Bộ đề tiếp theo')}
            <ArrowForwardRounded fontSize="small" />
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </>
  );
}
