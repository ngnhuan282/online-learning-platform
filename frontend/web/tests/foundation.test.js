import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

// Vite loads the actual JS/JSX modules and import.meta.env, including modules not yet used by pages.
process.env.VITE_API_URL = 'http://gateway.test';
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/foundation',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const events = new EventTarget();
const storage = new Map();
globalThis.window = {
  sessionStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
  },
  dispatchEvent: events.dispatchEvent.bind(events),
  addEventListener: events.addEventListener.bind(events),
  removeEventListener: events.removeEventListener.bind(events),
};
after(async () => {
  await server.close();
  delete globalThis.window;
});

const load = path => server.ssrLoadModule(`/src/${path}`);
const tokens = await load('shared/utils/tokenUtils.js');
const makeToken = (claims = {}) =>
  `header.${Buffer.from(JSON.stringify({ sub: 'user', role: 'USER', exp: Math.floor(Date.now() / 1000) + 600, ...claims })).toString('base64url')}.signature`;

test('tokens handle Unicode, malformed data, expiry and blocked storage', () => {
  const token = makeToken({ sub: 'Nguyễn Văn A' });
  assert.equal(tokens.decodeToken(token).sub, 'Nguyễn Văn A');
  assert.equal(tokens.isTokenExpired(token), false);
  assert.equal(tokens.isTokenExpired(makeToken({ exp: 1 })), true);
  assert.equal(tokens.isTokenExpired(makeToken({ exp: 'bad' })), true);
  assert.equal(tokens.decodeToken('broken'), null);
  assert.throws(() => tokens.setAccessToken('broken'));
  tokens.setAccessToken(token);
  assert.equal(tokens.getAccessToken(), token);
  tokens.clearTokens();
  assert.equal(tokens.getAccessToken(), null);
  const original = window.sessionStorage;
  window.sessionStorage = {
    getItem() {
      throw Error('blocked');
    },
    setItem() {
      throw Error('blocked');
    },
    removeItem() {
      throw Error('blocked');
    },
  };
  tokens.setAccessToken(token);
  assert.equal(tokens.getAccessToken(), token);
  tokens.clearTokens();
  window.sessionStorage = original;
});

test('Axios attaches tokens, unwraps envelopes, normalizes 401 and rejects bypass URLs', async () => {
  const { default: client } = await load('shared/apis/axiosClient.js');
  const { authApi } = await load('features/auth/api/authApi.js');
  let seen;
  const adapter = async config => {
    seen = config;
    return {
      config,
      status: 200,
      headers: {},
      data: { success: true, message: 'Success', data: { ready: true } },
    };
  };
  const token = makeToken();
  tokens.setAccessToken(token);
  const result = await client.get('/api/v1/users/me', { adapter });
  assert.equal(result.data.ready, true);
  assert.equal(seen.headers.get('Authorization'), `Bearer ${token}`);
  await authApi.login({ email: 'test@example.com', password: 'test', remember: true }, { adapter });
  assert.equal(seen.headers.has('Authorization'), false);
  assert.equal(JSON.parse(seen.data).remember, undefined);
  assert.equal(JSON.parse(seen.data).rememberMe, true);
  await assert.rejects(client.get('https://other.example/api/v1/users/me', { adapter }), {
    code: 'INVALID_API_URL',
  });
  await assert.rejects(client.get('/api/v1/users/me', { baseURL: 'http://other.example', adapter }), {
    code: 'INVALID_API_URL',
  });
  const unauthorized = config =>
    Promise.reject({
      config,
      response: { status: 401, data: { code: 'UNAUTHORIZED', message: 'Sign in', errors: null } },
    });
  await assert.rejects(client.get('/api/v1/users/me', { adapter: unauthorized }), {
    code: 'UNAUTHORIZED',
    status: 401,
  });
  assert.equal(tokens.getAccessToken(), null);
  tokens.setAccessToken(token);
  const newer = makeToken({ sub: 'new-user' });
  await assert.rejects(
    client.get('/api/v1/users/me', {
      adapter: config => {
        tokens.setAccessToken(newer);
        return unauthorized(config);
      },
    }),
  );
  assert.equal(tokens.getAccessToken(), newer);
  tokens.clearTokens();
});

test('formatting and errors tolerate missing values', async () => {
  const { formatDate } = await load('shared/utils/formatDate.js');
  const { formatCurrency } = await load('shared/utils/formatCurrency.js');
  const { normalizeApiError } = await load('shared/utils/errorUtils.js');
  assert.equal(formatDate('invalid'), '—');
  assert.equal(formatDate(null), '—');
  assert.equal(formatCurrency(null), '—');
  assert.match(formatCurrency(120000), /120/);
  assert.equal(normalizeApiError({ code: 'ECONNABORTED' }).code, 'ECONNABORTED');
  assert.equal(
    normalizeApiError({ response: { status: 400, data: { errors: { email: ['invalid'] } } } }).errors
      .email[0],
    'invalid',
  );
});

test('learning API preserves identifiers and filters in requests and refreshes engagement after progress writes', async () => {
  const { default: client } = await load('shared/apis/axiosClient.js');
  const { learningApi } = await load('features/learning/api/learningApi.js');
  const { ENGAGEMENT_CHANGED } = await load('features/engagement/utils/engagementEvents.js');
  const originalAdapter = client.defaults.adapter;
  const requests = [];
  let engagementChanges = 0;
  const onEngagementChanged = () => engagementChanges++;
  const definition = { title: 'Vocabulary review', courseId: 42 };
  const notification = { title: 'Practice reminder', body: 'A new exercise is available' };
  const answers = [{ questionId: 17, optionIds: [3] }];
  const filters = { page: 2, size: 10, unread: true };
  const { signal } = new AbortController();

  client.defaults.adapter = async config => {
    requests.push(config);
    return { config, status: 200, headers: {}, data: { success: true, data: { received: true } } };
  };
  window.addEventListener(ENGAGEMENT_CHANGED, onEngagementChanged);
  try {
    const calls = [
      { name: 'getDashboard', method: 'get', path: 'dashboard' },
      { name: 'getMyEnrollments', method: 'get', path: 'enrollments/me' },
      { name: 'enroll', args: [42], method: 'post', path: 'enrollments', body: { courseId: 42 } },
      { name: 'getLearningCourse', args: [42, { signal }], method: 'get', path: 'courses/42', signal },
      { name: 'getCourseProgress', args: [42], method: 'get', path: 'progress/courses/42' },
      { name: 'accessLesson', args: [42, 8], method: 'post', path: 'progress/courses/42/lessons/8/access' },
      {
        name: 'markLessonComplete',
        args: [42, 8],
        method: 'patch',
        path: 'progress/courses/42/lessons/8/complete',
        refresh: true,
      },
      { name: 'getQuiz', args: [6], method: 'get', path: 'quizzes/6' },
      { name: 'getCourseQuizzes', args: [42], method: 'get', path: 'courses/42/quizzes' },
      { name: 'startQuiz', args: [6], method: 'post', path: 'quizzes/6/attempts' },
      {
        name: 'submitQuiz',
        args: [91, answers],
        method: 'post',
        path: 'quizzes/attempts/91/submit',
        body: { answers },
        refresh: true,
      },
      { name: 'getQuizResult', args: [6], method: 'get', path: 'quizzes/6/result' },
      { name: 'getQuizReview', args: [91], method: 'get', path: 'quizzes/attempts/91/review' },
      { name: 'getAdminQuizzes', method: 'get', path: 'admin/quizzes' },
      { name: 'getAdminQuiz', args: [6], method: 'get', path: 'admin/quizzes/6' },
      { name: 'createQuiz', args: [definition], method: 'post', path: 'admin/quizzes', body: definition },
      { name: 'updateQuiz', args: [6, definition], method: 'put', path: 'admin/quizzes/6', body: definition },
      { name: 'publishQuiz', args: [6], method: 'patch', path: 'admin/quizzes/6/publish' },
      { name: 'deleteQuiz', args: [6], method: 'delete', path: 'admin/quizzes/6' },
      { name: 'getNotifications', method: 'get', path: 'notifications' },
      {
        name: 'getNotificationFeed',
        args: [filters, { signal }],
        method: 'get',
        path: 'notifications/feed',
        params: filters,
        signal,
      },
      {
        name: 'getNotificationSummary',
        args: [{ signal }],
        method: 'get',
        path: 'notifications/summary',
        signal,
      },
      { name: 'markAllNotificationsRead', method: 'patch', path: 'notifications/read-all' },
      { name: 'markNotificationRead', args: [22], method: 'patch', path: 'notifications/22/read' },
      {
        name: 'getAdminNotifications',
        args: [filters, { signal }],
        method: 'get',
        path: 'admin/notifications',
        params: filters,
        signal,
      },
      {
        name: 'sendSystemNotification',
        args: [notification],
        method: 'post',
        path: 'admin/notifications',
        body: notification,
      },
    ];
    for (const request of calls) {
      const previousChanges = engagementChanges;
      const response = await learningApi[request.name](...(request.args ?? []));
      assert.equal(response.data.received, true, request.name);
      const { method, url, data, params, signal } = requests.at(-1);
      assert.equal(method, request.method, request.name);
      assert.equal(url, `/api/v1/learning/${request.path}`, request.name);
      assert.deepEqual(data && JSON.parse(data), request.body, request.name);
      assert.deepEqual(params, request.params, request.name);
      assert.equal(signal, request.signal, request.name);
      assert.equal(engagementChanges - previousChanges, request.refresh ? 1 : 0, request.name);
    }
    assert.equal(requests.length, calls.length);
  } finally {
    window.removeEventListener(ENGAGEMENT_CHANGED, onEngagementChanged);
    client.defaults.adapter = originalAdapter;
  }
});

test('all reusable JSX components, layouts and guards compile', async () => {
  for (const path of [
    'shared/components/AppLoading.jsx',
    'shared/components/EmptyState.jsx',
    'shared/components/ErrorState.jsx',
    'shared/components/ConfirmDialog.jsx',
    'shared/components/PageHeader.jsx',
    'shared/components/StatusChip.jsx',
    'layouts/UserLayout.jsx',
    'layouts/AdminLayout.jsx',
    'routes/ProtectedRoute.jsx',
    'routes/RoleRoute.jsx',
    'app/providers.jsx',
  ])
    assert.equal(typeof (await load(path)).default, 'function', path);
});

test('dictionary merges local meanings with the headword pronunciation and caches normalized lookups', async () => {
  const { lookupDictionaryTerm, normalizeLookupTerm } = await load(
    'features/learning/utils/dictionaryClient.js',
  );
  const { toeicApi } = await load('features/learning/api/toeicApi.js');
  const originalDictionary = toeicApi.dictionary;
  const originalFetch = globalThis.fetch;
  const queried = [];
  const fetched = [];
  const localMeanings = [{ meaningVi: 'sắp xếp', partOfSpeech: 'verb' }];
  toeicApi.dictionary = async word => {
    queried.push(word);
    return { data: { headword: 'arrange', meanings: localMeanings, relatedForms: ['arrangement'] } };
  };
  globalThis.fetch = async (url, options) => {
    assert.ok(options.signal);
    const word = new URL(url).pathname.split('/').at(-1);
    fetched.push(word);
    if (word === 'arranged') return { ok: false };
    assert.equal(word, 'arrange');
    return {
      ok: true,
      json: async () => [
        {
          phonetics: [
            { text: '/əˈreɪndʒ/', audio: 'https://media.example.test/arrange-uk.mp3' },
            { audio: 'https://media.example.test/arrange-us.mp3' },
          ],
          meanings: [
            {
              partOfSpeech: 'verb',
              definitions: [{ definition: 'Put in order', example: 'Arrange a meeting.' }],
            },
          ],
        },
      ],
    };
  };

  try {
    const found = await lookupDictionaryTerm(' «Arranged!» ');
    assert.equal(found.headword, 'arrange');
    assert.equal(found.phonetic, '/əˈreɪndʒ/');
    assert.match(found.audioUrl, /arrange-us\.mp3$/);
    assert.deepEqual(found.meanings, localMeanings);
    assert.deepEqual(found.englishMeanings, [
      { partOfSpeech: 'verb', definitionEn: 'Put in order', exampleEn: 'Arrange a meeting.' },
    ]);
    assert.deepEqual(found.relatedForms, ['arrangement']);
    assert.equal(found.found, true);
    assert.equal(await lookupDictionaryTerm('ARRANGED'), found);
    assert.deepEqual(queried, ['Arranged']);
    assert.deepEqual(fetched, ['arranged', 'arrange']);
    assert.equal(normalizeLookupTerm('re—check'), 're-check');
    assert.equal((await lookupDictionaryTerm('…')).found, false);
  } finally {
    toeicApi.dictionary = originalDictionary;
    globalThis.fetch = originalFetch;
  }
});

test('external dictionary failure leaves local multi-word results available', async () => {
  const { lookupDictionaryTerm } = await load('features/learning/utils/dictionaryClient.js');
  const { toeicApi } = await load('features/learning/api/toeicApi.js');
  const originalDictionary = toeicApi.dictionary;
  const originalFetch = globalThis.fetch;
  const fetched = [];
  toeicApi.dictionary = async word => {
    if (word === 'project brief') return { data: { meanings: [{ meaningVi: 'tóm tắt dự án' }] } };
    throw new Error('Dictionary server unavailable');
  };
  globalThis.fetch = async url => {
    fetched.push(url);
    throw new Error('Audio provider unavailable');
  };
  try {
    assert.equal((await lookupDictionaryTerm('project brief')).found, true);
    assert.deepEqual(fetched, []);
    const missing = await lookupDictionaryTerm('pinpointed');
    assert.equal(missing.found, false);
    assert.equal(missing.audioUrl, null);
    assert.equal(fetched.length, 1);
  } finally {
    toeicApi.dictionary = originalDictionary;
    globalThis.fetch = originalFetch;
  }
});

test('pronunciation falls back to browser speech when recorded US audio cannot play', async () => {
  const { speakEnglishText } = await load('features/learning/utils/dictionaryClient.js');
  const originalAudio = globalThis.Audio;
  const spoken = [];
  const played = [];
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  window.speechSynthesis = { cancel() {}, speak: phrase => spoken.push(phrase) };
  globalThis.Audio = class {
    constructor(url) {
      played.push(url);
    }
    async play() {
      throw new Error('Media blocked');
    }
  };

  try {
    const url = 'https://media.example.test/hello.mp3';
    speakEnglishText('  hello  ', 'en-US', url);
    await Promise.resolve();
    speakEnglishText('hello', 'en-GB', url);
    speakEnglishText('');
    assert.deepEqual(played, [url]);
    assert.deepEqual(
      spoken.map(({ text, lang, rate }) => [text, lang, rate]),
      [
        ['hello', 'en-US', 0.95],
        ['hello', 'en-GB', 0.95],
      ],
    );
  } finally {
    globalThis.Audio = originalAudio;
    delete window.SpeechSynthesisUtterance;
    delete window.speechSynthesis;
  }
});
