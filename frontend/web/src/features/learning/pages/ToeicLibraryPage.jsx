import { useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Pagination from '@mui/material/Pagination';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import BookmarkBorderOutlined from '@mui/icons-material/BookmarkBorderOutlined';
import BookmarkRounded from '@mui/icons-material/BookmarkRounded';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import AccessTimeRounded from '@mui/icons-material/AccessTimeRounded';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorState from '../../../shared/components/ErrorState';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { toeicApi } from '../api/toeicApi';
import useLearningResource from '../hooks/useLearningResource';
import useToeicBookmarks from '../hooks/useToeicBookmarks';

const EMPTY = [];
const PAGE_SIZE = 6;
const normalize = value =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

export default function ToeicLibraryPage() {
  useLocale();
  const [params, setParams] = useSearchParams();
  const { bookmarks, toggle } = useToeicBookmarks();
  const resultsHeading = useRef(null);
  const load = useCallback(options => toeicApi.list(options), []);
  const { data: exams, error, loading, reload } = useLearningResource(load, EMPTY);
  const query = params.get('q') ?? '';
  const savedOnly = params.get('view') === 'saved';
  const search = normalize(query.trim());
  const exactNumber = search.match(/^(?:test\s*)?0*(\d+)$/)?.[1];
  const filtered = exams.filter(exam => {
    const title = normalize(exam.title);
    const matches =
      !search ||
      (exactNumber
        ? Number(title.match(/test\s*0*(\d+)/)?.[1]) === Number(exactNumber)
        : normalize(`${exam.title} ${exam.description} ${exam.sourceLabel}`).includes(search));
    return matches && (!savedOnly || bookmarks.includes(String(exam.id)));
  });
  filtered.sort((left, right) =>
    String(left.title).localeCompare(String(right.title), undefined, { numeric: true, sensitivity: 'base' }),
  );
  if (params.get('sort') === 'desc') filtered.reverse();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requested = Number(params.get('page') ?? 1);
  const page = Number.isSafeInteger(requested) && requested > 0 ? Math.min(requested, totalPages) : 1;
  const start = (page - 1) * PAGE_SIZE;
  const rows = filtered.slice(start, start + PAGE_SIZE);
  function filter(key, value) {
    const next = new URLSearchParams(params);
    next.delete('page');
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  }
  function changePage(_event, value) {
    const next = new URLSearchParams(params);
    value === 1 ? next.delete('page') : next.set('page', String(value));
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
              'Học kiến thức, luyện từng Part và thi thử Reading ngay trên web. Đáp án và lời giải xuất hiện sau khi nộp bài.',
            )}
          </p>
        </div>
        <span className="toeic-pill">
          <CheckCircleOutlineOutlined fontSize="small" />
          TOEIC Reading
        </span>
      </header>
      <section className="toeic-featured" aria-labelledby="toeic-collection-title">
        <div className="toeic-featured-icon">
          <MenuBookOutlined />
        </div>
        <div className="toeic-featured-copy">
          <div className="toeic-featured-tags">
            <span>ETS 2024</span>
            <span>Reading · Part 5, 6, 7</span>
          </div>
          <h2 id="toeic-collection-title">{t('Học để hiểu. Luyện để tiến bộ.')}</h2>
          <p>{t('Bài học, bài tập tương tác và kết quả được lưu trong tài khoản của bạn.')}</p>
        </div>
        {!loading && !error && exams[0] && (
          <Link className="toeic-button button-primary" to={`/exams/toeic/tests/${exams[0].id}`}>
            {t('Bắt đầu luyện tập')}
            <ArrowForwardRounded fontSize="small" />
          </Link>
        )}
      </section>
      <div className="toeic-learning-steps">
        <div>
          <span>01</span>
          <strong>{t('Học theo từng Part')}</strong>
          <p>{t('Đọc kiến thức và đánh dấu bài học đã hoàn thành.')}</p>
        </div>
        <div>
          <span>02</span>
          <strong>{t('Luyện tập hoặc thi thử')}</strong>
          <p>{t('Chọn đáp án trực tiếp; bài làm được lưu để tiếp tục.')}</p>
        </div>
        <div>
          <span>03</span>
          <strong>{t('Xem lại để cải thiện')}</strong>
          <p>{t('Biết câu đúng, câu sai và đọc lời giải chi tiết.')}</p>
        </div>
      </div>
      <div className="toeic-library-heading" ref={resultsHeading}>
        <div className="toeic-tabs" aria-label={t('Nội dung thư viện')}>
          <button
            type="button"
            className={!savedOnly ? 'is-active' : ''}
            aria-pressed={!savedOnly}
            onClick={() => filter('view', '')}
          >
            {t('Bộ đề luyện tập')}
          </button>
          <button
            type="button"
            className={savedOnly ? 'is-active' : ''}
            aria-pressed={savedOnly}
            onClick={() => filter('view', 'saved')}
          >
            {t('Đề đã lưu')}
            <small>{exams.filter(exam => bookmarks.includes(String(exam.id))).length}</small>
          </button>
        </div>
        <span className="toeic-results-count">{t('{count} kết quả', { count: filtered.length })}</span>
      </div>
      <div className="toeic-filter-bar">
        <label className="toeic-library-search">
          <SearchRounded fontSize="small" />
          <input
            type="search"
            value={query}
            aria-label={t('Tìm bộ đề TOEIC')}
            placeholder={t('Tìm theo tên bộ đề...')}
            onChange={event => filter('q', event.target.value)}
          />
        </label>
        <label className="toeic-select">
          <span>{t('Sắp xếp')}</span>
          <select
            aria-label={t('Sắp xếp bộ đề')}
            value={params.get('sort') === 'desc' ? 'desc' : 'asc'}
            onChange={event => filter('sort', event.target.value)}
          >
            <option value="asc">{t('Test tăng dần')}</option>
            <option value="desc">{t('Test giảm dần')}</option>
          </select>
        </label>
      </div>
      {loading ? (
        <p className="toeic-loading" role="status">
          {t('Đang tải bộ đề...')}
        </p>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : rows.length === 0 ? (
        <div className="toeic-empty">
          <SearchRounded />
          <h2>
            {t(
              savedOnly
                ? 'Bạn chưa lưu bộ đề phù hợp'
                : exams.length
                  ? 'Không tìm thấy bộ đề phù hợp'
                  : 'Chưa có bộ đề được xuất bản',
            )}
          </h2>
          <p>
            {t(
              exams.length
                ? 'Thử từ khóa khác hoặc bỏ bộ lọc để xem lại.'
                : 'Nội dung học tập sẽ xuất hiện sau khi Admin xuất bản bộ đề.',
            )}
          </p>
          {exams.length > 0 && (
            <button type="button" className="toeic-button toeic-button-outline" onClick={() => setParams({})}>
              {t('Xem tất cả bộ đề')}
            </button>
          )}
        </div>
      ) : (
        <div className="toeic-test-grid">
          {rows.map((exam, index) => {
            const saved = bookmarks.includes(String(exam.id));
            return (
              <article className="toeic-test-card" key={exam.id}>
                <div className="toeic-test-card-top">
                  <span className="toeic-test-edition">{exam.sourceLabel || 'TOEIC Reading'}</span>
                  <button
                    type="button"
                    className={`toeic-icon-button toeic-save ${saved ? 'is-saved' : ''}`}
                    aria-label={t(saved ? 'Bỏ lưu {name}' : 'Lưu {name}', { name: exam.title })}
                    aria-pressed={saved}
                    onClick={() => toggle(String(exam.id))}
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
                    <h2>{exam.title}</h2>
                    <p>{exam.description || t('Học và luyện TOEIC Reading')}</p>
                  </div>
                  <span className={`toeic-book-symbol tone-${index % 2 ? 'violet' : 'blue'}`}>
                    <MenuBookOutlined />
                  </span>
                </div>
                <div className="toeic-test-tags">
                  <span>Part 5</span>
                  <span>Part 6</span>
                  <span>Part 7</span>
                </div>
                <div className="toeic-test-meta">
                  <span>
                    <MenuBookOutlined />
                    {t('{count} bài học', { count: exam.lessonCount })}
                  </span>
                  <span>
                    <FactCheckOutlined />
                    {t('{count} câu hỏi', { count: exam.questionCount })}
                  </span>
                  <span>
                    <AccessTimeRounded />
                    {t('{minutes} phút', { minutes: exam.durationMinutes })}
                  </span>
                </div>
                <Link className="toeic-test-action" to={`/exams/toeic/tests/${exam.id}`}>
                  {t('Vào học và luyện tập')}
                  <ArrowForwardRounded fontSize="small" />
                </Link>
              </article>
            );
          })}
        </div>
      )}
      {!loading && !error && totalPages > 1 && (
        <div className="toeic-library-pagination">
          <span role="status">
            {t('Hiển thị {from}–{to} / {total} kết quả', {
              from: start + 1,
              to: Math.min(start + PAGE_SIZE, filtered.length),
              total: filtered.length,
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
            getItemAriaLabel={(type, number) =>
              type === 'page'
                ? t('Trang {page}', { page: number })
                : type === 'previous'
                  ? t('Trang trước')
                  : type === 'next'
                    ? t('Trang sau')
                    : undefined
            }
          />
        </div>
      )}
    </>
  );
}
