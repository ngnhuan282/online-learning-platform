import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Pagination from '@mui/material/Pagination';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import BookmarkBorderOutlined from '@mui/icons-material/BookmarkBorderOutlined';
import BookmarkRounded from '@mui/icons-material/BookmarkRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import GridViewOutlined from '@mui/icons-material/GridViewOutlined';
import ViewListOutlined from '@mui/icons-material/ViewListOutlined';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import DownloadRounded from '@mui/icons-material/DownloadRounded';
import InfoOutlined from '@mui/icons-material/InfoOutlined';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { toeicCatalog } from '../data/toeicResources';
import {
  DOCUMENT_TYPES,
  filterToeicDocuments,
  filterToeicTests,
  toeicTestUrl,
  toeicDocumentLabel,
} from '../utils/toeicCatalog';
import useToeicBookmarks from '../hooks/useToeicBookmarks';

const typeIcons = {
  reading: MenuBookOutlined,
  listening: HeadphonesOutlined,
  solution: FactCheckOutlined,
  answer: DescriptionOutlined,
  document: DescriptionOutlined,
};
const PAGE_SIZE = 6;

export default function ToeicLibraryPage() {
  useLocale();
  const [params, setParams] = useSearchParams();
  const { bookmarks, toggle } = useToeicBookmarks();
  const resultsHeading = useRef(null);
  const query = params.get('q') ?? '';
  const type = Object.hasOwn(DOCUMENT_TYPES, params.get('type')) ? params.get('type') : 'all';
  const view =
    params.get('view') === 'saved' ? 'saved' : params.get('view') === 'documents' ? 'documents' : 'tests';
  const ascending = params.get('sort') !== 'desc';
  const tests = filterToeicTests(toeicCatalog.tests, { query, type, savedOnly: view === 'saved', bookmarks });
  if (!ascending) tests.reverse();
  const filteredDocuments = filterToeicDocuments(toeicCatalog.documents, { query, type }, t);
  const rows = view === 'documents' ? filteredDocuments : tests;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const requestedPage = Number(params.get('page') ?? 1);
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, totalPages) : 1;
  const start = (page - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(start, start + PAGE_SIZE);
  function filter(key, value) {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }
  function chooseType(value) {
    const next = new URLSearchParams(params);
    next.delete('page');
    value === 'all' ? next.delete('type') : next.set('type', value);
    if (value === 'answer' || value === 'solution') next.set('view', 'documents');
    setParams(next, { replace: true });
  }
  function changePage(_event, value) {
    const next = new URLSearchParams(params);
    if (value === 1) next.delete('page');
    else next.set('page', String(value));
    setParams(next);
    resultsHeading.current?.scrollIntoView?.({ block: 'start' });
  }
  return (
    <>
      <header className="toeic-page-heading">
        <div>
          <h1>{t('Luyện thi TOEIC')}</h1>
          <p>
            {t(
              'Bắt đầu từ một bộ đề. Luyện tập, đối chiếu đáp án và hiểu rõ từng câu với thư viện ETS 2024.',
            )}
          </p>
        </div>
        <span className="toeic-pill">
          <CheckCircleOutlineOutlined fontSize="small" />
          {t('Tài liệu của bạn')}
        </span>
      </header>

      <section className="toeic-featured" aria-labelledby="toeic-collection-title">
        <div className="toeic-featured-icon">
          <MenuBookOutlined />
        </div>
        <div className="toeic-featured-copy">
          <div className="toeic-featured-tags">
            <span>ETS 2024</span>
            <span>TOEIC Listening & Reading</span>
          </div>
          <h2 id="toeic-collection-title">{t('Một bộ tài liệu. Trọn lộ trình ôn tập.')}</h2>
          <p>
            {t('{tests} bộ đề, {documents} tài liệu — từ đề thi đến lời giải chi tiết.', {
              tests: toeicCatalog.tests.length,
              documents: toeicCatalog.documents.length,
            })}
          </p>
        </div>
        {toeicCatalog.tests[0] && (
          <Link className="toeic-button button-primary" to={toeicTestUrl(toeicCatalog.tests[0].id)}>
            {t('Bắt đầu luyện tập')}
            <ArrowForwardRounded fontSize="small" />
          </Link>
        )}
      </section>

      <div className="toeic-resource-types" aria-label={t('Nhóm tài liệu')}>
        {['reading', 'listening', 'solution', 'answer'].map(key => {
          const Icon = typeIcons[key];
          const count = toeicCatalog.documents.filter(
            document => document.type === key && document.format === 'PDF',
          ).length;
          return (
            <button
              key={key}
              type="button"
              className={`toeic-type-card tone-${DOCUMENT_TYPES[key].tone} ${type === key ? 'is-selected' : ''}`}
              aria-pressed={type === key}
              onClick={() => chooseType(type === key ? 'all' : key)}
            >
              <span className="toeic-type-icon">
                <Icon />
              </span>
              <span>
                <strong>{t(DOCUMENT_TYPES[key].label)}</strong>
                <small>{t('{count} tài liệu PDF', { count })}</small>
              </span>
              <ChevronIcon />
            </button>
          );
        })}
      </div>

      <div className="toeic-library-heading" ref={resultsHeading}>
        <div className="toeic-tabs" aria-label={t('Nội dung thư viện')}>
          {[
            ['tests', 'Bộ đề luyện tập'],
            ['documents', 'Tất cả tài liệu'],
            ['saved', 'Đề đã lưu'],
          ].map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={view === key ? 'is-active' : ''}
              aria-pressed={view === key}
              onClick={() => filter('view', key === 'tests' ? '' : key)}
            >
              {t(label)}
              {key === 'saved' && <small>{bookmarks.length}</small>}
            </button>
          ))}
        </div>
        <span className="toeic-results-count">{t('{count} kết quả', { count: rows.length })}</span>
      </div>
      <div className="toeic-filter-bar">
        <label className="toeic-library-search">
          <SearchRounded fontSize="small" />
          <input
            type="search"
            aria-label={t('Tìm trong thư viện TOEIC')}
            placeholder={t('Tìm theo tên bộ đề, tài liệu...')}
            value={query}
            onChange={event => filter('q', event.target.value)}
          />
        </label>
        <label className="toeic-select">
          <span>{t('Loại tài liệu')}</span>
          <select
            aria-label={t('Loại tài liệu')}
            value={type}
            onChange={event => chooseType(event.target.value)}
          >
            <option value="all">{t('Tất cả tài liệu')}</option>
            {Object.entries(DOCUMENT_TYPES).map(([key, item]) => (
              <option value={key} key={key}>
                {t(item.label)}
              </option>
            ))}
          </select>
        </label>
        {view !== 'documents' && (
          <label className="toeic-select">
            <span>{t('Sắp xếp')}</span>
            <select
              aria-label={t('Sắp xếp bộ đề')}
              value={ascending ? 'asc' : 'desc'}
              onChange={event => filter('sort', event.target.value)}
            >
              <option value="asc">{t('Test tăng dần')}</option>
              <option value="desc">{t('Test giảm dần')}</option>
            </select>
          </label>
        )}
        <span className="toeic-view-indicator" aria-hidden="true">
          {view === 'documents' ? <ViewListOutlined /> : <GridViewOutlined />}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="toeic-empty">
          <SearchRounded />
          <h2>
            {t(
              view === 'saved' && !query && type === 'all'
                ? 'Bạn chưa lưu bộ đề nào'
                : 'Không tìm thấy tài liệu phù hợp',
            )}
          </h2>
          <p>
            {t(
              view === 'saved'
                ? 'Nhấn biểu tượng đánh dấu trên bộ đề để dễ dàng tìm lại.'
                : 'Thử một từ khóa khác hoặc xóa bộ lọc để xem tất cả.',
            )}
          </p>
          <button className="toeic-button toeic-button-outline" type="button" onClick={() => setParams({})}>
            {t('Xem tất cả bộ đề')}
          </button>
        </div>
      ) : view === 'documents' ? (
        <div className="toeic-document-list">
          {visibleRows.map(document => {
            const Icon = typeIcons[document.type];
            return (
              <article className="toeic-document-row" key={document.id}>
                <span className={`toeic-document-icon tone-${DOCUMENT_TYPES[document.type].tone}`}>
                  <Icon />
                </span>
                <div>
                  <h2>{toeicDocumentLabel(document, t)}</h2>
                  <p title={document.filename}>{document.filename}</p>
                </div>
                <span className="toeic-format">{document.format}</span>
                {document.format === 'PDF' &&
                  (document.testNumber ? (
                    <Link className="toeic-text-link" to={toeicTestUrl(document.testNumber, document.type)}>
                      {t('Đọc tài liệu')}
                      <ArrowForwardRounded fontSize="small" />
                    </Link>
                  ) : (
                    <a
                      className="toeic-text-link"
                      href={document.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('Đọc tài liệu')}
                      <ArrowForwardRounded fontSize="small" />
                    </a>
                  ))}
                <a
                  className="toeic-icon-button"
                  href={document.url}
                  download={document.filename}
                  aria-label={t('Tải xuống {name}', { name: document.filename })}
                >
                  <DownloadRounded fontSize="small" />
                </a>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="toeic-test-grid">
          {visibleRows.map(test => {
            const saved = bookmarks.includes(test.id);
            const selectedType = ['reading', 'listening', 'solution'].includes(type)
              ? type
              : test.resources.some(resource => resource.type === 'reading')
                ? 'reading'
                : (test.resources.find(resource => resource.format === 'PDF')?.type ?? 'reading');
            return (
              <article className="toeic-test-card" key={test.id}>
                <div className="toeic-test-card-top">
                  <span className="toeic-test-edition">ETS 2024</span>
                  <button
                    type="button"
                    className={`toeic-icon-button toeic-save ${saved ? 'is-saved' : ''}`}
                    onClick={() => toggle(test.id)}
                    aria-pressed={saved}
                    aria-label={t(saved ? 'Bỏ lưu {name}' : 'Lưu {name}', { name: test.title })}
                  >
                    {saved ? (
                      <BookmarkRounded fontSize="small" />
                    ) : (
                      <BookmarkBorderOutlined fontSize="small" />
                    )}
                  </button>
                </div>
                <div className="toeic-test-title">
                  <div>
                    <h2>{test.title}</h2>
                    <p>{t('Bộ đề luyện tập TOEIC')}</p>
                  </div>
                  <span
                    className={`toeic-book-symbol tone-${Number(test.id) % 3 === 0 ? 'violet' : Number(test.id) % 2 === 0 ? 'orange' : 'blue'}`}
                  >
                    <MenuBookOutlined />
                  </span>
                </div>
                <div className="toeic-test-tags">
                  {['reading', 'listening', 'solution']
                    .filter(key =>
                      test.resources.some(resource => resource.type === key && resource.format === 'PDF'),
                    )
                    .map(key => (
                      <span key={key}>{t(DOCUMENT_TYPES[key].shortLabel)}</span>
                    ))}
                </div>
                <div className="toeic-test-meta">
                  <span>
                    <DescriptionOutlined />
                    {t('{count} tài liệu', { count: test.resources.length })}
                  </span>
                  {test.resources.some(resource => resource.type === 'reading') && (
                    <span>
                      <AccessTimeRounded />
                      {t('Reading 75 phút')}
                    </span>
                  )}
                </div>
                <Link className="toeic-test-action" to={toeicTestUrl(test.id, selectedType)}>
                  {t('Vào luyện')}
                  <ArrowForwardRounded fontSize="small" />
                </Link>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="toeic-library-pagination">
          <span role="status">
            {t('Hiển thị {from}–{to} / {total} kết quả', {
              from: start + 1,
              to: Math.min(start + PAGE_SIZE, rows.length),
              total: rows.length,
            })}
          </span>
          <Pagination
            aria-label={t('Phân trang thư viện TOEIC')}
            count={totalPages}
            page={page}
            onChange={changePage}
            color="primary"
            shape="rounded"
            size="small"
            siblingCount={0}
            getItemAriaLabel={(itemType, itemPage) => {
              if (itemType === 'page') return t('Trang {page}', { page: itemPage });
              if (itemType === 'previous') return t('Trang trước');
              if (itemType === 'next') return t('Trang sau');
              return undefined;
            }}
          />
        </div>
      )}

      <section className="toeic-study-guide" aria-labelledby="toeic-guide-title">
        <div className="toeic-section-title">
          <MenuBookOutlined />
          <h2 id="toeic-guide-title">{t('Luyện tập theo cách của bạn')}</h2>
        </div>
        <div className="toeic-guide-grid">
          <article>
            <span>01</span>
            <h3>{t('Chọn một đề để bắt đầu')}</h3>
            <p>
              {t(
                'Mở đề Reading hoặc Listening PDF. Tài liệu được sắp xếp theo từng test để bạn dễ theo dõi.',
              )}
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>{t('Tập trung vào phần cần cải thiện')}</h3>
            <p>
              {t(
                'Đọc đề trực tiếp trên trang, dùng đồng hồ tự luyện và tải tài liệu khi cần học ngoại tuyến.',
              )}
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>{t('Hiểu đáp án, thay vì chỉ nhớ')}</h3>
            <p>{t('Sau khi luyện tập, mở bảng đáp án và ebook giải chi tiết tương ứng để đối chiếu.')}</p>
          </article>
        </div>
      </section>
      <div className="toeic-library-note">
        <InfoOutlined fontSize="small" />
        <p>
          {t(
            'Listening hiện có đề PDF; audio không được đưa vào thư viện này. Đề đã lưu được giữ trên trình duyệt của bạn.',
          )}
        </p>
      </div>
    </>
  );
}

function ChevronIcon() {
  return <ArrowForwardRounded className="toeic-type-arrow" fontSize="small" />;
}
