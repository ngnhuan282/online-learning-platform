import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';

const storage = new Map();
const sessionMap = new Map();
const events = new EventTarget();
const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  fetch: globalThis.fetch,
};

globalThis.window = {
  Event,
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  },
  sessionStorage: {
    getItem: key => sessionMap.get(key) ?? null,
    setItem: (key, value) => sessionMap.set(key, String(value)),
    removeItem: key => sessionMap.delete(key),
  },
  location: { origin: 'http://localhost', href: 'http://localhost/' },
  dispatchEvent: events.dispatchEvent.bind(events),
  addEventListener: events.addEventListener.bind(events),
  removeEventListener: events.removeEventListener.bind(events),
};

const createdLinks = [];
globalThis.document = {
  documentElement: { lang: 'vi' },
  createElement: tag => {
    const el = {
      tagName: tag,
      clicked: false,
      click() {
        this.clicked = true;
      },
      remove() {},
    };
    createdLinks.push(el);
    return el;
  },
};

const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/coverage-api-contracts',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});

const load = path => server.ssrLoadModule('/src/' + path);

const { default: axiosClient } = await load('shared/apis/axiosClient.js');
const { ENDPOINTS } = await load('shared/apis/endpoints.js');
const { ROLES } = await load('shared/constants/roles.js');
const tokenUtils = await load('shared/utils/tokenUtils.js');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { categoryApi } = await load('features/courses/api/categoryApi.js');
const { lessonApi } = await load('features/courses/api/lessonApi.js');
const { sectionApi } = await load('features/courses/api/sectionApi.js');
const { reviewApi } = await load('features/courses/api/reviewApi.js');
const { mediaApi } = await load('features/courses/api/mediaApi.js');
const { toCourseCard, normalizeCategoryList } = await load('features/courses/utils/courseCatalog.js');
const { normalizeCourseList, normalizeCoursePayload } = await load('features/courses/utils/courseForm.js');
const { toeicApi } = await load('features/learning/api/toeicApi.js');
const { learningApi } = await load('features/learning/api/learningApi.js');
const { lookupDictionaryTerm } = await load('features/learning/utils/dictionaryClient.js');
const { notificationCategory } = await load('features/learning/utils/notificationStream.js');
const { readQuizDraft } = await load('features/learning/utils/quizDraft.js');
const { parseQuestionFile } = await load('features/learning/utils/toeicQuestionImport.js');
const { adminApi } = await load('features/admin/api/adminApi.js');
const { commerceAdminApi } = await load('features/admin/api/commerceAdminApi.js');
const { download, csvCell, togglePermission } = await load('features/admin/utils/adminUtils.js');
const { paymentApi } = await load('features/payment/api/paymentApi.js');
const { userApi } = await load('features/auth/api/userApi.js');
const { authApi } = await load('features/auth/api/authApi.js');
const { validateAuth, getPasswordStrength } = await load('features/auth/schemas/authValidation.js');
const { readGoogleAttempt, startGoogleLogin } = await load('features/auth/utils/googleLogin.js');
const { proApi } = await load('features/pro/api/proApi.js');
const { engagementApi } = await load('features/engagement/api/engagementApi.js');
const { shopApi } = await load('features/shop/api/shopApi.js');
const { aiApi } = await load('features/ai-assistant/api/aiApi.js');
const { getAiErrorMessage } = await load('features/ai-assistant/utils/aiState.js');
const { dictationApi, downloadWorkbook } = await load('features/dictation/api/dictationApi.js');
const { directVideoUrl } = await load('features/dictation/utils/dictation.js');

const originalAdapter = axiosClient.defaults.adapter;

afterEach(() => {
  axiosClient.defaults.adapter = originalAdapter;
  globalThis.fetch = originalGlobals.fetch;
  storage.clear();
  sessionMap.clear();
  createdLinks.length = 0;
  tokenUtils.clearTokens();
});

after(async () => {
  await server.close();
  globalThis.window = originalGlobals.window;
  globalThis.document = originalGlobals.document;
  globalThis.fetch = originalGlobals.fetch;
});

function installCaptureAdapter() {
  const calls = [];
  axiosClient.defaults.adapter = async config => {
    calls.push({
      method: String(config.method || 'get').toUpperCase(),
      url: config.url,
      params: config.params,
      data: config.data,
      skipAuth: Boolean(config.skipAuth),
    });
    if (typeof config.onUploadProgress === 'function') {
      config.onUploadProgress({ loaded: 50, total: 100 });
      config.onUploadProgress({ loaded: 50, total: 0 });
    }
    return {
      config,
      status: 200,
      headers: {},
      data: { success: true, data: {} },
    };
  };
  return calls;
}

test('constants, endpoints and API modules issue expected gateway requests', async () => {
  assert.deepEqual(ROLES, { USER: 'USER', ADMIN: 'ADMIN' });
  const calls = installCaptureAdapter();

  await courseApi.adminGetById(7);
  await courseApi.adminList({ page: 0 });
  await courseApi.list({ q: 'toeic' });
  await courseApi.categories();
  await courseApi.getById(7);
  await courseApi.create({ title: 'C1' });
  await courseApi.update(7, { title: 'C2' });
  await courseApi.delete(7);

  await categoryApi.adminList();
  await categoryApi.list();
  await categoryApi.getById(3);
  await categoryApi.create({ name: 'Cat' });
  await categoryApi.update(3, { name: 'Cat2' });
  await categoryApi.delete(3);

  await sectionApi.listByCourse(7);
  await sectionApi.create(7, { title: 'Sec' });
  await sectionApi.update(7, 2, { title: 'Sec2' });
  await sectionApi.delete(7, 2);
  await sectionApi.reorder(7, [{ id: 2, orderIndex: 0 }]);

  await lessonApi.create(2, { title: 'Les' });
  await lessonApi.update(9, { title: 'Les2' });
  await lessonApi.delete(9);
  await lessonApi.reorder(2, [{ id: 9, orderIndex: 0 }]);
  await lessonApi.getPlayUrl(7, 9);

  await reviewApi.list(7, { page: 0 });
  await reviewApi.myReview(7);
  await reviewApi.create(7, { rating: 5, comment: 'Great' });
  await reviewApi.update(7, 11, { rating: 4, comment: 'Good' });
  await reviewApi.delete(7, 11);
  await reviewApi.adminList(7, { page: 0 });
  await reviewApi.adminList(null, { page: 0 });
  await reviewApi.adminListAll({ page: 1 });
  await reviewApi.updateVisibility(11, true);
  await reviewApi.hide(7, 11);
  await reviewApi.show(7, 11);

  const file = new File(['hello'], 'thumb.png', { type: 'image/png' });
  const eventsProgress = [];
  await mediaApi.upload(file, 'thumbnails', p => eventsProgress.push(p));
  await mediaApi.upload(file);
  assert.equal(eventsProgress.length, 1);
  assert.equal(eventsProgress[0].percent, 50);
  await mediaApi.listResources(9);
  await mediaApi.addResource(9, { title: 'Doc', url: 'https://example.com' });
  await mediaApi.deleteResource(4);

  assert.ok(calls.some(c => c.method === 'GET' && c.url === `${ENDPOINTS.adminCourses}/7`));
  assert.ok(calls.some(c => c.method === 'PATCH' && c.url.endsWith('/admin/reviews/11/visibility')));
  assert.ok(calls.some(c => c.method === 'POST' && c.url.endsWith('/admin/media/upload')));
});

test('learning, toeic, admin, commerce, payment, auth, pro, engagement, shop, ai, dictation APIs', async () => {
  const calls = installCaptureAdapter();

  await toeicApi.list();
  await toeicApi.dictionary('plan');
  await toeicApi.notes();
  await toeicApi.notes(5);
  await toeicApi.createNote({ term: 'a' });
  await toeicApi.updateNote(1, { note: 'b' });
  await toeicApi.deleteNote(1);
  await toeicApi.detail(5);
  await toeicApi.progress(5);
  await toeicApi.completeLesson(5, 8);
  await toeicApi.start(5, 'PRACTICE', 5);
  await toeicApi.start(5, 'EXAM', null, 120);
  await toeicApi.attempt(3);
  await toeicApi.saveAnswers(3, { 1: 'A' });
  await toeicApi.submit(3, { 1: 'A' });
  await toeicApi.adminList();
  await toeicApi.adminDetail(5);
  await toeicApi.create({ title: 'T1' });
  await toeicApi.update(5, { title: 'T2' });
  await toeicApi.publish(5, true);
  await toeicApi.remove(5);

  await learningApi.getDashboard();
  await learningApi.getMyEnrollments();
  await learningApi.enroll(7);
  await learningApi.getLearningCourse(7);
  await learningApi.getCourseProgress(7);
  await learningApi.accessLesson(7, 9);
  await learningApi.markLessonComplete(7, 9);
  await learningApi.getQuiz(4);
  await learningApi.getCourseQuizzes(7);
  await learningApi.startQuiz(4);
  await learningApi.submitQuiz(12, []);
  await learningApi.getQuizResult(4);
  await learningApi.getQuizReview(12);
  await learningApi.getAdminQuizzes();
  await learningApi.getAdminQuiz(4);
  await learningApi.createQuiz({ title: 'Q' });
  await learningApi.updateQuiz(4, { title: 'Q2' });
  await learningApi.publishQuiz(4);
  await learningApi.deleteQuiz(4);
  await learningApi.getNotifications();
  await learningApi.getNotificationFeed({ page: 0 });
  await learningApi.getNotificationSummary();
  await learningApi.markAllNotificationsRead();
  const streamUrls = [];
  globalThis.fetch = async req => {
    streamUrls.push(typeof req === 'string' ? req : req.url);
    return new Response('data: ok\n\n', {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  };
  const streamRes = await learningApi.openNotificationStream();
  await streamRes?.data?.cancel?.();
  await learningApi.markNotificationRead(2);
  await learningApi.getAdminNotifications({ page: 0 });
  await learningApi.sendSystemNotification({ title: 'Hi' });

  await adminApi.overview();
  await adminApi.courses();
  await adminApi.learning();
  await adminApi.payments();
  await adminApi.paymentOrders({ page: 0 });
  await adminApi.commerceAnalytics('overview', null);
  await adminApi.roles();
  await adminApi.permissions();
  await adminApi.createRole({ name: 'MOD' });
  await adminApi.updateRole(2, { name: 'MOD2' });
  await adminApi.deleteRole(2);
  await adminApi.audit();

  await commerceAdminApi.items();
  await commerceAdminApi.saveItem({ code: 'F1' }, true);
  await commerceAdminApi.saveItem({ code: 'F1' }, false);
  await commerceAdminApi.purchases({ page: 0 });
  await commerceAdminApi.saveReward('R1', { xp: 10 });
  await commerceAdminApi.grant(1, { planCode: 'PRO' });
  await commerceAdminApi.learningAudit();
  await commerceAdminApi.paymentAudit();

  await paymentApi.getMethods();
  await paymentApi.createCheckout({ courseId: 1 });
  await paymentApi.createProCheckout({ planCode: 'PRO_MONTH' });
  await paymentApi.createGemCheckout({ packCode: 'GEM_100' });
  await paymentApi.getOrder('ORD1');
  await paymentApi.retryActivation('ORD1');
  await paymentApi.completeMockPayment('ORD1', { result: 'SUCCESS' });
  await paymentApi.getHistory({ keyword: 'abc', status: 'EXPIRED' });
  await paymentApi.getHistory({ status: 'SUCCESS' });
  await paymentApi.getHistory();
  await paymentApi.getAdminAnalytics();
  await paymentApi.getAdminOrders({ keyword: 'k', status: 'EXPIRED' });
  await paymentApi.getAdminOrders({ status: 'PENDING' });
  await paymentApi.getAdminOrders();
  await paymentApi.getAdminOrder('ORD1');
  await paymentApi.updateAdminOrderStatus('ORD1', { status: 'PAID' });

  await userApi.linkedAccounts();
  await userApi.adminCreateUser({ email: 'a@b.com' });
  await userApi.adminUpdateUser(1, { fullName: 'A' });
  await userApi.adminDeleteUser(1);
  await userApi.updateProfile({ fullName: 'B' });
  await userApi.changePassword({ currentPassword: '1', newPassword: '2' });
  await userApi.adminListUsers({ page: 0 });
  await userApi.adminGetUser(1);
  await userApi.adminUpdateStatus(1, 'ACTIVE');
  await userApi.adminUpdateRoles(1, ['ADMIN']);

  await authApi.forgotPassword({ email: 'a@b.com' });
  await authApi.resetPassword({ token: 't', newPassword: 'P1', confirmPassword: 'P1' });
  await authApi.startGoogleLink({ currentPassword: 'pw', challenge: 'ch' });
  await authApi.completeGoogleLink({ code: 'c', verifier: 'v' });
  await authApi.startGoogle('ch');
  await authApi.exchangeGoogle({ code: 'c', verifier: 'v' });
  await authApi.login({ email: 'a@b.com', password: 'pw', remember: true });
  await authApi.register({ fullName: 'A', email: 'a@b.com', password: 'P1' });
  await authApi.getMe();
  await authApi.logout();

  let proEvents = 0;
  events.addEventListener('chitchatgo:pro-changed', () => {
    proEvents++;
  });
  await proApi.plans();
  await proApi.membership();
  await proApi.redeem('CODE123');
  await proApi.codes();
  await proApi.createCode({ code: 'NEW1' });
  await proApi.revokeCode(9);
  assert.equal(proEvents, 1);

  await engagementApi.summary();
  await engagementApi.claim('R1');
  await engagementApi.equipFrame('F1');
  await engagementApi.leaderboard({ page: 0 });

  await shopApi.state();
  await shopApi.purchase('F1', 'req-1');
  await shopApi.equip('FRAME', 'F1');

  await aiApi.getCapabilities();
  await aiApi.getUsage();
  await aiApi.getConversations({ page: 1, size: 10 });
  await aiApi.getConversation('conv-1');
  await aiApi.createConversation({ title: 'Help' });
  await aiApi.getMessages('conv-1');
  await aiApi.sendMessage('conv-1', 'Hello', 'req-1');

  const dFile = new File(['abc'], 'audio.mp3', { type: 'audio/mpeg' });
  await dictationApi.query(dictationApi.catalogPath, { page: 0 });
  await dictationApi.start('ex1', {});
  await dictationApi.progress('att1', {});
  await dictationApi.check('att1', { index: 0, text: 'hi' });
  await dictationApi.hint('att1', 0, 0);
  await dictationApi.reveal('att1', 0);
  await dictationApi.skip('att1', 0);
  await dictationApi.finish('att1');
  await dictationApi.audio('att1');
  await dictationApi.adminAudio('k1');
  await dictationApi.upload(dFile);
  await dictationApi.detail('ex1');
  await dictationApi.save(null, {});
  await dictationApi.save('ex1', {});
  await dictationApi.publish('ex1', 1, {});
  await dictationApi.visibility('ex1', true);
  await dictationApi.template();
  await dictationApi.import(dFile);

  assert.ok(streamUrls.some(url => url.endsWith(ENDPOINTS.learning.notificationStream)));
  assert.ok(calls.some(c => c.url === `${ENDPOINTS.payments}/history` && c.params?.expired === true));
  assert.ok(calls.some(c => c.url === `${ENDPOINTS.payments}/admin/orders` && c.params?.status === 'PENDING'));
});

test('utility branches, download helpers, dictionary fallback, and import edge cases', async () => {
  const card = toCourseCard({
    id: 99,
    title: 'Workshop',
    description: 'General',
    categoryId: 'other-id',
    categoryName: 'Random Topic',
    price: 0,
  });
  assert.equal(card.fallbackImage, '/images/english-ielts.jpg');
  assert.deepEqual(normalizeCategoryList({ data: { data: [{ id: 1 }] } }), [{ id: 1 }]);
  assert.deepEqual(normalizeCategoryList(null), []);

  assert.equal(normalizeCourseList({ data: { data: [{ title: 'A' }] } }).length, 1);
  assert.deepEqual(normalizeCourseList(null), []);
  assert.equal(normalizeCoursePayload({ title: 'A', categoryId: '2' }).categoryId, 2);

  assert.equal(directVideoUrl('https://cdn.example.com/clip.mp4'), 'https://cdn.example.com/clip.mp4');
  assert.equal(directVideoUrl('http://insecure.example.com/clip.mp4'), '');
  assert.equal(directVideoUrl('https://user:pass@example.com/clip.mp4'), '');
  assert.equal(directVideoUrl('not-a-url'), '');

  assert.equal(notificationCategory({ type: 'UNKNOWN' }), 'SYSTEM');
  storage.set('k-bad-draft', '{bad-json');
  assert.deepEqual(readQuizDraft('k-bad-draft', 1, { questions: [] }), {});

  assert.equal(tokenUtils.decodeToken('a.bm90LWpzb24.c'), null);
  assert.equal(getAiErrorMessage({ status: 401 }), 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  assert.equal(getAiErrorMessage({ message: 'Fallback error' }), 'Fallback error');

  assert.match(validateAuth({ fullName: 'x'.repeat(101), email: 'bad', password: 'weak', confirmPassword: 'x', terms: true }, 'register').fullName, /100/);
  assert.match(validateAuth({ fullName: 'Ok', email: 'bad', password: 'weak', confirmPassword: 'x', terms: true }, 'register').email, /định dạng/);
  assert.equal(getPasswordStrength('short').label, 'Yếu');

  sessionMap.set('google_login_attempt', '{bad');
  assert.equal(readGoogleAttempt('login'), null);
  installCaptureAdapter();
  await assert.rejects(() => startGoogleLogin('/account'), /Địa chỉ đăng nhập Google không hợp lệ/);
  axiosClient.defaults.adapter = () => Promise.reject(new Error('network fail'));
  await assert.rejects(() => startGoogleLogin('/account'), /Không thể kết nối máy chủ/);

  // Download + timer revocation callbacks
  const origSetTimeout = globalThis.setTimeout;
  const origRevoke = URL.revokeObjectURL;
  const origCreate = URL.createObjectURL;
  let revokedCount = 0;
  globalThis.setTimeout = fn => {
    fn();
    return 0;
  };
  URL.createObjectURL = () => 'blob:mock-url';
  URL.revokeObjectURL = () => {
    revokedCount++;
  };
  try {
    download('report.csv', 'a,b');
    downloadWorkbook(new Blob(['xlsx']));
  } finally {
    globalThis.setTimeout = origSetTimeout;
    URL.revokeObjectURL = origRevoke;
    URL.createObjectURL = origCreate;
  }
  assert.equal(revokedCount, 2);
  assert.equal(createdLinks.filter(l => l.clicked).length, 2);
  assert.equal(csvCell('=cmd'), `"'=cmd"`);
  assert.deepEqual(
    togglePermission(['P_A', 'P_B'], 'P_A', false, [
      { code: 'P_A', dependencies: [] },
      { code: 'P_B', dependencies: ['P_A'] },
    ]),
    [],
  );

  // Dictionary external fetch non-US audio fallback
  axiosClient.defaults.adapter = async config => ({
    config,
    status: 200,
    headers: {},
    data: { success: true, data: { headword: 'uniqueheadword', meanings: [] } },
  });
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      {
        phonetic: '/tɛst/',
        phonetics: [{ audio: 'https://cdn.example/uk.mp3' }],
        meanings: [{ partOfSpeech: 'noun', definitions: [{ definition: 'a trial', example: 'test it' }] }],
      },
    ],
  });
  const dictRes = await lookupDictionaryTerm('UniqueTestWord');
  assert.equal(dictRes.audioUrl, 'https://cdn.example/uk.mp3');
  assert.equal(dictRes.found, true);

  // Import file validation edge cases
  const overSizeBufferFile = {
    name: 'big.csv',
    size: 100,
    arrayBuffer: async () => new ArrayBuffer(5 * 1024 * 1024 + 10),
  };
  const overRes = await parseQuestionFile(overSizeBufferFile);
  assert.match(overRes.errors[0], /5 MB/);

  const badQuoteCsv = new File(['number,part,prompt,A,B,C,D,Đáp án,Giải thích\n101,5,a"b,a,b,c,d,A,e'], 'bad.csv', {
    type: 'text/csv',
  });
  assert.match((await parseQuestionFile(badQuoteCsv)).errors[0], /dấu ngoặc kép/);

  const extraColCsv = new File(
    ['Số câu,Part,Câu hỏi,A,B,C,D,Đáp án,Giải thích\n101,5,Q,a,b,c,d,A,E,EXTRA'],
    'extra.csv',
    { type: 'text/csv' },
  );
  const extraParsed = await parseQuestionFile(extraColCsv);
  assert.match(extraParsed.rows[0].errors[0], /nhiều ô dữ liệu/);

  // Malformed XLSX zip directory checks (entries > 2000 & bad CD signature)
  const makeEocd = (entries, cdOffset) => {
    const buf = new ArrayBuffer(Math.max(22, cdOffset + 46));
    const view = new DataView(buf);
    const eocdOff = cdOffset + 46 > 22 ? cdOffset + 46 - 22 : 0;
    const realBuf = new ArrayBuffer(eocdOff + 22);
    const rv = new DataView(realBuf);
    rv.setUint32(eocdOff, 0x06054b50, true);
    rv.setUint16(eocdOff + 10, entries, true);
    rv.setUint32(eocdOff + 16, cdOffset, true);
    void view;
    return realBuf;
  };
  const tooComplexRes = await parseQuestionFile({
    name: 'complex.xlsx',
    size: 100,
    arrayBuffer: async () => makeEocd(2001, 0),
  });
  assert.match(tooComplexRes.errors[0], /quá phức tạp/);

  const badCdRes = await parseQuestionFile({
    name: 'badcd.xlsx',
    size: 100,
    arrayBuffer: async () => makeEocd(1, 0),
  });
  assert.match(badCdRes.errors[0], /không hợp lệ/);

  const packedBuf = (() => {
    const realBuf = new ArrayBuffer(46 + 22);
    const rv = new DataView(realBuf);
    rv.setUint32(0, 0x02014b50, true);
    rv.setUint32(24, 31 * 1024 * 1024, true);
    rv.setUint32(46, 0x06054b50, true);
    rv.setUint16(46 + 10, 1, true);
    rv.setUint32(46 + 16, 0, true);
    return realBuf;
  })();
  const tooBigUnpacked = await parseQuestionFile({
    name: 'bomb.xlsx',
    size: 100,
    arrayBuffer: async () => packedBuf,
  });
  assert.match(tooBigUnpacked.errors[0], /quá lớn/);
});
