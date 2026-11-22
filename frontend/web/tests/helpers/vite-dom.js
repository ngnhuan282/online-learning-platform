import assert from 'node:assert/strict';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

export async function setupDomTestEnv({ cacheKey = 'test', url = 'http://localhost', plugins = [] } = {}) {
  process.env.VITE_API_URL ||= 'http://gateway.test';

  const dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url,
    pretendToBeVisual: true,
  });

  const keys = [
    'window',
    'document',
    'Event',
    'CustomEvent',
    'FormData',
    'HTMLElement',
    'DocumentFragment',
    'ShadowRoot',
    'Node',
    'MouseEvent',
    'KeyboardEvent',
    'getComputedStyle',
    'alert',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'IS_REACT_ACT_ENVIRONMENT',
  ];
  const prev = new Map(keys.map(k => [k, [k in globalThis, globalThis[k]]]));

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.Event = dom.window.Event;
  globalThis.CustomEvent = dom.window.CustomEvent;
  globalThis.FormData = dom.window.FormData;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.DocumentFragment = dom.window.DocumentFragment;
  globalThis.ShadowRoot = dom.window.ShadowRoot;
  globalThis.Node = dom.window.Node;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  globalThis.alert = dom.window.alert.bind(dom.window);
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.scrollTo = () => {};
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.HTMLElement.prototype.scrollTo = () => {};

  const { createRoot } = await import('react-dom/client');
  const server = await createServer({
    cacheDir: `node_modules/.vite-tests/${cacheKey}`,
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins,
  });

  const load = path => server.ssrLoadModule(`/src/${path}`);
  const cache = createCache({ key: cacheKey });
  let root = null;

  async function render(element) {
    root ??= createRoot(document.getElementById('root'));
    await act(async () => {
      root.render(h(CacheProvider, { value: cache }, element));
    });
  }

  async function unmount() {
    if (root) {
      await act(async () => root.unmount());
      root = null;
    }
  }

  async function flush(ticks = 4, delayMs = 10) {
    for (let i = 0; i < ticks; i++) {
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      });
    }
  }

  async function waitFor(predicate, message) {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, message);
      await flush(1);
    }
  }

  async function setInputValue(selectorOrEl, value) {
    const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
    assert.ok(el, `Missing input ${selectorOrEl}`);
    const proto = Object.getPrototypeOf(el);
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.set) descriptor.set.call(el, value);
    else el.value = value;
    const evtName = el.tagName === 'SELECT' ? 'change' : 'input';
    await act(async () => {
      el.dispatchEvent(new Event(evtName, { bubbles: true }));
      if (el.tagName !== 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  async function click(selectorOrElement) {
    const element =
      typeof selectorOrElement === 'string' ? document.querySelector(selectorOrElement) : selectorOrElement;
    assert.ok(element, `Missing clickable element ${selectorOrElement}`);
    assert.ok(!element.disabled, 'Expected the control to be enabled');
    await act(async () => element.click());
  }

  function button(text, container = document) {
    return [...(container?.querySelectorAll('button') ?? [])].find(
      element => element.textContent.trim() === text,
    );
  }

  function field(text, container = document) {
    const normalized = value => value?.replace(/\s*\*\s*$/, '').trim();
    const select = [...(container?.querySelectorAll('[role="combobox"]') ?? [])].find(element =>
      element
        .getAttribute('aria-labelledby')
        ?.split(/\s+/)
        .some(id => normalized(document.getElementById(id)?.textContent) === text),
    );
    if (select) return select;
    const label = [...container.querySelectorAll('label')].find(element => {
      const options = element.querySelector('select')?.textContent;
      return normalized(options ? element.textContent.replace(options, '') : element.textContent) === text;
    });
    return label?.control ?? label?.closest('.MuiFormControl-root')?.querySelector('[role="combobox"]');
  }

  async function selectOption(control, value) {
    assert.ok(control, 'Expected a select control');
    if (control.tagName === 'SELECT') {
      await setInputValue(control, value);
      return;
    }
    await act(async () =>
      control.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 })),
    );
    const option = [...document.querySelectorAll('[role="option"]')].find(
      element => element.dataset.value === String(value),
    );
    await click(option);
  }

  async function close() {
    await unmount();
    await server.close();
    dom.window.close();
    for (const [k, [existed, val]] of prev) {
      if (existed) globalThis[k] = val;
      else delete globalThis[k];
    }
  }

  return {
    dom,
    server,
    load,
    render,
    unmount,
    flush,
    waitFor,
    setInputValue,
    click,
    button,
    field,
    selectOption,
    close,
  };
}
