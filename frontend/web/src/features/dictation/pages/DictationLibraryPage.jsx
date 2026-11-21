import { useContext, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  ArrowBackRounded,
  ArrowForwardRounded,
  FilterListRounded,
  HeadphonesOutlined,
  LockOutlined,
  ListAltOutlined,
  AssignmentTurnedInOutlined,
  CheckCircleOutlineRounded,
  PlayCircleOutlineRounded,
  RocketLaunchOutlined,
  SearchOutlined,
  SpaOutlined,
} from '@mui/icons-material';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { ROUTES } from '../../../shared/constants/routes';
import { AuthContext } from '../../auth/context/AuthContext';
import ErrorState from '../../../shared/components/ErrorState';
import EmptyState from '../../../shared/components/EmptyState';
import { dictationApi } from '../api/dictationApi';
import { useDictationQuery } from '../hooks/useDictationQuery';
import { formatTopicName, LEVELS, isToeicTopic, scoreFeedback } from '../utils/dictation';
import DictationLessonGrid from '../components/DictationLessonGrid';
import DictationScore from '../components/DictationScore';
import '../styles/dictation.css';

const tiers = ['BEGINNER', 'ADVANCED'];

function catalogLink(topic, tier) {
  const params = new URLSearchParams();
  if (topic !== null) params.set('topic', topic);
  if (tier) params.set('tier', tier.toLowerCase());
  return params.size ? `/dictation?${params}` : '/dictation';
}

export default function DictationLibraryPage() {
  const [params, setParams] = useSearchParams();
  const legacyTest = params.get('test');
  const groupTopic =
    params.get('topic')?.trim() || (/^[1-9][0-9]?$/.test(legacyTest) ? `Test ${legacyTest}` : null);
  const requestedTier = params.get('tier')?.toUpperCase();
  const tier = tiers.includes(requestedTier) ? requestedTier : '';
  const initialTab = !groupTopic && params.get('tab') === 'history' ? 1 : 0;

  function changeTier(value) {
    const next = new URLSearchParams(params);
    if (value) next.set('tier', value.toLowerCase());
    else next.delete('tier');
    setParams(next, { replace: true, preventScrollReset: true });
  }

  return (
    <DictationLibrary
      key={groupTopic ?? ''}
      groupTopic={groupTopic}
      tier={tier}
      onTierChange={changeTier}
      initialTab={initialTab}
    />
  );
}

function DictationLibrary({ groupTopic, tier, onTierChange, initialTab }) {
  useLocale();
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  const isAuthLoading = Boolean(auth?.isLoading);
  const scope = user?.id ? String(user.id) : 'guest';
  const [tab, setTab] = useState(initialTab);
  const [keyword, setKeyword] = useState('');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('');
  const [topic, setTopic] = useState('');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const pageSize = tab ? 20 : 12;
  const grouped = !tab && groupTopic === null;
  const selectedGroup = !tab && groupTopic !== null;
  const guestHistoryPrompt = tab === 1 && !isAuthLoading && !user;
  const overview = useDictationQuery(
    grouped ? dictationApi.topicGroupsPath : null,
    {
      keyword: '',
      level: '',
      status: '',
    },
    { enabled: !isAuthLoading, scope },
  );
  const results = useDictationQuery(
    tab
      ? user
        ? dictationApi.historyPath
        : null
      : selectedGroup
        ? dictationApi.catalogPath
        : tier
          ? dictationApi.topicGroupsPath
          : null,
    {
      keyword: query,
      level: grouped ? tier : level,
      ...(tab ? { topic } : {}),
      status: status === 'ALL' ? '' : status,
      ...(!grouped ? { page, size: pageSize } : {}),
      ...(selectedGroup ? { topic: groupTopic } : {}),
    },
    { enabled: !isAuthLoading && (!tab || Boolean(user)), scope },
  );
  const { data, loading, error, reload } = grouped && (!tier || !overview.data) ? overview : results;
  const topicGroups = overview.data?.groups ?? [];
  const items = data?.items ?? [];
  const groups = data?.groups ?? [];
  const filtered = Boolean(keyword || query || level || topic || status !== 'ALL' || (grouped && tier));
  function resetFilters() {
    setKeyword('');
    setQuery('');
    setLevel('');
    setTopic('');
    setStatus('ALL');
    setPage(0);
  }
  function clearFilters() {
    resetFilters();
    if (grouped && tier) onTierChange('');
  }
  return (
    <section className="dictation-page">
      <div className="container dictation-shell">
        {selectedGroup && (
          <Link className="dictation-library-back" to={catalogLink(null, tier)}>
            <ArrowBackRounded fontSize="small" /> {t('Thư viện bài nghe')}
          </Link>
        )}
        <header className={`dictation-heading${selectedGroup ? ' is-test' : ''}`}>
          <div>
            <span className="dictation-eyebrow">
              {!tab && selectedGroup && isToeicTopic(groupTopic) ? 'TOEIC LISTENING' : t('GÓC LUYỆN TẬP')}
            </span>
            <h1>{selectedGroup ? formatTopicName(groupTopic) : t('Luyện nghe chép chính tả')}</h1>
          </div>
          {selectedGroup ? (
            data && (
              <span className="dictation-group-count" role="status">
                {data.total} {t('bài nghe')}
              </span>
            )
          ) : (
            <span className="dictation-heading-icon">
              <HeadphonesOutlined />
            </span>
          )}
        </header>
        {!selectedGroup && (
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
        )}
        {grouped && (
          <div className="dictation-catalog-pills">
            <ToggleButtonGroup
              className="dictation-tier-pills"
              value={tier}
              exclusive
              size="small"
              aria-label={t('Nhóm trình độ')}
              onChange={(_event, value) => {
                if (value !== null) onTierChange(value);
              }}
            >
              <ToggleButton value="">{t('Tất cả')}</ToggleButton>
              <ToggleButton value="BEGINNER" title="A1–A2">
                <SpaOutlined fontSize="small" /> {t('Người mới')}
              </ToggleButton>
              <ToggleButton value="ADVANCED" title="B1–C2">
                <RocketLaunchOutlined fontSize="small" /> {t('Nâng cao')}
              </ToggleButton>
            </ToggleButtonGroup>
            {topicGroups.length > 0 && (
              <nav className="dictation-topic-pills" aria-label={t('Đi đến chủ đề')}>
                {topicGroups.map(group => (
                  <Link key={group.topic} to={catalogLink(group.topic, tier)}>
                    {formatTopicName(group.topic)}
                  </Link>
                ))}
              </nav>
            )}
          </div>
        )}
        {!grouped && !guestHistoryPrompt && (
          <form
            className={`dictation-filters ${tab ? 'is-history' : 'is-catalog'}`}
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
                <Button size="small" onClick={clearFilters}>
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
            {tab ? (
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
            ) : user ? (
              <TextField
                select
                size="small"
                slotProps={{
                  select: { displayEmpty: true, inputProps: { 'aria-label': t('Trạng thái bài nghe') } },
                }}
                value={status}
                onChange={event => {
                  setStatus(event.target.value);
                  setPage(0);
                }}
              >
                <MenuItem value="ALL">{t('Tất cả trạng thái')}</MenuItem>
                <MenuItem value="NOT_STARTED">{t('Chưa luyện')}</MenuItem>
                <MenuItem value="IN_PROGRESS">{t('Đang luyện')}</MenuItem>
                <MenuItem value="COMPLETED">{t('Đã hoàn thành')}</MenuItem>
              </TextField>
            ) : null}
            <Button type="submit" variant={tab ? 'contained' : 'outlined'} startIcon={<SearchOutlined />}>
              {t('Tìm kiếm')}
            </Button>
          </form>
        )}
        {guestHistoryPrompt ? (
          <EmptyState
            title="Đăng nhập để xem tiến độ bài học"
            action={
              <Button
                component={Link}
                to={ROUTES.LOGIN}
                state={{ from: `${ROUTES.DICTATION}?tab=history` }}
                variant="contained"
              >
                {t('Đăng nhập')}
              </Button>
            }
          />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : loading ? (
          <div className={tab ? 'dictation-history' : 'dictation-library-grid'}>
            {(tab ? [1, 2, 3] : [1, 2, 3, 4]).map(value => (
              <Skeleton key={value} variant="rounded" height={tab ? 108 : 250} />
            ))}
          </div>
        ) : !(grouped ? groups.length : items.length) ? (
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
            action={
              filtered && <Button onClick={clearFilters}>{t(grouped ? 'Xem tất cả' : 'Xóa bộ lọc')}</Button>
            }
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
        ) : grouped ? (
          <div className="dictation-topic-groups">
            {groups.map((group, index) => (
              <section key={group.topic} aria-labelledby={`dictation-topic-${index}`}>
                <div className="dictation-topic-heading">
                  <div>
                    <h2 id={`dictation-topic-${index}`}>{formatTopicName(group.topic)}</h2>
                    <span className="dictation-group-count">
                      {group.total} {t('bài nghe')}
                    </span>
                  </div>
                  <Button
                    component={Link}
                    to={catalogLink(group.topic, tier)}
                    variant="outlined"
                    endIcon={<ArrowForwardRounded />}
                    aria-label={t('Xem tất cả bài nghe của {name}', { name: formatTopicName(group.topic) })}
                  >
                    {t('Xem tất cả')}
                  </Button>
                </div>
                <DictationLessonGrid items={group.items} heading="h3" />
              </section>
            ))}
          </div>
        ) : (
          <DictationLessonGrid items={items} />
        )}
        {!guestHistoryPrompt && !loading && !error && data?.total > 0 && (tab || data.total > pageSize) && (
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
