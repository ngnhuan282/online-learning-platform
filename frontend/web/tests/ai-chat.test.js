import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';
import {
  mergeMessages,
  readContext,
  getAiErrorMessage,
  groupConversations,
} from '../src/features/ai-assistant/utils/aiState.js';

process.env.VITE_API_URL = 'http://gateway.test';
const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const { createRoot } = await import('react-dom/client');
const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/ai-chat',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
const load = path => server.ssrLoadModule(`/src/${path}`);
const { default: Page } = await load('features/ai-assistant/pages/AiAssistantPage.jsx');
const { aiApi } = await load('features/ai-assistant/api/aiApi.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const original = { ...aiApi };
const cache = createCache({ key: 'ai-test' });
const metadata = {
  id: 1,
  title: 'My lesson',
  courseId: 42,
  lessonId: 9,
  contextTitle: 'Past tense',
  updatedAt: new Date().toISOString(),
};
const message = (id, sender, content) => ({
  id,
  sender,
  content,
  requestId: 'request-0001',
  createdAt: new Date().toISOString(),
});
const page = (content, last = true) => ({ data: { content, page: 0, last, totalElements: content.length } });
let root;

beforeEach(() => {
  aiApi.getCapabilities = async () => ({
    data: { available: true, historyAvailable: true, maxMessageLength: 4000 },
  });
  aiApi.getConversations = async () => page([metadata]);
  aiApi.getConversation = async () => ({ data: metadata });
  aiApi.getMessages = async () => page([]);
  aiApi.createConversation = async () => ({ data: metadata });
  aiApi.sendMessage = async () => ({ data: [message(1, 'USER', 'Question'), message(2, 'AI', 'Answer')] });
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = null;
  Object.assign(aiApi, original);
});
after(async () => {
  await server.close();
  dom.window.close();
});

async function render(path = '/ai-assistant', userId = 1) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () =>
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(
          AuthContext.Provider,
          { value: { user: { id: userId } } },
          h(MemoryRouter, { initialEntries: [path] }, h(Page)),
        ),
      ),
    ),
  );
}

async function draft(value) {
  const textarea = document.querySelector('textarea:not([aria-hidden])');
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(
      textarea,
      value,
    );
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    textarea.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
}

async function submit() {
  await act(async () =>
    document
      .querySelector('form')
      .dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })),
  );
}

async function pressEnter(options = {}) {
  const event = new dom.window.KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
    ...options,
  });
  await act(async () => document.querySelector('textarea:not([aria-hidden])').dispatchEvent(event));
  return event;
}

test('keyboard Enter sends once while Shift+Enter and composition preserve the draft', async () => {
  const requests = [];
  aiApi.sendMessage = async (id, content) => {
    requests.push({ id, content });
    return { data: [message(1, 'USER', content), message(2, 'AI', 'Answer')] };
  };
  await render('/ai-assistant?conversationId=1');
  await draft('');
  await pressEnter();
  assert.equal(requests.length, 0);
  await draft('Câu hỏi bằng tiếng Việt');
  for (const options of [{ shiftKey: true }, { isComposing: true }, { keyCode: 229 }]) {
    const event = await pressEnter(options);
    assert.equal(event.defaultPrevented, false);
    assert.equal(requests.length, 0);
    assert.equal(document.querySelector('textarea:not([aria-hidden])').value, 'Câu hỏi bằng tiếng Việt');
  }
  assert.equal((await pressEnter({ repeat: true })).defaultPrevented, true);
  assert.equal(requests.length, 0);
  assert.equal((await pressEnter()).defaultPrevented, true);
  assert.deepEqual(requests, [{ id: '1', content: 'Câu hỏi bằng tiếng Việt' }]);
});

test('keyboard Enter cannot bypass blocked conversation state', async () => {
  let sends = 0;
  aiApi.getConversation = async () => {
    throw { status: 404 };
  };
  aiApi.sendMessage = async () => {
    sends++;
  };
  await render('/ai-assistant?conversationId=9');
  await draft('Blocked question');
  await pressEnter();
  await submit();
  assert.equal(sends, 0);
});

test('AI chat utilities keep chronological, deduplicated text and validate context links', () => {
  assert.deepEqual(mergeMessages([{ id: 2 }], [{ id: 1 }, { id: 2, content: 'saved' }]), [
    { id: 1 },
    { id: 2, content: 'saved' },
  ]);
  assert.deepEqual(readContext(new URLSearchParams('courseId=42&lessonId=9')), { courseId: 42, lessonId: 9 });
  assert.throws(() => readContext(new URLSearchParams('lessonId=9')));
  assert.throws(() => readContext(new URLSearchParams('courseId=-1')));
  assert.match(getAiErrorMessage({ code: 'AI_TIMEOUT' }), /quá lâu/);
  assert.match(getAiErrorMessage({ code: 'AI_QUOTA_EXCEEDED' }), /giới hạn/);
});

test('saved history opens without a provider key and message HTML is rendered as text', async () => {
  aiApi.getCapabilities = async () => ({
    data: { available: false, historyAvailable: true, maxMessageLength: 4000 },
  });
  aiApi.getMessages = async () => page([message(2, 'AI', '<img src=x onerror=alert(1)>')]);
  await render('/ai-assistant?conversationId=1');
  assert.match(document.body.textContent, /<img src=x/);
  assert.equal(document.querySelector('.ai-assistant-message img'), null);
  assert.equal(document.querySelector('button[aria-label="Gửi câu hỏi"]').disabled, true);
  assert.match(document.body.textContent, /Lịch sử hội thoại vẫn có thể xem lại/);
});

test('new conversation sends only context IDs and persists a real response after reload', async () => {
  let created;
  let sent;
  let saved = [];
  aiApi.createConversation = async context => {
    created = context;
    return { data: metadata };
  };
  aiApi.getMessages = async () => page(saved);
  aiApi.sendMessage = async (id, content, requestId) => {
    sent = { id, content, requestId };
    saved = [message(1, 'USER', content), message(2, 'AI', 'Generated answer')];
    return { data: saved };
  };
  await render('/ai-assistant?courseId=42&lessonId=9');
  await draft('Explain past tense');
  await submit();
  assert.deepEqual(created, { courseId: 42, lessonId: 9 });
  assert.equal(sent.content, 'Explain past tense');
  assert.match(sent.requestId, /^[0-9a-f-]{36}$/);
  assert.match(document.body.textContent, /Generated answer/);
  assert.equal(document.querySelectorAll('.ai-assistant-message').length, 2);
  await act(async () => document.querySelector('button[aria-label="Làm mới"]').click());
  assert.equal(document.querySelectorAll('.ai-assistant-message').length, 2);
});

test('quota failure preserves draft and retry uses the same request identity', async () => {
  const requests = [];
  let saved = [];
  aiApi.getMessages = async () => page(saved);
  aiApi.sendMessage = async (id, content, requestId) => {
    requests.push({ id, content, requestId });
    if (requests.length === 1) throw { code: 'AI_QUOTA_EXCEEDED', status: 429 };
    saved = [message(1, 'USER', content), message(2, 'AI', 'Recovered answer')];
    return { data: saved };
  };
  await render('/ai-assistant?conversationId=1');
  await draft('Keep my question');
  await submit();
  assert.equal(document.querySelector('textarea:not([aria-hidden])').value, 'Keep my question');
  assert.match(document.body.textContent, /giới hạn sử dụng AI/);
  await act(async () =>
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Thử lại').click(),
  );
  assert.deepEqual(requests[0], requests[1]);
  assert.match(document.body.textContent, /Recovered answer/);
});

test('pending response prevents double submit and navigation; user switch drops old data', async () => {
  let resolve;
  let sends = 0;
  aiApi.sendMessage = () => {
    sends++;
    return new Promise(done => {
      resolve = done;
    });
  };
  await render('/ai-assistant?conversationId=1');
  await draft('Question');
  await submit();
  await submit();
  assert.equal(sends, 1);
  assert.equal(document.querySelector('button[aria-label="Hội thoại mới"]').disabled, true);
  assert.match(document.body.textContent, /Đang trả lời/);
  aiApi.getConversations = async () => page([]);
  aiApi.getConversation = async () => {
    throw { status: 404 };
  };
  aiApi.getMessages = async () => {
    throw { status: 404 };
  };
  await render('/ai-assistant?conversationId=1', 2);
  await act(async () => resolve({ data: [message(1, 'AI', 'Must not leak')] }));
  assert.doesNotMatch(document.body.textContent, /Must not leak/);
});

test('older messages and more conversations are paged without losing or duplicating history', async () => {
  aiApi.getConversations = async ({ page: number = 0 } = {}) =>
    page(number ? [{ ...metadata, id: 2, title: 'Older conversation' }] : [metadata], number > 0);
  aiApi.getMessages = async (id, { page: number = 0 } = {}) =>
    page(
      number
        ? [message(2, 'AI', 'Second'), message(1, 'USER', 'First')]
        : [message(3, 'USER', 'Third'), message(2, 'AI', 'Second')],
      number > 0,
    );
  await render('/ai-assistant?conversationId=1');
  await act(async () =>
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Tin nhắn trước').click(),
  );
  assert.deepEqual(
    [...document.querySelectorAll('.ai-assistant-message p')].map(item => item.textContent),
    ['First', 'Second', 'Third'],
  );
  await act(async () =>
    [...document.querySelectorAll('button')].find(button => button.textContent === 'Xem thêm').click(),
  );
  assert.match(document.body.textContent, /Older conversation/);
});

test('foreign conversation errors block generation', async () => {
  aiApi.getConversation = async () => {
    throw { status: 404 };
  };
  await render('/ai-assistant?conversationId=9');
  assert.match(document.body.textContent, /Không tìm thấy hội thoại/);
  await draft('blocked');
  assert.equal(document.querySelector('button[aria-label="Gửi câu hỏi"]').disabled, true);
});

test('AI Markdown renders headings, emphasis, lists, tables and code without executable HTML or remote images', async () => {
  aiApi.getMessages = async () =>
    page([
      message(1, 'USER', '**Keep my question literal**'),
      message(
        2,
        'AI',
        [
          '## Past tense',
          '**Finished action** and *a specific time*.',
          '- First example\n- Second example',
          '| Tense | Example |\n| --- | --- |\n| Past | I studied. |',
          '```text\nI studied yesterday.\n```',
          '[Reference](https://example.com/lesson)',
          '[Unsafe](javascript:alert%281%29)',
          '![Image description](https://example.com/tracking.png)',
          '<img src=x onerror=alert(1)>',
          '<script>alert(1)</script>',
        ].join('\n\n'),
      ),
    ]);
  await render('/ai-assistant?conversationId=1');
  const answer = document.querySelector('.ai-assistant-markdown');
  assert.equal(answer.querySelector('h3').textContent, 'Past tense');
  assert.equal(answer.querySelector('strong').textContent, 'Finished action');
  assert.equal(answer.querySelector('em').textContent, 'a specific time');
  assert.equal(answer.querySelectorAll('li').length, 2);
  assert.equal(answer.querySelectorAll('table tbody tr').length, 1);
  assert.match(answer.querySelector('pre code').textContent, /I studied yesterday/);
  assert.equal(answer.querySelector('img, script, iframe'), null);
  assert.equal(answer.querySelector('a[href^="javascript:"]'), null);
  assert.match(answer.textContent, /Image description/);
  const reference = answer.querySelector('a[href="https://example.com/lesson"]');
  assert.equal(reference.target, '_blank');
  assert.equal(reference.rel, 'noopener noreferrer');
  assert.equal(document.querySelector('.from-user strong'), null);
  assert.equal(document.querySelector('.ai-assistant-user-text').textContent, '**Keep my question literal**');
});

test('copy answer writes its original content and reports clipboard denial without losing the answer', async () => {
  const content = '**Saved answer**';
  let copied;
  Object.defineProperty(dom.window.navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: async value => {
        copied = value;
      },
    },
  });
  aiApi.getMessages = async () => page([message(1, 'AI', content)]);
  await render('/ai-assistant?conversationId=1');
  const button = document.querySelector('button[aria-label="Sao chép câu trả lời"]');
  await act(async () => button.click());
  assert.equal(copied, content);
  assert.match(document.body.textContent, /Đã sao chép/);
  dom.window.navigator.clipboard.writeText = async () => {
    throw new Error('Permission denied');
  };
  await act(async () => button.click());
  assert.match(document.body.textContent, /Không thể sao chép/);
  assert.equal(document.querySelector('.ai-assistant-markdown strong').textContent, 'Saved answer');
});

test('AI LaTeX renders grammar formulas and block math while preserving currency and code', async () => {
  aiApi.getMessages = async () =>
    page([
      message(1, 'USER', 'Explain $S + V_2$'),
      message(
        2,
        'AI',
        [
          'Khẳng định: $S + V_{ed/cột 2}$',
          'Phủ định: $S + did\\ not + V_{nguyên\\ thể}$',
          '$$\nx^2 + y^2 = z^2\n$$',
          'Giá $5 hoặc $10. Giá riêng: $20.',
          'Giá được escape: \\$5 và \\$10.',
          '`$S + V_2$`',
          '```text\n$S + did not + V$\n```',
        ].join('\n\n'),
      ),
    ]);
  await render('/ai-assistant?conversationId=1');
  const answer = document.querySelector('.ai-assistant-markdown');
  assert.equal(answer.querySelectorAll('.katex').length, 3);
  assert.ok(answer.querySelector('.katex-display'));
  assert.equal(answer.querySelector('.katex-error'), null);
  assert.ok(answer.querySelector('.katex math'));
  assert.match(answer.textContent, /Giá \$5 hoặc \$10/);
  assert.match(answer.textContent, /Giá riêng: \$20/);
  assert.match(answer.textContent, /Giá được escape: \$5 và \$10/);
  assert.ok([...answer.querySelectorAll('code')].some(code => code.textContent === '$S + V_2$'));
  assert.match(answer.querySelector('pre code').textContent, /\$S \+ did not \+ V\$/);
  assert.equal(document.querySelector('.from-user .katex'), null);
  assert.match(document.querySelector('.ai-assistant-user-text').textContent, /\$S \+ V_2\$/);
});

test('invalid or untrusted LaTeX cannot execute HTML, load images or break the conversation', async () => {
  aiApi.getMessages = async () =>
    page([
      message(
        1,
        'AI',
        [
          '$\\notAValidCommand{x}$',
          '$\\href{javascript:alert(1)}{Open}$',
          '$\\includegraphics{https://example.com/tracking.png}$',
          '**The answer remains readable.**',
        ].join('\n\n'),
      ),
    ]);
  await render('/ai-assistant?conversationId=1');
  const answer = document.querySelector('.ai-assistant-markdown');
  assert.match(answer.textContent, /notAValidCommand/);
  assert.equal(answer.querySelector('img, script, iframe, a[href^="javascript:"]'), null);
  assert.equal(answer.querySelector('strong').textContent, 'The answer remains readable.');
});

test('conversation groups follow local calendar boundaries and preserve loaded ordering', () => {
  const now = new Date(2026, 9, 19, 12);
  const dates = [
    new Date(2026, 9, 19),
    new Date(2026, 9, 18, 23, 59),
    new Date(2026, 9, 12),
    new Date(2026, 9, 11, 23, 59),
    new Date(2026, 8, 1),
  ];
  const groups = groupConversations(
    dates.map((date, index) => ({ id: index + 1, updatedAt: date.toISOString() })),
    now,
  );
  assert.deepEqual(
    groups.map(group => group.label),
    ['Hôm nay', 'Hôm qua', '7 ngày qua', 'Trước đó'],
  );
  assert.deepEqual(
    groups.map(group => group.items.map(item => item.id)),
    [[1], [2], [3], [4, 5]],
  );
  assert.deepEqual(groupConversations([], now), []);
});

test('a truncated answer keeps its text and explains the limit when history is reopened', async () => {
  aiApi.getMessages = async () =>
    page([{ ...message(2, 'AI', 'An unfinished explanation'), truncated: true }]);
  await render('/ai-assistant?conversationId=1');
  assert.match(document.querySelector('.ai-assistant-markdown').textContent, /An unfinished explanation/);
  assert.match(document.querySelector('.ai-assistant-truncated').textContent, /chưa đầy đủ/);
  assert.match(document.querySelector('.ai-assistant-truncated').textContent, /Tiếp tục phần còn lại/);
});

test('prompt starters fill the draft without calling the provider, and new conversation clears saved messages', async () => {
  let calls = 0;
  aiApi.sendMessage = async () => {
    calls++;
  };
  aiApi.getMessages = async () => page([message(1, 'AI', 'Old answer')]);
  await render('/ai-assistant?conversationId=1');
  await act(async () => document.querySelector('button[aria-label="Hội thoại mới"]').click());
  assert.equal(document.querySelector('.ai-assistant-message'), null);
  await act(async () => document.querySelector('button[aria-label="Ôn ngữ pháp"]').click());
  assert.match(document.querySelector('textarea:not([aria-hidden])').value, /hiện tại hoàn thành/);
  assert.equal(calls, 0);
});

test('lesson starters prepare summaries and practice questions without sending, and omit code help', async () => {
  let calls = 0;
  aiApi.sendMessage = async () => {
    calls++;
  };
  await render('/ai-assistant?courseId=42&lessonId=9');
  for (const [label, expected] of [
    ['Tóm tắt bài học', /Tóm tắt nội dung bài học đang chọn/],
    ['Câu hỏi luyện tập', /5 câu hỏi trắc nghiệm/],
  ]) {
    await act(async () =>
      [...document.querySelectorAll('button')].find(button => button.textContent === label).click(),
    );
    assert.match(document.querySelector('textarea:not([aria-hidden])').value, expected);
  }
  assert.equal(calls, 0);
  await act(async () => document.querySelector('button[aria-label="Hội thoại mới"]').click());
  assert.ok(
    ![...document.querySelectorAll('button')].some(button => button.textContent === 'Tóm tắt bài học'),
  );
  assert.ok(
    ![...document.querySelectorAll('button')].some(button => button.textContent === 'Giải thích code'),
  );
});
