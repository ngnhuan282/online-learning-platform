import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Alert, Button } from '@mui/material';
import { PauseRounded, PlayArrowRounded, ReplayRounded } from '@mui/icons-material';
import { t } from '../../../shared/i18n/locale';
import YouTubeEmbed from './YouTubeEmbed';

const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;
const CUED = 5;
const SEEK_SETTLE_MS = 750;
const CLOCK_CHECK_MS = 30;

export default function YouTubeSegmentPlayer({ videoId, title, start, end, seekRequest, busy, onNext }) {
  const player = useRef(null);
  const cueStart = useRef(null);
  const pendingClip = useRef(null);
  const pendingSeek = useRef(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState(-1);
  const [finishedRequest, setFinishedRequest] = useState(null);
  const [issue, setIssue] = useState('');
  const playing = state === PLAYING || state === BUFFERING;
  const finished = state === ENDED || finishedRequest === seekRequest;
  const unavailable = busy || !ready;

  const seekClip = useCallback(clip => {
    const target = player.current;
    if (!target || cueStart.current !== null) {
      pendingClip.current = clip;
      return;
    }

    const from = target.getCurrentTime();
    pendingSeek.current = from >= clip.end ? { from, deadline: null } : null;
    if (!clip.play) target.pauseVideo();
    target.seekTo(clip.start, true);
    if (clip.play) target.playVideo();
  }, []);

  useEffect(() => {
    seekClip({ start, end, play: Boolean(seekRequest?.play) });
  }, [start, end, seekRequest, seekClip]);

  const checkEnd = useEffectEvent(() => {
    const target = player.current;
    if (target?.getPlayerState() !== PLAYING) return;
    const seconds = target.getCurrentTime();
    if (!Number.isFinite(seconds)) return;
    const seek = pendingSeek.current;
    if (seek) {
      const now = performance.now();
      seek.deadline ??= now + SEEK_SETTLE_MS;
      // The iframe can still report the previous clip's clock during a backward seek.
      if (seconds >= end && seconds >= seek.from - 0.05 && now < seek.deadline) return;
      pendingSeek.current = null;
    }
    if (seconds < end) return;
    target.pauseVideo();
    setFinishedRequest(seekRequest);
    setState(PAUSED);
  });

  useEffect(() => {
    if (state !== PLAYING) return;
    const timer = setInterval(() => checkEnd(), CLOCK_CHECK_MS);
    return () => clearInterval(timer);
  }, [state]);

  function replay() {
    setIssue('');
    setFinishedRequest(null);
    seekClip({ start, end, play: true });
  }

  function toggle() {
    const current = player.current;
    if (!current) return;
    const status = current.getPlayerState();
    if (status === PLAYING || status === BUFFERING) {
      current.pauseVideo();
      return;
    }
    const seconds = current.getCurrentTime();
    const waitingForPosition = pendingSeek.current && seconds >= end;
    const atEnd = !waitingForPosition && (finished || seconds >= end);
    if (atEnd && onNext) {
      onNext();
    } else if (atEnd || waitingForPosition || seconds < start) {
      replay();
    } else {
      setIssue('');
      current.playVideo();
    }
  }

  return (
    <div className="dictation-audio">
      <YouTubeEmbed
        videoId={videoId}
        title={title}
        onReady={target => {
          player.current = target;
          cueStart.current = pendingClip.current?.start ?? start;
          target.cueVideoById({ videoId, startSeconds: cueStart.current });
        }}
        onStateChange={value => {
          setState(value);
          if (value === PLAYING) setIssue('');
          if (value !== CUED || cueStart.current === null) return;
          const initialStart = cueStart.current;
          const clip = pendingClip.current;
          cueStart.current = null;
          pendingClip.current = null;
          setReady(true);
          if (clip && (clip.play || clip.start !== initialStart)) seekClip(clip);
        }}
        onError={() => setIssue('Không phát được video nhúng YouTube.')}
        onAutoplayBlocked={() => {
          setIssue('Bấm nút phát trên video YouTube để tiếp tục.');
        }}
        onDispose={target => {
          if (player.current !== target) return;
          player.current = null;
          pendingSeek.current = null;
          setReady(false);
        }}
      />
      <div className="dictation-player-row">
        <Button
          variant="contained"
          startIcon={playing ? <PauseRounded /> : <PlayArrowRounded />}
          disabled={unavailable || (finished && !onNext)}
          onClick={toggle}
        >
          {t(playing ? 'Tạm dừng' : 'Bắt đầu')}
        </Button>
        <Button
          variant="outlined"
          startIcon={<ReplayRounded />}
          aria-label={t('Nghe lại câu này')}
          disabled={unavailable}
          onClick={replay}
        >
          {t('Phát lại')}
        </Button>
      </div>
      {issue && <Alert severity="warning">{t(issue)}</Alert>}
    </div>
  );
}
