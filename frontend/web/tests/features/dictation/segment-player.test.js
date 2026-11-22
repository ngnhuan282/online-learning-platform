import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement as h } from 'react';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'segment-player' });
const { default: SegmentPlayer } = await env.load('features/dictation/components/SegmentPlayer.jsx');

afterEach(env.unmount);
after(env.close);

test('audio errors are visible, volume controls the media element and EOF can replay the whole recording', async t => {
  const media = window.HTMLMediaElement.prototype;
  t.mock.method(media, 'pause', () => {});
  let attempts = 0;
  const play = t.mock.method(media, 'play', async () => {
    if (++attempts === 1) throw new Error('Audio temporarily unavailable');
  });
  await env.render(h(SegmentPlayer, { src: 'blob:recording', start: 1, end: 10, duration: 10 }));
  const audio = document.querySelector('audio');
  let ended = false;
  Object.defineProperties(audio, {
    readyState: { value: 4 },
    duration: { value: 10 },
    ended: { get: () => ended },
  });
  await act(async () => audio.dispatchEvent(new window.Event('loadedmetadata')));
  await env.click(env.button('Bắt đầu'));
  assert.match(document.body.textContent, /Không phát được audio/);
  await env.click(env.button('Bắt đầu'));
  assert.doesNotMatch(document.body.textContent, /Không phát được audio/);
  await env.setInputValue('.dictation-volume input', '0.5');
  assert.equal(audio.volume, 0.5);
  ended = true;
  audio.currentTime = 10;
  await act(async () => audio.dispatchEvent(new window.Event('ended')));
  assert.equal(env.button('Bắt đầu').disabled, true);
  await env.setInputValue('.dictation-timeline input', '9.99');
  ended = false;
  await env.click(env.button('Bắt đầu'));
  assert.equal(audio.currentTime, 0);
  assert.equal(play.mock.callCount(), 3);
  await act(async () => audio.dispatchEvent(new window.Event('error')));
  assert.match(document.body.textContent, /Không phát được audio/);
});
