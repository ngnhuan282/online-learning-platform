import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createElement as h } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { setupDomTestEnv } from '../../helpers/vite-dom.js';

const env = await setupDomTestEnv({ cacheKey: 'home-hero' });
const { default: HeroSection } = await env.load('features/home/components/HeroSection.jsx');
const { default: client } = await env.load('shared/apis/axiosClient.js');
const { AuthContext } = await env.load('features/auth/context/AuthContext.jsx');
const { dictationApi } = await env.load('features/dictation/api/dictationApi.js');
const { ROUTES } = await env.load('shared/constants/routes.js');
const originalAdapter = client.defaults.adapter;

const lesson = {
  id: 'lesson 1',
  title: 'Frozen – In Summer (Olaf) | Official Disney UK',
  topic: 'movie short clip',
  level: 'B1',
  duration: 119,
  sentenceCount: 18,
  progressTotal: 18,
  completed: 0,
  video: true,
  thumbnailUrl: 'https://i.ytimg.com/vi/example1234/mqdefault.jpg',
};

const preview = () => document.querySelector('.home-studio-lesson');

function CurrentRoute() {
  const { pathname, search } = useLocation();
  return h('h1', null, pathname + search);
}

function home(auth = {}) {
  return h(
    MemoryRouter,
    null,
    h(
      AuthContext.Provider,
      { value: auth },
      h(
        Routes,
        null,
        h(Route, { path: '/', element: h(HeroSection) }),
        h(Route, { path: ROUTES.DICTATION + '/:id?', element: h(CurrentRoute) }),
      ),
    ),
  );
}

function mockCatalog(items) {
  const requests = [];
  client.defaults.adapter = async config => {
    requests.push({ url: config.url, method: config.method, params: config.params });
    if (items instanceof Error) throw items;
    return { config, status: 200, headers: {}, data: { success: true, data: { items } } };
  };
  return requests;
}

afterEach(async () => {
  await env.unmount();
  client.defaults.adapter = originalAdapter;
});
after(env.close);

test('the landing page looks up the published Frozen lesson and opens the actual library', async () => {
  const requests = mockCatalog([lesson]);
  await env.render(home());
  await env.waitFor(() => preview().getAttribute('href') === '/dictation/lesson%201');
  assert.deepEqual(requests, [
    {
      url: dictationApi.catalogPath,
      method: 'get',
      params: { keyword: 'In Summer (Olaf)', page: 0, size: 1 },
    },
  ]);
  assert.match(preview().textContent, /Movie Short Clip.*B1.*Video.*01:59/s);
  assert.match(preview().textContent, /Frozen – In Summer \(Olaf\).*Chưa luyện.*18 câu.*Bắt đầu/s);
  assert.equal(preview().querySelector('progress').value, 0);

  assert.deepEqual(
    [...document.querySelectorAll('.home-hero-stats strong')].map(stat => stat.textContent),
    ['50,000+', '8.5 IELTS', '24/7'],
  );
  assert.match(document.querySelector('.home-hero-stats').textContent, /Học mọi lúc, mọi nơi/);
  assert.equal(preview().querySelector('img').getAttribute('src'), '/images/home-frozen.jpg');

  await env.click('.home-library-link');
  assert.equal(document.querySelector('h1').textContent, ROUTES.DICTATION);
});

test('the preview waits for auth and opens the existing attempt with its saved progress', async () => {
  const requests = mockCatalog([
    { ...lesson, video: false, thumbnailUrl: null, attemptId: 'saved attempt', completed: 5 },
  ]);
  await env.render(home({ isLoading: true }));
  assert.equal(requests.length, 0);
  assert.equal(preview().getAttribute('href'), ROUTES.DICTATION);

  await env.render(home({ user: { id: 3 } }));
  const expected = '/dictation/lesson%201?attempt=saved%20attempt';
  await env.waitFor(() => preview().getAttribute('href') === expected);
  assert.match(preview().textContent, /Audio.*Đang luyện.*Tiếp tục/s);
  assert.equal(preview().querySelector('progress').value, 5);
  assert.equal(preview().querySelector('progress').max, 18);

  await env.click(preview());
  assert.equal(document.querySelector('h1').textContent, expected);
  assert.equal(requests.length, 1);
});

test('an empty or unavailable catalog keeps a usable library link', async () => {
  for (const catalog of [[], new Error('Unavailable')]) {
    const requests = mockCatalog(catalog);
    await env.render(home());
    await env.flush();
    assert.equal(requests.length, 1);
    assert.equal(preview().getAttribute('href'), ROUTES.DICTATION);
    assert.equal(preview().querySelector('img').getAttribute('src'), '/images/english-speaking.jpg');
    assert.equal(preview().querySelector('progress'), null);
    assert.equal(document.querySelector('.home-library-link'), null);
    await env.click(preview());
    assert.equal(document.querySelector('h1').textContent, ROUTES.DICTATION);
    await env.unmount();
  }
});
