import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Slider, Tooltip } from '@mui/material';
import { PauseRounded, PlayArrowRounded, ReplayRounded, VolumeUpOutlined } from '@mui/icons-material';
import { t } from '../../../shared/i18n/locale';
import { formatTime } from '../utils/dictation';

export default function SegmentAudio({ src, start, end, duration, disabled, busy, seekRequest, onNext }) {
  const audio = useRef(null);
  const stopAt = useRef(end);
  const playback = useRef({ id: 0, wanted: false, pending: null });
  const seek = useRef({ target: start, metadata: false });
  const scrubbing = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(start);
  const [failed, setFailed] = useState(false);
  const [volume, setVolume] = useState(1);
  const [sentenceEnded, setSentenceEnded] = useState(false);
  const unavailable = disabled || busy || !src;
  const pausePlayback = useCallback(() => {
    playback.current = { id: playback.current.id + 1, wanted: false, pending: null };
    audio.current?.pause();
  }, []);
  const resumePlayback = useCallback(async () => {
    const player = audio.current;
    const request = playback.current;
    if (!request.wanted || request.pending !== null || !player?.readyState || player.seeking) return;
    request.pending = request.id;
    try {
      await player.play();
    } catch (error) {
      if (request === playback.current && error.name !== 'AbortError') {
        request.wanted = false;
        setFailed(true);
      }
    } finally {
      if (request === playback.current) {
        request.pending = null;
        setPlaying(!player.paused && !player.ended);
      }
    }
  }, []);
  const startPlayback = useCallback(() => {
    playback.current.wanted = true;
    setFailed(false);
    resumePlayback();
  }, [resumePlayback]);
  const seekTo = useCallback(target => {
    const player = audio.current;
    seek.current = { target, metadata: player.readyState === 0 };
    if (!seek.current.metadata) player.currentTime = target;
  }, []);
  useEffect(() => {
    let active = true;
    pausePlayback();
    scrubbing.current = false;
    stopAt.current = end;
    seekTo(start);
    Promise.resolve().then(() => {
      if (!active) return;
      setPosition(start);
      setSentenceEnded(false);
      setFailed(false);
      if (seekRequest?.play && src && !disabled) startPlayback();
    });
    return () => {
      active = false;
      pausePlayback();
    };
  }, [start, end, src, seekRequest, disabled, startPlayback, pausePlayback, seekTo]);
  const updatePosition = useCallback(() => {
    const player = audio.current;
    if (!player || scrubbing.current || player.seeking) return;
    const boundary =
      stopAt.current !== null && stopAt.current >= duration && Number.isFinite(player.duration)
        ? player.duration
        : stopAt.current;
    if (boundary !== null && player.currentTime >= boundary) {
      // Let the media element finish naturally at EOF; seeking there can reset its ended state.
      if (!Number.isFinite(player.duration) || boundary < player.duration) {
        pausePlayback();
        if (player.currentTime > boundary) player.currentTime = boundary;
      }
      setSentenceEnded(true);
    }
    setPosition(player.currentTime);
  }, [duration, pausePlayback]);
  useEffect(() => {
    if (!playing) return;
    let frame;
    function tick() {
      const player = audio.current;
      if (!player) return;
      updatePosition();
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, updatePosition]);

  function play(restart = false) {
    const player = audio.current;
    if (!restart && (playback.current.wanted || !player.paused)) {
      pausePlayback();
      return;
    }
    const boundary = end >= duration && Number.isFinite(player.duration) ? player.duration : end;
    if (!restart && stopAt.current !== null && player.currentTime >= boundary) {
      onNext?.();
      return;
    }
    if (restart) {
      stopAt.current = end;
      setSentenceEnded(false);
    }
    if (restart || (stopAt.current !== null && player.currentTime < start)) {
      seekTo(start);
      setPosition(start);
    } else if (stopAt.current === null && player.currentTime >= duration - 0.04) {
      seekTo(0);
      setPosition(0);
    }
    startPlayback();
  }
  return (
    <div className="dictation-audio">
      <audio
        ref={audio}
        src={src || undefined}
        preload="auto"
        onPlay={() => setPlaying(!audio.current.paused)}
        onPause={() => setPlaying(!audio.current.paused)}
        onEnded={() => {
          if (audio.current.seeking || !audio.current.ended) return;
          pausePlayback();
          setPlaying(false);
          updatePosition();
          if (stopAt.current !== null) setSentenceEnded(true);
        }}
        onTimeUpdate={updatePosition}
        onSeeked={() => {
          if (audio.current.seeking) return;
          updatePosition();
          resumePlayback();
        }}
        onLoadedMetadata={() => {
          // Only apply a deferred seek once; later metadata events must not restart playback.
          if (seek.current.metadata) seekTo(seek.current.target);
          resumePlayback();
        }}
        onCanPlay={resumePlayback}
        onError={() => setFailed(true)}
      />
      <div className="dictation-audio-clock">
        <span>{formatTime(position)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      <Slider
        className="dictation-timeline"
        aria-label={t('Vị trí trong toàn bài')}
        min={0}
        max={duration}
        step={0.01}
        value={Math.min(duration, Math.max(0, position))}
        disabled={unavailable}
        onChange={(_event, value) => {
          scrubbing.current = true;
          stopAt.current = null;
          setSentenceEnded(false);
          seekTo(value);
          setPosition(value);
        }}
        onChangeCommitted={(_event, value) => {
          scrubbing.current = false;
          seekTo(value);
          setPosition(value);
        }}
      />
      <div className="dictation-audio-range" aria-hidden="true">
        <span
          style={{ left: `${(start / duration) * 100}%`, width: `${((end - start) / duration) * 100}%` }}
        />
      </div>
      <div className="dictation-player-row">
        <Button
          variant="contained"
          startIcon={playing ? <PauseRounded /> : <PlayArrowRounded />}
          disabled={unavailable || (sentenceEnded && !onNext)}
          onClick={() => play()}
        >
          {t(playing ? 'Tạm dừng' : 'Bắt đầu')}
        </Button>
        <Tooltip title={t('Nghe lại câu này')}>
          <span>
            <Button
              variant="outlined"
              startIcon={<ReplayRounded />}
              aria-label={t('Nghe lại câu này')}
              disabled={unavailable}
              onClick={() => play(true)}
            >
              {t('Phát lại')}
            </Button>
          </span>
        </Tooltip>
      </div>
      <div className="dictation-volume">
        <VolumeUpOutlined fontSize="small" />
        <Slider
          aria-label={t('Âm lượng')}
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={unavailable}
          onChange={(_event, value) => {
            audio.current.volume = value;
            setVolume(value);
          }}
        />
      </div>
      <div className="dictation-segment-range">
        <span>{t('Đoạn đang chọn')}</span>
        <strong>
          {formatTime(start)} - {formatTime(end)}
        </strong>
      </div>
      {failed && <Alert severity="error">{t('Không phát được audio. Vui lòng tải lại audio.')}</Alert>}
    </div>
  );
}
