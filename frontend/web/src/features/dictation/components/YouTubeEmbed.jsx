import { useEffect, useEffectEvent, useRef } from 'react';

let apiRequest;

function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiRequest ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    const previous = window.onYouTubeIframeAPIReady;

    function fail() {
      clearTimeout(timer);
      window.onYouTubeIframeAPIReady = previous;
      script.remove();
      apiRequest = undefined;
      reject(new Error('YouTube IFrame API unavailable'));
    }

    const timer = setTimeout(fail, 15000);
    script.addEventListener('error', fail, { once: true });
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      window.onYouTubeIframeAPIReady = previous;
      resolve(window.YT);
      previous?.();
    };
    document.head.append(script);
  });
  return apiRequest;
}

export default function YouTubeEmbed({
  videoId,
  title,
  onReady,
  onStateChange,
  onError,
  onAutoplayBlocked,
  onDispose,
}) {
  const host = useRef(null);
  const reportReady = useEffectEvent(player => onReady?.(player));
  const reportState = useEffectEvent(state => onStateChange?.(state));
  const reportError = useEffectEvent(code => onError?.(code));
  const reportBlocked = useEffectEvent(() => onAutoplayBlocked?.());
  const reportDispose = useEffectEvent(target => onDispose?.(target));

  useEffect(() => {
    const mount = host.current;
    const iframe = document.createElement('iframe');
    const params = new URLSearchParams({
      enablejsapi: '1',
      origin: window.location.origin,
      playsinline: '1',
    });
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
    iframe.title = title;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.allowFullscreen = true;
    mount.append(iframe);

    let active = true;
    let player;
    const readyTimeout = setTimeout(() => {
      if (active) reportError();
    }, 20000);
    loadApi()
      .then(YT => {
        if (!active) return;
        player = new YT.Player(iframe, {
          events: {
            onReady: event => {
              clearTimeout(readyTimeout);
              if (active) reportReady(event.target);
            },
            onStateChange: event => active && reportState(event.data),
            onError: event => active && reportError(event.data),
            onAutoplayBlocked: () => active && reportBlocked(),
          },
        });
      })
      .catch(() => {
        clearTimeout(readyTimeout);
        if (active) reportError();
      });

    return () => {
      active = false;
      clearTimeout(readyTimeout);
      if (player) {
        reportDispose(player);
        player.destroy();
      }
      iframe.remove();
    };
  }, [videoId, title]);

  return <div className="dictation-youtube" ref={host} />;
}
