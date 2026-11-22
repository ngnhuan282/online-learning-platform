import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'youtube-player' });
const { default: Embed } = await env.load('features/dictation/components/YouTubeEmbed.jsx');
const { default: Player } = await env.load('features/dictation/components/YouTubeSegmentPlayer.jsx');

afterEach(async () => {
  await env.unmount();
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
});
after(env.close);

test('embed reports a failed script and supports a fresh load with listener disposal', async t => {
  const handleError = t.mock.fn();
  const handleReady = t.mock.fn();
  const handleDispose = t.mock.fn();
  const destroy = t.mock.fn();
  const priorReady = t.mock.fn();
  window.onYouTubeIframeAPIReady = priorReady;
  const render = () =>
    env.render(
      h(Embed, {
        videoId: 'dQw4w9WgXcQ',
        title: 'Listening',
        onError: handleError,
        onReady: handleReady,
        onDispose: handleDispose,
      }),
    );
  await render();
  const script = () => document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
  await act(async () => script().dispatchEvent(new window.Event('error')));
  assert.equal(script(), null);
  assert.equal(handleError.mock.callCount(), 1);
  assert.equal(window.onYouTubeIframeAPIReady, priorReady);
  await env.unmount();
  await render();
  class NativePlayer {
    constructor(_frame, { events }) {
      this.events = events;
      queueMicrotask(() => events.onReady({ target: this }));
    }
    destroy = destroy;
  }
  window.YT = { Player: NativePlayer };
  await act(async () => window.onYouTubeIframeAPIReady());
  assert.equal(priorReady.mock.callCount(), 1);
  const player = handleReady.mock.calls[0].arguments[0];
  await env.unmount();
  await act(async () => player.events.onError({ data: 100 }));
  assert.equal(handleError.mock.callCount(), 1);
  assert.deepEqual(handleDispose.mock.calls[0].arguments, [player]);
  assert.equal(destroy.mock.callCount(), 1);
  script()?.remove();
});

test('segment playback resumes, pauses and advances only at the end of its time range', async t => {
  let state = 5;
  let time = 5;
  let events;
  const pause = t.mock.fn();
  const play = t.mock.fn();
  const next = t.mock.fn();
  class NativePlayer {
    constructor(_frame, config) {
      events = config.events;
      queueMicrotask(() => events.onReady({ target: this }));
    }
    cueVideoById() {
      queueMicrotask(() => events.onStateChange({ data: 5 }));
    }
    getPlayerState() {
      return state;
    }
    getCurrentTime() {
      return time;
    }
    seekTo(position) {
      time = position;
    }
    pauseVideo = pause;
    playVideo = play;
    destroy() {}
  }
  window.YT = { Player: NativePlayer };
  await env.render(
    h(Player, { videoId: 'dQw4w9WgXcQ', title: 'Listening', start: 5, end: 10, onNext: next }),
  );
  await env.click(env.button('Bắt đầu'));
  assert.equal(play.mock.callCount(), 1);
  state = 1;
  await act(async () => events.onStateChange({ data: 1 }));
  await env.click(env.button('Tạm dừng'));
  assert.equal(pause.mock.callCount(), 1);
  await act(async () => events.onAutoplayBlocked());
  assert.match(document.body.textContent, /Bấm nút phát/);
  await act(async () => events.onError({ data: 101 }));
  assert.match(document.body.textContent, /Không phát được video/);
  state = 2;
  time = 10;
  await act(async () => events.onStateChange({ data: 2 }));
  await env.click(env.button('Bắt đầu'));
  assert.equal(next.mock.callCount(), 1);
});
