import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Chip,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Pagination,
  Skeleton,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  AccessTimeOutlined,
  ArrowForwardRounded,
  FilterListRounded,
  HeadphonesOutlined,
  LockOutlined,
  ListAltOutlined,
  AssignmentTurnedInOutlined,
  CheckCircleOutlineRounded,
  PlayCircleOutlineRounded,
  SearchOutlined,
  SubjectOutlined,
} from '@mui/icons-material';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import ErrorState from '../../../shared/components/ErrorState';
import EmptyState from '../../../shared/components/EmptyState';
import { dictationApi } from '../api/dictationApi';
import { useDictationQuery } from '../hooks/useDictationQuery';
import { formatTime, LEVELS, scoreFeedback } from '../utils/dictation';
import DictationScore from '../components/DictationScore';
import '../styles/dictation.css';

export default function DictationLibraryPage() {
  useLocale();
  const [tab, setTab] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const pageSize = tab ? 20 : 12;
  const { data, loading, error, reload } = useDictationQuery(
    tab ? dictationApi.historyPath : dictationApi.catalogPath,
    {
      keyword: query,
      level,
      topic,
      page,
      size: pageSize,
      ...(tab ? { status: status === 'ALL' ? '' : status } : {}),
    },
  );
  const items = data?.items ?? [];
  const filtered = Boolean(keyword || query || level || topic || (tab && status !== 'ALL'));
  function resetFilters() {
    setKeyword('');
    setQuery('');
    setLevel('');
    setTopic('');
    setStatus('ALL');
    setPage(0);
  }
  return (
    <section className="dictation-page">
      <div className="container dictation-shell">
        <header className="dictation-heading">
          <div>
            <span className="dictation-eyebrow">{t('GÓC LUYỆN TẬP')}</span>
            <h1>{t('Luyện nghe chép chính tả')}</h1>
          </div>
          <span className="dictation-heading-icon">
            <HeadphonesOutlined />
          </span>
        </header>
        <Tabs
          value={tab}
          onChange={(_e, value) => {
            setTab(value);
            resetFilters();
          }}
          aria-label={t('Bài nghe và tiến độ')}
        >
          <Tab label={t('Thư viện bài nghe')} icon={<HeadphonesOutlined />} iconPosition="start" />
          <Tab label={t('Tiến độ bài học')} icon={<AssignmentTurnedInOutlined />} iconPosition="start" />
        </Tabs>
        <form
          className={`dictation-filters ${tab ? 'is-history' : ''}`}
          onSubmit={event => {
            event.preventDefault();
            setQuery(keyword);
            setPage(0);
            reload();
          }}
        >
          <div className="dictation-filter-heading">
            <span>
              <FilterListRounded fontSize="small" />
              {t('Bộ lọc')}
            </span>
            {Boolean(tab) && (
              <ToggleButtonGroup
                className="dictation-progress-tabs"
                value={status}
                exclusive
                size="small"
                aria-label={t('Trạng thái bài nghe')}
                onChange={(_event, value) => {
                  if (!value) return;
                  setStatus(value);
                  setPage(0);
                }}
              >
                <ToggleButton value="ALL">
                  <ListAltOutlined fontSize="small" />
                  {t('Tất cả')}
                </ToggleButton>
                <ToggleButton value="IN_PROGRESS">
                  <PlayCircleOutlineRounded fontSize="small" />
                  {t('Đang luyện')}
                </ToggleButton>
                <ToggleButton value="COMPLETED">
                  <CheckCircleOutlineRounded fontSize="small" />
                  {t('Đã hoàn thành')}
                </ToggleButton>
              </ToggleButtonGroup>
            )}
            {filtered && (
              <Button size="small" onClick={resetFilters}>
                {t('Xóa bộ lọc')}
              </Button>
            )}
          </div>
          <TextField
            className="dictation-search"
            size="small"
            placeholder={t('Tìm bài nghe')}
            value={keyword}
            onChange={event => setKeyword(event.target.value)}
            slotProps={{
              htmlInput: { 'aria-label': t('Tìm bài nghe') },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <TextField
            select
            size="small"
            slotProps={{ select: { displayEmpty: true, inputProps: { 'aria-label': t('Trình độ') } } }}
            value={level}
            onChange={event => {
              setLevel(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">{t('Tất cả trình độ')}</MenuItem>
            {LEVELS.map(value => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            slotProps={{ select: { displayEmpty: true, inputProps: { 'aria-label': t('Chủ đề') } } }}
            value={topic}
            onChange={event => {
              setTopic(event.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">{t('Tất cả chủ đề')}</MenuItem>
            {[...new Set([...(data?.topics ?? []), ...(topic ? [topic] : [])])].map(value => (
              <MenuItem key={value} value={value}>
                {value}
              </MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant={tab ? 'contained' : 'outlined'} startIcon={<SearchOutlined />}>
            {t('Tìm kiếm')}
          </Button>
        </form>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <div className={tab ? 'dictation-history' : 'dictation-library-grid'}>
            {[1, 2, 3].map(value => (
              <Skeleton key={value} variant="rounded" height={tab ? 108 : 250} />
            ))}
          </div>
        ) : !items.length ? (
          <EmptyState
            title={
              tab
                ? filtered
                  ? 'Chưa có bài nghe phù hợp'
                  : status === 'COMPLETED'
                    ? 'Chưa có bài nghe đã hoàn thành'
                    : 'Chưa có bài nghe đang luyện'
                : 'Chưa có bài nghe phù hợp'
            }
            action={filtered && <Button onClick={resetFilters}>{t('Xóa bộ lọc')}</Button>}
          />
        ) : tab ? (
          <>
            <p className="dictation-count">
              {data.total} {t('bài nghe')}
            </p>
            <div className="dictation-history">
              {items.map(item => {
                const finished = Boolean(item.completedAt);
                const feedback = scoreFeedback(item.accuracy);
                const total = item.sentences.length;
                const progress = total ? (item.completed / total) * 100 : 0;
                return (
                  <article
                    key={item.id}
                    className={`dictation-history-row ${finished ? 'is-complete' : 'is-in-progress'}`}
                  >
                    <span className="dictation-list-icon">
                      <HeadphonesOutlined />
                    </span>
                    <div className="dictation-history-detail">
                      <div className="dictation-history-title">
                        <h2>{item.title}</h2>
                        <Chip size="small" className="dictation-history-level" label={item.level} />
                        {item.archived && !finished && (
                          <Chip size="small" variant="outlined" label={t('Hiện không khả dụng')} />
                        )}
                      </div>
                      <div className="dictation-history-meta">
                        <span>
                          <AccessTimeOutlined />
                          <time dateTime={item.startedAt}>
                            {new Date(item.startedAt).toLocaleString(getIntlLocale())}
                          </time>
                        </span>
                        {finished && (
                          <span>
                            {item.completed}/{total} {t('câu đã luyện')}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`dictation-history-score ${finished ? 'has-result' : ''}`}>
                      {finished ? (
                        <>
                          <DictationScore attempt={item} compact />
                          <div className="dictation-history-result-copy">
                            <span>{t('Điểm')}</span>
                            <strong
                              className={`dictation-score-feedback dictation-score-tone is-${feedback.tone}`}
                            >
                              {t(feedback.label)}
                            </strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <span>{t('Tiến độ bài nghe')}</span>
                          <strong className="dictation-history-progress-count">
                            {item.completed}/{total} <small>{t('câu nghe')}</small>
                          </strong>
                          <LinearProgress
                            aria-label={t('Tiến độ bài nghe')}
                            variant="determinate"
                            value={progress}
                          />
                        </>
                      )}
                    </div>
                    {item.archived && !finished ? (
                      <Tooltip
                        describeChild
                        title={t('Bài nghe hiện không khả dụng. Tiến độ của bạn vẫn được lưu.')}
                      >
                        <span className="dictation-history-unavailable" tabIndex={0}>
                          <Button variant="outlined" disabled startIcon={<LockOutlined />}>
                            {t('Tiếp tục')}
                          </Button>
                        </span>
                      </Tooltip>
                    ) : (
                      <Button
                        component={Link}
                        to={`/dictation/${item.exerciseId}?attempt=${item.id}`}
                        variant={finished ? 'outlined' : 'contained'}
                        endIcon={<ArrowForwardRounded />}
                      >
                        {t(finished ? 'Xem kết quả' : 'Tiếp tục')}
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="dictation-count">
              {data.total} {t('bài nghe')}
            </p>
            <div className="dictation-library-grid">
              {items.map(item => (
                <article key={item.id} className="dictation-lesson-card">
                  <div className="dictation-lesson-art">
                    <span className="dictation-cover-icon">
                      <HeadphonesOutlined />
                    </span>
                    <span>
                      <small>Audio</small>
                      {item.topic}
                    </span>
                    <Chip label={item.level} size="small" />
                  </div>
                  <div className="dictation-lesson-body">
                    <h2>{item.title}</h2>
                    <p title={item.description || undefined}>{item.description}</p>
                    <div className="dictation-lesson-footer">
                      <div className="dictation-lesson-meta">
                        <span>
                          <AccessTimeOutlined />
                          {formatTime(item.duration)}
                        </span>
                        <span>
                          <SubjectOutlined />
                          {t('{count} câu', { count: item.sentenceCount })}
                        </span>
                      </div>
                      <div className="dictation-progress-note">
                        {item.attemptId && (
                          <>
                            <span>
                              {item.completed}/{item.progressTotal} {t('câu đã luyện')}
                            </span>
                            <strong>{t(item.attemptCompleted ? 'Đã hoàn thành' : 'Đang luyện')}</strong>
                          </>
                        )}
                      </div>
                      <Button
                        fullWidth
                        component={Link}
                        to={`/dictation/${item.id}${item.attemptId ? `?attempt=${item.attemptId}` : ''}`}
                        variant="contained"
                        endIcon={<ArrowForwardRounded />}
                      >
                        {t(item.attemptCompleted ? 'Xem kết quả' : item.attemptId ? 'Tiếp tục' : 'Bắt đầu')}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {!loading && !error && data?.total > 0 && (tab || data.total > pageSize) && (
          <div className={`dictation-pagination ${tab ? 'is-history' : ''}`}>
            {Boolean(tab) && items.length > 0 && (
              <p className="dictation-page-range" role="status">
                {t('Đang hiển thị:')}{' '}
                <strong>
                  {page * pageSize + 1}–{Math.min(page * pageSize + items.length, data.total)}
                </strong>{' '}
                {t('trong tổng số')} <strong>{data.total}</strong> {t('bài nghe')}
              </p>
            )}
            {data.total > pageSize && (
              <Pagination
                aria-label={t('Phân trang bài nghe')}
                count={Math.ceil(data.total / pageSize)}
                page={page + 1}
                onChange={(_e, value) => setPage(value - 1)}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
