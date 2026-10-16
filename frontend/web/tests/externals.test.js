import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { getAiErrorMessage, readCapabilities } from '../src/features/ai-assistant/utils/aiState.js';

process.env.VITE_API_URL = 'http://gateway.test';
const server = await createServer({
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => server.close());
const load = path => server.ssrLoadModule(`/src/${path}`);

test('AI preparation states are validated and errors are user-facing', () => {
  const capabilities = { available: false, historyAvailable: false, maxMessageLength: 4000 };
  assert.deepEqual(readCapabilities(capabilities), capabilities);
  for (const invalid of [
    null,
    {},
    { ...capabilities, available: 'false' },
    { ...capabilities, maxMessageLength: 5000 },
  ]) {
    assert.throws(() => readCapabilities(invalid), /Không thể tải trạng thái/);
  }
  assert.match(getAiErrorMessage({ code: 'AI_NOT_AVAILABLE', message: 'Internal detail' }), /chưa sẵn sàng/);
  assert.match(getAiErrorMessage({ status: 403, message: 'Access is denied' }), /không có quyền/);
  assert.match(getAiErrorMessage({ status: 503, message: 'Internal detail' }), /Vui lòng thử lại/);
});

test('AI and Payment preparation APIs reuse the Gateway client and do not send identity fields', async () => {
  const { default: client } = await load('shared/apis/axiosClient.js');
  const { aiApi } = await load('features/ai-assistant/api/aiApi.js');
  const { paymentApi } = await load('features/payment/api/paymentApi.js');
  const seen = [];
  const original = client.defaults.adapter;
  client.defaults.adapter = async config => {
    seen.push(config);
    return { config, status: 200, headers: {}, data: { success: true, data: {} } };
  };
  try {
    await aiApi.getCapabilities();
    await paymentApi.getMethods();
    await aiApi.createConversation({ title: 'Bài học', userId: 999, apiKey: 'untrusted' });
    await aiApi.sendMessage(1, 'Explain this lesson');
    await aiApi.getConversations({ page: 1, size: 10 });
    assert.deepEqual(
      seen.map(config => config.url),
      [
        '/api/v1/ai/capabilities',
        '/api/v1/payments/methods',
        '/api/v1/ai/conversations',
        '/api/v1/ai/conversations/1/messages',
        '/api/v1/ai/conversations',
      ],
    );
    assert.equal(seen[0].baseURL, 'http://gateway.test');
    assert.deepEqual(JSON.parse(seen[2].data), { title: 'Bài học' });
    assert.deepEqual(JSON.parse(seen[3].data), { content: 'Explain this lesson' });
    assert.deepEqual(seen[4].params, { page: 1, size: 10 });
  } finally {
    client.defaults.adapter = original;
  }
});

test('AI workspace and updated checkout compile with the existing layout', async () => {
  for (const path of [
    'features/ai-assistant/pages/AiAssistantPage.jsx',
    'features/ai-assistant/components/AiTutorSection.jsx',
    'features/payment/pages/PaymentCheckoutPage.jsx',
  ]) {
    assert.equal(typeof (await load(path)).default, 'function', path);
  }
});
