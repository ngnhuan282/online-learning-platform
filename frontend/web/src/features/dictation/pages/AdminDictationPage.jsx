import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useBlocker, useSearchParams } from 'react-router-dom';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Skeleton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  AddRounded,
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  CloseRounded,
  DeleteOutlineRounded,
  DownloadOutlined,
  EditOutlined,
  HeadphonesOutlined,
  MyLocationRounded,
  PauseRounded,
  PlayArrowRounded,
  PublishOutlined,
  RestartAlt,
  SaveOutlined,
  SearchOutlined,
  UploadFileOutlined,
  VisibilityOffOutlined,
  VisibilityOutlined,
} from '@mui/icons-material';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import ErrorState from '../../../shared/components/ErrorState';
import EmptyState from '../../../shared/components/EmptyState';
import { dictationApi, downloadWorkbook } from '../api/dictationApi';
import { useDictationAudio, useDictationQuery } from '../hooks/useDictationQuery';
import YouTubeEmbed from '../components/YouTubeEmbed';
import {
  definitionPayload,
  draftError,
  formatTime,
  LEVELS,
  parseTime,
  transcriptImportBase,
  youtubeVideoId,
} from '../utils/dictation';
import '../styles/dictation.css';

const blankSentence = () => ({ key: crypto.randomUUID(), text: '', start: null, end: null });
const blankDefinition = () => ({
  title: '',
  description: '',
  topic: '',
  level: 'B1',
  audioKey: '',
  video: null,
  sentences: [blankSentence()],
});
const inputTime = (value, duration) =>
  typeof value === 'string'
    ? value
    : formatTime(value != null && value === duration ? Math.ceil(value) : value);
const statusLabel = { DRAFT: 'Bản nháp', PUBLISHED: 'Đã xuất bản', ARCHIVED: 'Đã ẩn' };
const pageSizes = [10, 20, 50];
const timingFields = [
  {
    field: 'start',
    label: 'Bắt đầu',
    inputLabel: 'Bắt đầu câu',
    captureLabel: 'Lấy mốc bắt đầu câu',
    tooltip: 'Lấy vị trí phát hiện tại làm mốc bắt đầu',
  },
  {
    field: 'end',
    label: 'Kết thúc',
    inputLabel: 'Kết thúc câu',
    captureLabel: 'Lấy mốc kết thúc câu',
    tooltip: 'Lấy vị trí phát hiện tại làm mốc kết thúc',
  },
];

export default function AdminDictationPage() {
  useLocale();
  const [params, setParams] = useSearchParams();
  const keyword = params.get('q') || '';
  const status = Object.hasOwn(statusLabel, params.get('status')) ? params.get('status') : '';
  const page = Math.max(0, Math.min(100000, Math.trunc(Number(params.get('page'))) || 0));
  const size = pageSizes.includes(Number(params.get('size'))) ? Number(params.get('size')) : 10;
  const [searchDraft, setSearchDraft] = useState({ source: keyword, value: keyword });
  const query = searchDraft.source === keyword ? searchDraft.value : keyword;
  const list = useDictationQuery(dictationApi.adminPath, { keyword, status, page, size });
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankDefinition);
  const [audioInfo, setAudioInfo] = useState(null);
  const [videoSrc, setVideoSrc] = useState('');
  const [videoFailed, setVideoFailed] = useState(false);
  const [youtubeReadySrc, setYoutubeReadySrc] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [imported, setImported] = useState(null);
  const [importMode, setImportMode] = useState('append');
  const [playingRow, setPlayingRow] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [audioClock, setAudioClock] = useState({ source: '', time: null });
  const videoUrl = form.video?.url ?? '';
  const hasVideo = Boolean(videoUrl.trim());
  const youtubeId = youtubeVideoId(videoSrc);
  const youtubeReady = Boolean(youtubeId && youtubeReadySrc === videoSrc);
  const invalidVideo =
    hasVideo && !youtubeVideoId(videoUrl.trim()) && videoUrl.trim() !== selected?.definition.video?.url;
  const audio = useDictationAudio(hasVideo ? null : form.audioKey, true);
  const mediaSrc = hasVideo ? videoSrc : audio.src;
  const mediaDuration = hasVideo ? form.video.duration : audioInfo?.duration;
  const Preview = hasVideo ? 'video' : 'audio';
  const audioPosition = audioClock.source === mediaSrc ? audioClock.time : null;
  const player = useRef(null);
  const youtubePlayer = useRef(null);
  const editorContent = useRef(null);
  const previewEnd = useRef(null);
  const previewKey = useRef(null);
  const playRequest = useRef(0);
  const frame = useRef(null);
  const fileInput = useRef(null);
  const excelInput = useRef(null);
  const pending = useRef(false);
  const mounted = useRef(false);
  const blocker = useBlocker(open && dirty);
  const importBase = transcriptImportBase(form.sentences, importMode);
  const importCount = imported?.sentences?.length ?? 0;
  const importTotal = importBase.length + importCount;
  let importOverlaps = false;
  try {
    const previousEnd = parseTime(importBase.at(-1)?.end);
    const nextStart = imported?.sentences?.[0]?.start;
    importOverlaps = previousEnd !== null && nextStart != null && nextStart < previousEnd;
  } catch {
    /* Incomplete timing fields can be fixed after importing. */
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelAnimationFrame(frame.current);
    };
  }, []);
  useEffect(() => {
    if (!open || !dirty) return;
    const warn = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [open, dirty]);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(timeout);
  }, [message]);
  useEffect(() => {
    if (open || list.loading || list.error || !list.data) return;
    const lastPage = Math.max(0, Math.ceil(list.data.total / size) - 1);
    if (page <= lastPage) return;
    const next = new URLSearchParams(params);
    if (lastPage) next.set('page', String(lastPage));
    else next.delete('page');
    setParams(next, { replace: true });
  }, [open, list.loading, list.error, list.data, page, size, params, setParams]);

  const readYouTube = useEffectEvent(() => {
    const current = youtubePlayer.current;
    if (!current) return;
    const duration = current.getDuration();
    if (Number.isFinite(duration) && duration > 0 && duration !== mediaDuration) {
      change('video', { url: videoSrc, duration });
    }
    const time = current.getCurrentTime();
    if (Number.isFinite(time)) trackPosition(time);
  });
  useEffect(() => {
    if (!open || !youtubeReady) return;
    const interval = setInterval(() => readYouTube(), 250);
    return () => clearInterval(interval);
  }, [open, youtubeReady]);

  function filter(values) {
    const next = new URLSearchParams(params);
    Object.entries({ page: '', ...values }).forEach(([key, value]) =>
      value ? next.set(key, String(value)) : next.delete(key),
    );
    setParams(next);
    list.reload();
  }

  async function act(operation) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await operation();
    } catch (reason) {
      if (mounted.current) {
        setError(reason);
        editorContent.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function accept(detail) {
    stopPreview();
    const nextVideoSrc = detail.definition.video?.url ?? '';
    if (videoSrc !== nextVideoSrc) {
      youtubePlayer.current = null;
      setYoutubeReadySrc('');
    }
    setSelected(detail);
    setForm({
      ...detail.definition,
      description: detail.definition.description ?? '',
      sentences: detail.definition.sentences.map(row => ({ ...row, key: crypto.randomUUID() })),
    });
    setAudioInfo(detail.audio);
    setVideoSrc(nextVideoSrc);
    setVideoFailed(false);
    setDirty(false);
  }
  function change(field, value) {
    setForm(prior => ({ ...prior, [field]: value }));
    setDirty(true);
  }
  function sentence(index, field, value) {
    setForm(prior => ({
      ...prior,
      sentences: prior.sentences.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
    setDirty(true);
  }
  function trackPosition(time) {
    setAudioClock(previous =>
      previous.source === mediaSrc &&
      Math.floor(previous.time) === Math.floor(time) &&
      (previous.time === 0) === (time === 0)
        ? previous
        : { source: mediaSrc, time },
    );
  }
  function trackAudioPosition() {
    const element = player.current;
    if (element?.readyState >= 1) trackPosition(element.currentTime);
  }
  function captureTime(index, field) {
    const element = player.current;
    const time = youtubeReady
      ? youtubePlayer.current?.getCurrentTime()
      : element?.readyState >= 1
        ? element.currentTime
        : undefined;
    if (Number.isFinite(time)) sentence(index, field, Math.round(time * 1000) / 1000);
  }
  function stopPreview() {
    playRequest.current++;
    previewEnd.current = null;
    previewKey.current = null;
    cancelAnimationFrame(frame.current);
    player.current?.pause();
    youtubePlayer.current?.pauseVideo();
    setPlayingRow(null);
  }
  function trackPreviewPlayback() {
    setPlayingRow(previewKey.current);
    cancelAnimationFrame(frame.current);
    function tick() {
      const element = player.current;
      if (!element || element.paused || previewEnd.current === null) return;
      if (element.currentTime >= previewEnd.current) {
        element.currentTime = previewEnd.current;
        stopPreview();
      } else frame.current = requestAnimationFrame(tick);
    }
    frame.current = requestAnimationFrame(tick);
  }
  function closeEditor() {
    if (busy) return;
    if (dirty) {
      askConfirmation('discard');
      return;
    }
    stopPreview();
    setOpen(false);
  }
  function askConfirmation(type) {
    setConfirm({ type, archived: selected?.archived, open: true });
  }
  function closeConfirmation() {
    setConfirm(value => value && { ...value, open: false });
  }
  function edit(id) {
    act(async () => {
      const { data } = await dictationApi.detail(id);
      if (mounted.current) {
        accept(data);
        setOpen(true);
      }
    });
  }
  function create() {
    setSelected(null);
    setForm(blankDefinition());
    setAudioInfo(null);
    setVideoSrc('');
    setVideoFailed(false);
    setYoutubeReadySrc('');
    youtubePlayer.current = null;
    setDirty(false);
    setError(null);
    setMessage('');
    setOpen(true);
  }
  function validateEditor() {
    return invalidVideo ? 'Vui lòng nhập liên kết YouTube hợp lệ.' : draftError(form);
  }
  async function save() {
    const validation = validateEditor();
    if (validation) {
      setError(new Error(t(validation)));
      return;
    }
    await act(async () => {
      const { data } = await dictationApi.save(selected?.id, {
        definition: definitionPayload(form),
        version: selected?.version ?? 0,
      });
      if (mounted.current) {
        accept(data);
        list.reload();
        setMessage('Đã lưu bản nháp.');
      }
    });
  }
  async function publish() {
    if (pending.current) return;
    const validation =
      validateEditor() ??
      (hasVideo
        ? videoFailed
          ? youtubeId
            ? 'Không phát được video nhúng YouTube.'
            : 'Không phát được video. Kiểm tra liên kết cloud.'
          : !mediaDuration
            ? 'Chờ tải thời lượng video trước khi xuất bản.'
            : null
        : !form.audioKey
          ? 'Vui lòng nhập liên kết YouTube hợp lệ.'
          : null);
    if (validation) {
      setError(new Error(t(validation)));
      editorContent.current?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setPublishing(true);
    try {
      await act(async () => {
        stopPreview();
        await dictationApi.publish(
          selected?.id,
          selected?.version ?? 0,
          !selected || dirty ? definitionPayload(form) : undefined,
        );
        if (mounted.current) {
          setDirty(false);
          setOpen(false);
          list.reload();
          setMessage('Đã xuất bản bài nghe.');
        }
      });
    } finally {
      if (mounted.current) setPublishing(false);
    }
  }
  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= form.sentences.length) return;
    const rows = [...form.sentences];
    [rows[index], rows[target]] = [rows[target], rows[index]];
    change('sentences', rows);
  }
  async function preview(row) {
    const youtube = youtubeReady ? youtubePlayer.current : null;
    if (
      previewKey.current === row.key &&
      (youtube ? youtube.getPlayerState() === 1 : !player.current?.paused)
    ) {
      playRequest.current++;
      if (youtube) youtube.pauseVideo();
      else player.current?.pause();
      return;
    }
    let request;
    try {
      const start = parseTime(row.start),
        enteredEnd = parseTime(row.end),
        duration = Number.isFinite(player.current?.duration)
          ? player.current.duration
          : (mediaDuration ?? Infinity),
        end =
          enteredEnd === null
            ? null
            : enteredEnd >= (mediaDuration ?? duration)
              ? duration
              : Math.min(enteredEnd, duration);
      if ((!player.current && !youtube) || start === null || end === null || start >= end)
        throw new Error(t('Câu chưa có mốc thời gian hợp lệ.'));
      if (youtube) {
        stopPreview();
        previewKey.current = row.key;
        youtube.loadVideoById({ videoId: youtubeId, startSeconds: start, endSeconds: end });
        return;
      }
      const resume =
        previewKey.current === row.key &&
        player.current.currentTime >= start &&
        player.current.currentTime < end;
      stopPreview();
      request = playRequest.current;
      if (!resume) player.current.currentTime = start;
      previewKey.current = row.key;
      previewEnd.current = end >= duration ? null : end;
      await player.current.play();
    } catch (reason) {
      if (!mounted.current || (request !== undefined && request !== playRequest.current)) return;
      stopPreview();
      setError(reason);
    }
  }

  return (
    <div className="dictation-admin dictation-scope">
      <Dialog open={blocker.state === 'blocked'} onClose={() => blocker.reset?.()}>
        <DialogTitle>{t('Bỏ thay đổi chưa lưu?')}</DialogTitle>
        <DialogContent>{t('Các thay đổi chưa lưu sẽ bị bỏ.')}</DialogContent>
        <DialogActions>
          <Button onClick={() => blocker.reset?.()}>{t('Hủy')}</Button>
          <Button onClick={() => blocker.proceed?.()}>{t('Rời trang')}</Button>
        </DialogActions>
      </Dialog>
      <header className="dictation-heading">
        <div>
          <span className="dictation-eyebrow">{t('NỘI DUNG LUYỆN TẬP')}</span>
          <h1>{t('Quản lý bài nghe')}</h1>
        </div>
        <Button variant="contained" startIcon={<AddRounded />} onClick={create} disabled={busy}>
          {t('Thêm bài nghe')}
        </Button>
      </header>
      <section className="admin-card admin-filters dictation-admin-search">
        <form
          className="dictation-admin-filter-row"
          onSubmit={event => {
            event.preventDefault();
            filter({ q: query.trim() });
          }}
        >
          <TextField
            size="small"
            placeholder={t('Tìm bài nghe')}
            value={query}
            onChange={event => setSearchDraft({ source: keyword, value: event.target.value })}
            slotProps={{ htmlInput: { 'aria-label': t('Tìm bài nghe') } }}
          />
          <Button type="submit" variant="outlined" startIcon={<SearchOutlined />}>
            {t('Tìm kiếm')}
          </Button>
          <TextField
            select
            size="small"
            label={t('Trạng thái')}
            value={status}
            onChange={event => filter({ status: event.target.value })}
            slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
          >
            <MenuItem value="">{t('Tất cả trạng thái')}</MenuItem>
            {Object.entries(statusLabel).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {t(label)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            startIcon={<RestartAlt />}
            onClick={() => {
              setSearchDraft({ source: '', value: '' });
              filter({ q: '', status: '' });
            }}
          >
            {t('Đặt lại bộ lọc')}
          </Button>
        </form>
        <div className="admin-filter-summary dictation-admin-filter-summary" aria-live="polite">
          <span>
            {t('Đang lọc:')} <b>{keyword || t('Tất cả bài nghe')}</b>
            {status && <Chip size="small" variant="outlined" label={t(statusLabel[status])} />}
          </span>
          <span>
            {list.loading
              ? t('Đang tải...')
              : list.error
                ? ''
                : t('Tìm thấy {count} bài nghe', { count: list.data?.total ?? 0 })}
          </span>
        </div>
      </section>
      {error && !open && <ErrorState error={error} />}
      {message && !open && <Alert severity="success">{t(message)}</Alert>}
      {list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : list.loading ? (
        <Skeleton variant="rounded" height={240} />
      ) : !list.data?.items?.length ? (
        <EmptyState title="Chưa có bài nghe phù hợp" />
      ) : (
        <div className="admin-card admin-table-card dictation-admin-table">
          <div className="dictation-table-scroll">
            <table className="dictation-table">
              <thead>
                <tr>
                  <th>{t('Bài nghe')}</th>
                  <th>{t('Chủ đề')}</th>
                  <th>{t('Trình độ')}</th>
                  <th>{t('Số câu nghe')}</th>
                  <th>{t('Trạng thái')}</th>
                  <th>{t('Thao tác')}</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <small>{formatTime(item.duration)}</small>
                    </td>
                    <td>{item.topic}</td>
                    <td>{item.level}</td>
                    <td>{item.sentenceCount}</td>
                    <td>
                      <Chip
                        size="small"
                        color={
                          item.status === 'PUBLISHED'
                            ? 'success'
                            : item.status === 'DRAFT'
                              ? 'warning'
                              : 'default'
                        }
                        className={`dictation-status is-${item.status.toLowerCase()}`}
                        variant="outlined"
                        label={t(statusLabel[item.status])}
                      />
                      {item.hasDraft && item.status === 'PUBLISHED' && (
                        <small>{t('Có thay đổi chưa xuất bản')}</small>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="outlined"
                        startIcon={<EditOutlined />}
                        disabled={busy}
                        onClick={() => edit(item.id)}
                      >
                        {t('Chỉnh sửa')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-pagination dictation-admin-pagination">
            <span>
              {t('Đang hiển thị:')} {page * size + 1}-{page * size + list.data.items.length} /{' '}
              {list.data.total} {t('bài nghe')}
            </span>
            <TextField
              select
              size="small"
              label={t('Số dòng')}
              value={size}
              onChange={event => filter({ size: event.target.value })}
            >
              {pageSizes.map(value => (
                <MenuItem key={value} value={value}>
                  {value} {t('dòng / trang')}
                </MenuItem>
              ))}
            </TextField>
            <Pagination
              count={Math.max(1, Math.ceil(list.data.total / size))}
              page={page + 1}
              onChange={(_e, value) => filter({ page: value - 1 })}
              color="primary"
              shape="rounded"
              size="small"
              siblingCount={0}
            />
          </div>
        </div>
      )}
      <Dialog
        open={open}
        onClose={closeEditor}
        fullWidth
        maxWidth="lg"
        className="dictation-dialog"
        slotProps={{ paper: { className: 'dictation-editor dictation-scope' } }}
      >
        <DialogTitle component="div">
          <div>
            <h2>{t(selected ? 'Chỉnh sửa bài nghe' : 'Thêm bài nghe')}</h2>
            {dirty && <span role="status">{t('Có thay đổi chưa lưu')}</span>}
          </div>
          <Tooltip title={t('Đóng')}>
            <span>
              <IconButton aria-label={t('Đóng')} disabled={busy} onClick={closeEditor}>
                <CloseRounded />
              </IconButton>
            </span>
          </Tooltip>
        </DialogTitle>
        <DialogContent dividers ref={editorContent}>
          {error && <ErrorState error={error} />}
          {message && <Alert severity="success">{t(message)}</Alert>}
          <div className="dictation-editor-metadata">
            <TextField
              label={t('Tên bài nghe')}
              required
              value={form.title}
              onChange={event => change('title', event.target.value)}
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 180 } }}
            />
            <TextField
              label={t('Chủ đề')}
              placeholder="Test 1"
              required
              value={form.topic}
              onChange={event => change('topic', event.target.value)}
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 60 } }}
            />
            <TextField
              label={t('Trình độ')}
              select
              value={form.level}
              onChange={event => change('level', event.target.value)}
              disabled={busy}
            >
              {LEVELS.map(level => (
                <MenuItem key={level} value={level}>
                  {level}
                </MenuItem>
              ))}
            </TextField>
          </div>
          <section className="dictation-editor-audio">
            <div className="dictation-section-heading">
              <h3>
                {hasVideo || !form.audioKey ? <PlayArrowRounded /> : <HeadphonesOutlined />}
                {hasVideo || !form.audioKey ? 'Video' : 'Audio'}
              </h3>
              {form.audioKey && !hasVideo && (
                <Button
                  variant="outlined"
                  startIcon={<UploadFileOutlined />}
                  disabled={busy}
                  onClick={() => fileInput.current.click()}
                >
                  {t('Đổi audio')}
                </Button>
              )}
            </div>
            <TextField
              className="dictation-youtube-url-field"
              fullWidth
              type="url"
              label={t('Liên kết YouTube')}
              value={videoUrl}
              helperText={t(
                invalidVideo
                  ? 'Vui lòng nhập liên kết YouTube hợp lệ.'
                  : 'Dán link YouTube gốc. Bấm phát video nếu thời lượng chưa hiện.',
              )}
              error={invalidVideo}
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 2048 } }}
              onChange={event => {
                stopPreview();
                const url = event.target.value;
                change('video', url ? { url, duration: null } : null);
                setVideoSrc('');
                setVideoFailed(false);
                setYoutubeReadySrc('');
                youtubePlayer.current = null;
              }}
              onBlur={() => {
                if (hasVideo && !invalidVideo) setVideoSrc(videoUrl.trim());
              }}
            />
            <input
              ref={fileInput}
              hidden
              type="file"
              accept=".mp3,audio/mpeg"
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                act(async () => {
                  const { data } = await dictationApi.upload(file);
                  if (mounted.current) {
                    stopPreview();
                    change('audioKey', data.key);
                    setAudioInfo(data);
                  }
                });
              }}
            />
            {audioInfo && !hasVideo && (
              <p className="dictation-audio-name">
                {audioInfo.name} · {formatTime(audioInfo.duration)}
              </p>
            )}
            {hasVideo && mediaDuration > 0 && (
              <p className="dictation-audio-name" role="status">
                {t('Thời lượng video: {duration}', { duration: formatTime(mediaDuration) })}
              </p>
            )}
            {videoFailed && (
              <Alert
                severity="error"
                action={
                  !youtubeId && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => {
                        setVideoFailed(false);
                        player.current?.load();
                      }}
                    >
                      {t('Thử lại')}
                    </Button>
                  )
                }
              >
                {t(
                  youtubeId
                    ? 'Không phát được video nhúng YouTube.'
                    : 'Không phát được video. Kiểm tra liên kết cloud.',
                )}
              </Alert>
            )}
            {youtubeId ? (
              <YouTubeEmbed
                key={videoSrc}
                title="YouTube"
                videoId={youtubeId}
                onReady={target => {
                  youtubePlayer.current = target;
                  setYoutubeReadySrc(videoSrc);
                }}
                onDispose={target => {
                  if (youtubePlayer.current === target) youtubePlayer.current = null;
                }}
                onStateChange={state => {
                  setPlayingRow(state === 1 ? previewKey.current : null);
                  if (state === 1) setVideoFailed(false);
                }}
                onError={() => setVideoFailed(true)}
              />
            ) : !hasVideo && audio.error ? (
              <ErrorState error={audio.error} onRetry={audio.reload} />
            ) : (
              mediaSrc && (
                <Preview
                  key={mediaSrc}
                  ref={player}
                  controls
                  src={mediaSrc}
                  preload="metadata"
                  playsInline={hasVideo || undefined}
                  onLoadedMetadata={event => {
                    trackAudioPosition();
                    const duration = event.currentTarget.duration;
                    if (hasVideo && Number.isFinite(duration) && duration > 0 && duration !== mediaDuration) {
                      change('video', { url: videoSrc, duration });
                    }
                  }}
                  onTimeUpdate={trackAudioPosition}
                  onPlay={trackPreviewPlayback}
                  onPause={() => {
                    cancelAnimationFrame(frame.current);
                    setPlayingRow(null);
                  }}
                  onEnded={stopPreview}
                  onError={() => {
                    stopPreview();
                    if (hasVideo) setVideoFailed(true);
                  }}
                  onSeeked={() => {
                    trackAudioPosition();
                    if (previewEnd.current && player.current.currentTime > previewEnd.current) stopPreview();
                  }}
                />
              )
            )}
          </section>
          <section className="dictation-editor-transcript">
            <div className="dictation-section-heading">
              <h3>
                {t('Transcript')}
                <span>{t('{count} câu', { count: form.sentences.length })}</span>
              </h3>
              <div className="dictation-toolbar">
                <Button
                  variant="outlined"
                  startIcon={<DownloadOutlined />}
                  disabled={busy}
                  onClick={() => act(async () => downloadWorkbook(await dictationApi.template()))}
                >
                  {t('Tải Excel mẫu')}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<UploadFileOutlined />}
                  disabled={busy}
                  onClick={() => excelInput.current.click()}
                >
                  {t('Nhập từ Excel')}
                </Button>
              </div>
            </div>
            <input
              ref={excelInput}
              hidden
              type="file"
              accept=".xlsx"
              onChange={event => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                act(async () => {
                  const { data } = await dictationApi.import(file);
                  if (mounted.current) {
                    stopPreview();
                    setImportMode('append');
                    setImported({ ...data, open: true });
                  }
                });
              }}
            />
            <div className="dictation-editor-rows">
              {form.sentences.map((row, index) => (
                <div className="dictation-editor-row" key={row.key}>
                  <span className="dictation-row-number">{index + 1}</span>
                  <TextField
                    className="dictation-sentence-input"
                    multiline
                    minRows={2}
                    label={t('Câu {index}', { index: index + 1 })}
                    value={row.text}
                    disabled={busy}
                    onChange={event => sentence(index, 'text', event.target.value)}
                    slotProps={{ htmlInput: { maxLength: 1500 } }}
                  />
                  <div className="dictation-timing">
                    {timingFields.map(({ field, label, inputLabel, captureLabel, tooltip }) => (
                      <TextField
                        key={field}
                        size="small"
                        label={t(label)}
                        placeholder="00:00"
                        value={inputTime(row[field], field === 'end' ? mediaDuration : undefined)}
                        disabled={busy}
                        onChange={event => sentence(index, field, event.target.value)}
                        slotProps={{
                          htmlInput: { 'aria-label': `${t(inputLabel)} ${index + 1}` },
                          input: {
                            endAdornment: (
                              <InputAdornment position="end">
                                <Tooltip
                                  title={`${t(tooltip)}${audioPosition === null ? '' : ` · ${formatTime(audioPosition)}`}`}
                                >
                                  <span>
                                    <IconButton
                                      size="small"
                                      edge="end"
                                      aria-label={`${t(captureLabel)} ${index + 1}`}
                                      disabled={
                                        busy ||
                                        audioPosition === null ||
                                        (field === 'end' && audioPosition === 0)
                                      }
                                      onClick={() => captureTime(index, field)}
                                    >
                                      <MyLocationRounded fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    ))}
                  </div>
                  <div className="dictation-row-actions">
                    <Tooltip title={t(playingRow === row.key ? 'Tạm dừng' : 'Nghe thử đoạn này')}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`${t(playingRow === row.key ? 'Tạm dừng câu' : 'Nghe thử câu')} ${index + 1}`}
                          color={playingRow === row.key ? 'primary' : 'default'}
                          disabled={busy || !mediaSrc || Boolean(youtubeId && !youtubeReady)}
                          onClick={() => preview(row)}
                        >
                          {playingRow === row.key ? <PauseRounded /> : <PlayArrowRounded />}
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('Chuyển câu lên')}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={t('Chuyển câu lên')}
                          disabled={busy || !index}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUpwardRounded fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('Chuyển câu xuống')}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={t('Chuyển câu xuống')}
                          disabled={busy || index === form.sentences.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDownwardRounded fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title={t('Xóa câu')}>
                      <span>
                        <IconButton
                          size="small"
                          aria-label={`${t('Xóa câu')} ${index + 1}`}
                          disabled={busy || form.sentences.length === 1}
                          onClick={() => {
                            if (previewKey.current === row.key) stopPreview();
                            change(
                              'sentences',
                              form.sentences.filter((_value, i) => i !== index),
                            );
                          }}
                        >
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
            <Button
              startIcon={<AddRounded />}
              disabled={busy || form.sentences.length >= 200}
              onClick={() => change('sentences', [...form.sentences, blankSentence()])}
            >
              {t('Thêm câu')}
            </Button>
          </section>
        </DialogContent>
        <DialogActions>
          <div className="dictation-editor-status">
            {selected?.published && (
              <Button
                startIcon={selected.archived ? <VisibilityOutlined /> : <VisibilityOffOutlined />}
                disabled={busy || dirty}
                onClick={() => askConfirmation('visibility')}
              >
                {t(selected.archived ? 'Hiện bài nghe' : 'Ẩn bài nghe')}
              </Button>
            )}
          </div>
          <Button startIcon={<SaveOutlined />} disabled={busy || Boolean(selected && !dirty)} onClick={save}>
            {t('Lưu bản nháp')}
          </Button>
          <Button
            variant="contained"
            startIcon={<PublishOutlined />}
            loading={publishing}
            disabled={
              busy || Boolean(selected?.published && !selected.archived && !selected.hasDraft && !dirty)
            }
            onClick={() => (selected?.published ? askConfirmation('publish') : publish())}
          >
            {t('Xuất bản')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={Boolean(imported?.open)}
        onClose={() => setImported(value => value && { ...value, open: false })}
        fullWidth
        maxWidth="md"
        className="dictation-dialog"
        slotProps={{
          paper: { className: 'dictation-import dictation-scope' },
          transition: {
            onExited: () => {
              if (imported?.pendingRows) change('sentences', imported.pendingRows);
              setImported(null);
            },
          },
        }}
      >
        <DialogTitle>{t('Xem trước transcript nhập từ Excel')}</DialogTitle>
        <DialogContent dividers>
          <div className="dictation-import-options">
            <ToggleButtonGroup
              exclusive
              size="small"
              value={importMode}
              onChange={(_event, value) => value && setImportMode(value)}
              aria-label={t('Cách nhập transcript')}
            >
              <ToggleButton value="append">{t('Nối xuống dưới')}</ToggleButton>
              <ToggleButton value="replace">{t('Thay thế toàn bộ')}</ToggleButton>
            </ToggleButtonGroup>
            <span>{t('{count} câu sau khi nhập', { count: importTotal })} / 200</span>
          </div>
          {imported?.errors?.length ? (
            <Alert severity="error">
              <ul>
                {imported.errors.map((issue, index) => (
                  <li key={index}>
                    {t('Dòng')} {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
            </Alert>
          ) : (
            <Alert severity={importMode === 'replace' ? 'warning' : 'info'}>
              {t(
                importMode === 'replace'
                  ? 'Thay thế {count} câu hiện tại bằng transcript từ Excel.'
                  : 'Giữ nguyên {count} câu hiện tại và nối các câu mới xuống dưới.',
                { count: importMode === 'replace' ? form.sentences.length : importBase.length },
              )}{' '}
              {t('Tên bài, chủ đề, trình độ và video lấy từ form.')}{' '}
              {t('Mốc thời gian được giữ nguyên. Thay đổi chưa được lưu.')}
            </Alert>
          )}
          {importTotal > 200 && (
            <Alert severity="error">
              {t('Bài nghe chỉ được có tối đa 200 câu. Chọn thay thế hoặc giảm số câu nhập.')}
            </Alert>
          )}
          {importOverlaps && !imported?.errors?.length && (
            <Alert severity="warning">
              {t('Mốc thời gian từ Excel chồng lên câu trước. Hãy chỉnh lại trước khi xuất bản.')}
            </Alert>
          )}
          <div className="dictation-table-scroll dictation-import-table">
            <table className="dictation-table" aria-label={t('Transcript từ Excel')}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('Transcript')}</th>
                  <th>{t('Bắt đầu')}</th>
                  <th>{t('Kết thúc')}</th>
                </tr>
              </thead>
              <tbody>
                {imported?.sentences?.map((row, index) => (
                  <tr key={index}>
                    <td>{importBase.length + index + 1}</td>
                    <td>{row.text}</td>
                    <td>{formatTime(row.start) || '-'}</td>
                    <td>{formatTime(row.end) || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImported(value => value && { ...value, open: false })}>{t('Hủy')}</Button>
          <Button
            variant="contained"
            disabled={!importCount || Boolean(imported?.errors?.length) || importTotal > 200}
            onClick={() => {
              if (!imported?.open) return;
              stopPreview();
              const pendingRows = [
                ...importBase,
                ...imported.sentences.map(row => ({ ...row, key: crypto.randomUUID() })),
              ];
              setImported(value => ({ ...value, open: false, pendingRows }));
            }}
          >
            {importMode === 'append'
              ? t('Thêm {count} câu', { count: importCount })
              : t('Thay thế transcript')}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(confirm?.open)} onClose={closeConfirmation}>
        <DialogTitle>
          {t(
            confirm?.type === 'discard'
              ? 'Bỏ thay đổi chưa lưu?'
              : confirm?.type === 'publish'
                ? 'Xuất bản cập nhật?'
                : confirm?.archived
                  ? 'Hiện lại bài nghe?'
                  : 'Ẩn bài nghe?',
          )}
        </DialogTitle>
        <DialogContent>
          {t(
            confirm?.type === 'publish'
              ? 'Lượt luyện mới sẽ dùng phiên bản này. Lịch sử và điểm của lượt cũ được giữ nguyên.'
              : confirm?.type === 'visibility'
                ? 'Lịch sử luyện tập vẫn được giữ nguyên.'
                : 'Các thay đổi chưa lưu sẽ bị bỏ.',
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmation}>{t('Hủy')}</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!confirm?.open || pending.current) return;
              const operation = confirm.type;
              closeConfirmation();
              if (operation === 'discard') {
                stopPreview();
                setDirty(false);
                setOpen(false);
                return;
              }
              if (operation === 'publish') {
                publish();
                return;
              }
              act(async () => {
                const { data } = await dictationApi.visibility(selected.id, !selected.archived);
                if (mounted.current) {
                  accept(data);
                  list.reload();
                  setMessage('Đã cập nhật hiển thị.');
                }
              });
            }}
          >
            {t('Xác nhận')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
