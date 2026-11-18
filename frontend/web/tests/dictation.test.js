import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createServer } from 'vite';
import {
  answerTokens,
  definitionPayload,
  draftError,
  formatTime,
  isCurrentGrade,
  isSentenceLocked,
  maskedWords,
  parseTime,
  scoreDescription,
  scoreFeedback,
  sentenceState,
  transcriptImportBase,
  wordFeedback,
} from '../src/features/dictation/utils/dictation.js';

const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/dictation',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const { dictationApi } = await server.ssrLoadModule('/src/features/dictation/api/dictationApi.js');
const { default: client } = await server.ssrLoadModule('/src/shared/apis/axiosClient.js');
const originals = { get: client.get, post: client.post, put: client.put };
afterEach(() => Object.assign(client, originals));
after(async () => {
  await server.close();
});

test('Excel append preserves current rows, including partial edits, and skips only the initial empty placeholder', () => {
  const empty = { key: 'empty', text: '', start: null, end: null };
  assert.deepEqual(transcriptImportBase([empty], 'append'), []);
  for (const edited of [
    { ...empty, text: 'Hello' },
    { ...empty, start: 0 },
  ]) {
    const rows = [edited];
    assert.equal(transcriptImportBase(rows, 'append'), rows);
    assert.deepEqual(transcriptImportBase(rows, 'replace'), []);
  }
  const rows = [{ ...empty, text: 'Hello', start: 1.234, end: 3.456 }, empty];
  assert.equal(transcriptImportBase(rows, 'append'), rows);
  assert.equal(rows[0].start, 1.234);
  assert.equal(rows.length, 2);
});

test('score feedback changes at 50 and 80 without rounding across a boundary', () => {
  for (const [score, tone] of [
    [0, 'low'],
    [49.9, 'low'],
    [50, 'mid'],
    [79.9, 'mid'],
    [80, 'high'],
    [100, 'high'],
  ])
    assert.equal(scoreFeedback(score).tone, tone);
});

test('time fields show mm:ss and retain exact captured seconds until edited', () => {
  assert.equal(formatTime(75.438), '01:15');
  assert.equal(formatTime(0), '00:00');
  assert.equal(formatTime(null), '');
  assert.equal(formatTime(Number.NaN), '');
  assert.equal(parseTime('01:15'), 75);
  assert.equal(parseTime(75.438), 75.438);
  assert.equal(parseTime(''), null);
  assert.equal(parseTime(null), null);
  for (const value of ['1:2', '00:62', '75 seconds', '01:15.5', 'abc']) assert.throws(() => parseTime(value));
});

test('draft payload is portable and strips UI-only row keys and learner scoring fields', () => {
  const form = {
    title: ' Picnic ',
    description: ' Sample ',
    topic: ' Workplace ',
    level: 'B1',
    audioKey: 'sample-ets-2024-test-1',
    courseId: 'unrelated-course',
    accuracy: 100,
    reward: 999,
    sentences: [{ key: 'ui-only', text: ' Hello! ', start: 1.125, end: '00:05' }],
  };
  assert.deepEqual(definitionPayload(form), {
    title: 'Picnic',
    description: 'Sample',
    topic: 'Workplace',
    level: 'B1',
    audioKey: 'sample-ets-2024-test-1',
    sentences: [{ text: 'Hello!', start: 1.125, end: 5 }],
  });
  assert.equal(definitionPayload({ ...form, audioKey: '' }).audioKey, null);
  assert.equal(draftError(form), null);
  assert.ok(draftError({ ...form, title: '' }));
  assert.ok(draftError({ ...form, topic: '' }));
  assert.ok(draftError({ ...form, sentences: [] }));
  assert.ok(draftError({ ...form, sentences: [{ text: '' }] }));
  assert.ok(draftError({ ...form, sentences: [{ text: 'Hello', start: 'bad', end: null }] }));
});

test('answer tokens normalize case, punctuation, Unicode width and curly apostrophes', () => {
  assert.deepEqual(answerTokens('WE enjoyed it, TODAY!'), ['we', 'enjoyed', 'it', 'today']);
  assert.deepEqual(answerTokens('I\u2019LL go.'), ["i'll", 'go']);
  assert.deepEqual(answerTokens('\uFF37\uFF45 42!'), ['we', '42']);
  assert.deepEqual(answerTokens(' ... '), []);
});

test('live completion is authoritative and transcript markers have only done and new states', () => {
  for (const response of [
    { completed: true },
    { completed: true, revealed: true },
    { completed: true, skipped: true },
    { completed: true, checked: false, grade: null },
  ]) {
    assert.equal(isSentenceLocked(response), true);
    assert.equal(sentenceState(response), 'done');
  }
  for (const response of [
    {},
    { completed: false },
    { completed: false, text: 'wrong', grade: { accuracy: 0 } },
    { completed: false, checked: true, text: 'we', grade: { accuracy: 100, words: [{ actual: 'we' }] } },
  ]) {
    assert.equal(Boolean(isSentenceLocked(response)), false);
    assert.equal(sentenceState(response), 'new');
  }
});

test('legacy correct answers still lock only when the grade matches the current answer', () => {
  const response = { checked: true, text: 'WE!', grade: { accuracy: 100, words: [{ actual: 'we' }] } };
  assert.equal(isSentenceLocked(response), true);
  assert.equal(sentenceState(response), 'done');
  assert.equal(isSentenceLocked({ ...response, text: 'asd' }), false);
  assert.equal(isSentenceLocked({ ...response, grade: { ...response.grade, accuracy: 50 } }), false);
  assert.equal(sentenceState({ ...response, text: 'asd' }), 'new');
  assert.equal(sentenceState({ revealed: true }), 'done');
  assert.equal(sentenceState({ skipped: true }), 'done');
});

test('masked transcript reveals only server-approved hints and uses bounded word lengths', () => {
  const segment = { words: 4, wordLengths: [2, 6, 7, 2] };
  assert.deepEqual(maskedWords(segment, {}), ['**', '******', '*******', '**']);
  assert.deepEqual(maskedWords(segment, { hints: [{ index: 1, text: 'really' }] }), [
    '**',
    'really',
    '*******',
    '**',
  ]);
  assert.deepEqual(maskedWords({ words: 2 }, {}), ['****', '****']);
  assert.deepEqual(maskedWords({ words: 1, wordLengths: [30] }, {}), ['************']);
});

test('word feedback shows verified words, masks incorrect and partial words and prioritizes hints', () => {
  const segment = { words: 4, wordLengths: [2, 6, 7, 2] };
  const response = {
    text: 'we wrong enj',
    feedback: [
      { index: 0, state: 'correct', text: 'we' },
      { index: 1, state: 'incorrect', text: null },
      { index: 2, state: 'partial', text: null },
      { index: 3, state: 'empty', text: null },
    ],
    hints: [{ index: 2, text: 'enjoyed' }],
    grade: { words: [{ type: 'wrong', expected: 'really', actual: 'wrong' }] },
  };
  assert.deepEqual(wordFeedback(segment, response), [
    { index: 0, state: 'correct', text: 'we' },
    { index: 1, state: 'incorrect', text: '******' },
    { index: 2, state: 'hinted', text: 'enjoyed' },
    { index: 3, state: 'empty', text: '**' },
  ]);
  assert.equal(JSON.stringify(wordFeedback(segment, response)).includes('really'), false);
  assert.deepEqual(wordFeedback({ words: 1 }, { feedback: [{ index: 0, state: 'partial', text: null }] }), [
    { index: 0, state: 'partial', text: '****' },
  ]);
});

test('pending edits preserve a verified green prefix without trusting new or shifted words', () => {
  const segment = { words: 3, wordLengths: [2, 7, 2] };
  const response = {
    text: 'we enjoed it',
    feedback: [
      { index: 0, state: 'correct', text: 'we' },
      { index: 1, state: 'incorrect', text: null },
      { index: 2, state: 'correct', text: 'it' },
    ],
  };
  assert.deepEqual(wordFeedback(segment, response, 'we enjoyed it'), [
    { index: 0, state: 'correct', text: 'we' },
    { index: 1, state: 'empty', text: '*******' },
    { index: 2, state: 'correct', text: 'it' },
  ]);
  assert.deepEqual(
    wordFeedback(segment, response, 'they enjoyed this').map(word => word.state),
    ['empty', 'empty', 'empty'],
  );
  assert.equal(wordFeedback(segment, response, 'today we enjoed it')[0].state, 'empty');
  assert.equal(wordFeedback(segment, response, 'WE ENJOED IT!')[0].state, 'correct');
  assert.deepEqual(
    wordFeedback(segment, { text: 'we enjoyed it' }).map(word => word.state),
    ['empty', 'empty', 'empty'],
  );
});

test('grade freshness tracks actual tokens with sanitized missing and wrong expected words', () => {
  const grade = {
    words: [
      { type: 'correct', expected: 'we', actual: 'we' },
      { type: 'missing', expected: null, actual: null },
      { type: 'wrong', expected: null, actual: 'enjoed' },
      { type: 'correct', expected: 'it', actual: 'it' },
      { type: 'extra', expected: null, actual: 'today' },
    ],
  };
  assert.equal(isCurrentGrade('WE ENJOED IT, TODAY!', grade), true);
  assert.equal(isCurrentGrade('we really enjoyed it', grade), false);
  assert.equal(isCurrentGrade('', grade), false);
  assert.equal(isCurrentGrade('we enjoed it', grade), false);
  assert.equal(isCurrentGrade('test', null), false);
  assert.equal(isCurrentGrade('I\u2019LL go.', { words: [{ actual: "i'll" }, { actual: 'go' }] }), true);
});

test('legacy score descriptions preserve stored scores and explain the old scoring mode', () => {
  const legacy = { scoringMode: 'LEGACY', accuracy: 30.6 };
  const original = structuredClone(legacy);
  assert.match(scoreDescription(legacy), /lần kiểm tra đầu tiên/);
  assert.match(scoreDescription({ scoringMode: 'LIVE' }), /Gõ sai rồi tự sửa đúng/);
  assert.deepEqual(legacy, original);
});

test('word hints post only sentence and word indices to the owner-scoped endpoint', async () => {
  const calls = [];
  client.post = async (...args) => {
    calls.push(args);
    return {};
  };
  await dictationApi.hint('attempt 1', 2, 3);
  assert.deepEqual(calls, [
    ['/api/v1/learning/dictation/attempts/attempt%201/hint', { index: 2, wordIndex: 3 }],
  ]);
});

test('live operations use the shared Gateway client, scoped endpoints and draft-only progress payloads', async () => {
  const calls = [];
  for (const method of ['get', 'post', 'put'])
    client[method] = async (...args) => {
      calls.push({ method, args });
      return {};
    };
  const signal = new AbortController().signal;
  await dictationApi.query(dictationApi.historyPath, { status: 'IN_PROGRESS', page: 1, size: 20 }, signal);
  await dictationApi.start('lesson 1', { requestId: 'test', restart: false });
  await dictationApi.progress('attempt 1', { index: 2, text: 'draft' });
  await dictationApi.reveal('attempt 1', 2);
  await dictationApi.skip('attempt 1', 2);
  await dictationApi.finish('attempt 1');
  await dictationApi.audio('attempt 1', signal);
  assert.equal(dictationApi.attemptPath('attempt 1'), '/api/v1/learning/dictation/attempts/attempt%201');
  assert.deepEqual(calls, [
    {
      method: 'get',
      args: [
        '/api/v1/learning/dictation/attempts',
        { params: { status: 'IN_PROGRESS', page: 1, size: 20 }, signal },
      ],
    },
    {
      method: 'post',
      args: [
        '/api/v1/learning/dictation/exercises/lesson%201/attempts',
        { requestId: 'test', restart: false },
      ],
    },
    {
      method: 'put',
      args: ['/api/v1/learning/dictation/attempts/attempt%201/progress', { index: 2, text: 'draft' }],
    },
    { method: 'post', args: ['/api/v1/learning/dictation/attempts/attempt%201/reveal', { index: 2 }] },
    { method: 'post', args: ['/api/v1/learning/dictation/attempts/attempt%201/skip', { index: 2 }] },
    { method: 'post', args: ['/api/v1/learning/dictation/attempts/attempt%201/finish'] },
    {
      method: 'get',
      args: ['/api/v1/learning/dictation/attempts/attempt%201/audio', { responseType: 'blob', signal }],
    },
  ]);
  assert.equal(
    calls.some(call => call.args[0].endsWith('/check')),
    false,
  );
});

test('admin detail, create, update, publish, visibility, audio and template retain the shared API', async () => {
  const calls = [];
  for (const method of ['get', 'post', 'put'])
    client[method] = async (...args) => {
      calls.push({ method, args });
      return {};
    };
  const payload = { title: 'Picnic', sentences: [{ text: 'We enjoyed it.', start: 0, end: 4 }] };
  const signal = new AbortController().signal;
  await dictationApi.detail('lesson 1');
  await dictationApi.save(null, payload);
  await dictationApi.save('lesson 1', payload);
  await dictationApi.publish('lesson 1', 3);
  await dictationApi.publish(null, 0, payload);
  await dictationApi.publish('lesson 1', 3, payload);
  await dictationApi.visibility('lesson 1', true);
  await dictationApi.adminAudio('audio key', signal);
  await dictationApi.template();
  assert.deepEqual(calls, [
    { method: 'get', args: ['/api/v1/learning/admin/dictation/lesson%201'] },
    { method: 'post', args: ['/api/v1/learning/admin/dictation', payload] },
    { method: 'put', args: ['/api/v1/learning/admin/dictation/lesson%201', payload] },
    { method: 'post', args: ['/api/v1/learning/admin/dictation/lesson%201/publish', { version: 3 }] },
    {
      method: 'post',
      args: ['/api/v1/learning/admin/dictation/publish', { version: 0, definition: payload }],
    },
    {
      method: 'post',
      args: ['/api/v1/learning/admin/dictation/lesson%201/publish', { version: 3, definition: payload }],
    },
    { method: 'put', args: ['/api/v1/learning/admin/dictation/lesson%201/visibility', { archived: true }] },
    {
      method: 'get',
      args: ['/api/v1/learning/admin/dictation/audio/audio%20key', { responseType: 'blob', signal }],
    },
    { method: 'get', args: ['/api/v1/learning/admin/dictation/template', { responseType: 'blob' }] },
  ]);
});

test('upload and import use multipart containing only the file', async () => {
  const calls = [];
  client.post = async (...args) => {
    calls.push(args);
    return {};
  };
  await dictationApi.import(new File(['sample'], 'transcript.xlsx'));
  await dictationApi.upload(new File(['audio'], 'audio.mp3'));
  assert.equal(calls[0][0], '/api/v1/learning/admin/dictation/import');
  assert.ok(calls[0][1] instanceof FormData);
  assert.equal(calls[0][1].get('file').name, 'transcript.xlsx');
  assert.deepEqual([...calls[0][1].keys()], ['file']);
  assert.equal(calls[1][0], '/api/v1/learning/admin/dictation/audio');
  assert.equal(calls[1][1].get('file').name, 'audio.mp3');
  assert.deepEqual([...calls[1][1].keys()], ['file']);
  assert.equal(calls[1][2].timeout, 120000);
});
