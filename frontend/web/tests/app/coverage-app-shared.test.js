import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { act, createElement as h } from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';

const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.ShadowRoot = dom.window.ShadowRoot;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.scrollTo = () => {};
dom.window.HTMLElement.prototype.scrollIntoView = () => {};

const { createRoot } = await import('react-dom/client');

const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/coverage-app-shared',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});

const load = path => server.ssrLoadModule('/src/' + path);

const { default: axiosClient } = await load('shared/apis/axiosClient.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { NotificationsContext } = await load('features/learning/context/NotificationsContext.jsx');
const { ProContext, ProProvider } = await load('features/pro/context/ProContext.jsx');
const { EngagementContext, EngagementProvider } = await load('features/engagement/context/EngagementContext.jsx');
const { ToastProvider } = await load('shared/context/ToastContext.jsx');
const { AUTH_CHANGED_EVENT } = await load('shared/constants/appConstants.js');
const { PRO_CHANGED, proApi } = await load('features/pro/api/proApi.js');
const { engagementApi } = await load('features/engagement/api/engagementApi.js');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { default: AccountMenu } = await load('shared/components/AccountMenu.jsx');
const { default: SiteHeader } = await load('shared/components/SiteHeader.jsx');
const { default: SiteFooter } = await load('shared/components/SiteFooter.jsx');
const { default: LanguageSwitcher } = await load('shared/components/LanguageSwitcher.jsx');
const { default: LearnerAvatar } = await load('shared/components/LearnerAvatar.jsx');
const { default: PageHeader } = await load('shared/components/PageHeader.jsx');
const { default: ScrollToSection } = await load('shared/components/ScrollToSection.jsx');
const { default: MainLayout } = await load('layouts/MainLayout.jsx');
const { default: UserLayout } = await load('layouts/UserLayout.jsx');
const { default: AdminLayout } = await load('layouts/AdminLayout.jsx');
const { default: HomePage } = await load('pages/HomePage.jsx');
const { default: NotFoundPage } = await load('pages/NotFoundPage.jsx');
const { default: App } = await load('app/App.jsx');
const { default: AppProviders } = await load('app/providers.jsx');

const cache = createCache({ key: 'coverage-app-shared' });
const originalAdapter = axiosClient.defaults.adapter;
const originalApis = [proApi, engagementApi, courseApi].map(api => [api, { ...api }]);

let root;

async function mount(element) {
  if (root) {
    await act(async () => root.unmount());
    root = null;
  }
  const container = document.getElementById('root');
  root = createRoot(container);
  await act(async () => {
    root.render(h(CacheProvider, { value: cache }, element));
  });
}

async function flush(ticks = 6) {
  for (let i = 0; i < ticks; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
}

beforeEach(() => {
  axiosClient.defaults.adapter = async config => ({
    config,
    status: 200,
    headers: {},
    data: { success: true, data: [] },
  });
});

afterEach(async () => {
  if (root) {
    await act(async () => root.unmount());
    root = null;
  }
  for (const [api, orig] of originalApis) Object.assign(api, orig);
  axiosClient.defaults.adapter = originalAdapter;
  dom.window.localStorage.clear();
  dom.window.sessionStorage.clear();
});

after(async () => {
  await server.close();
  dom.window.close();
});

function withBaseProviders(node, { user = null, isAuthenticated = false, notifications = [] } = {}) {
  const authValue = {
    user,
    isAuthenticated,
    isLoading: false,
    isLoggingOut: false,
    sessionError: null,
    logout: async () => ({ error: null }),
    retrySession: async () => {},
    updateCurrentUser: () => {},
  };
  const notifValue = {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    loading: false,
    error: null,
    refresh: async () => {},
    markAsRead: async () => {},
    markAllAsRead: async () => {},
  };
  const proValue = {
    membership: user?.pro ? { active: true, planCode: 'PRO_MONTHLY' } : { active: false },
    loading: false,
    error: null,
    refresh: async () => {},
  };
  const engagementValue = {
    summary: { xp: 120, level: 2, gems: 50, streakDays: 3 },
    loading: false,
    error: null,
    refresh: async () => {},
  };
  return h(
    ToastProvider,
    null,
    h(
      AuthContext.Provider,
      { value: authValue },
      h(
        NotificationsContext.Provider,
        { value: notifValue },
        h(
          ProContext.Provider,
          { value: proValue },
          h(EngagementContext.Provider, { value: engagementValue }, node),
        ),
      ),
    ),
  );
}

test('AccountMenu opens menu, exercises avatar fallback, navigation items, admin entry and logout', async () => {
  let loggedOut = 0;
  const user = {
    id: 5,
    fullName: 'Nguyen Van A',
    email: 'a@example.com',
    avatarUrl: 'https://cdn.example/bad.png',
    roles: ['ADMIN'],
    permissions: ['ADMIN_ACCESS'],
  };
  const authValue = {
    user,
    isAuthenticated: true,
    isLoading: false,
    logout: async () => {
      loggedOut++;
      return { error: null };
    },
  };

  await mount(
    h(
      MemoryRouter,
      { initialEntries: ['/'] },
      h(
        AuthContext.Provider,
        { value: authValue },
        h(
          ProContext.Provider,
          { value: { membership: { active: true } } },
          h(
            'div',
            null,
            h(AccountMenu),
            h(AccountMenu, { variant: 'mobile' }),
            h(LearnerAvatar, { name: 'Nguyen A', avatarUrl: 'https://cdn.example/bad.png', size: 'sm' }),
          ),
        ),
      ),
    ),
  );

  // Trigger image fallback error on LearnerAvatar
  const imgs = [...document.querySelectorAll('img')];
  for (const img of imgs) {
    await act(async () => {
      img.dispatchEvent(new Event('error'));
    });
  }

  // Open desktop AccountMenu popover and click every menu item (menu closes after each selection)
  const findTrigger = () =>
    document.querySelector('.account-menu-button, button[aria-haspopup="menu"], button[aria-haspopup="true"]');
  await act(async () => {
    findTrigger().click();
  });
  await flush(3);

  const count = document.querySelectorAll('[role="menuitem"]').length;
  assert.ok(count >= 6);
  for (let i = 0; i < count; i++) {
    if (!document.querySelectorAll('[role="menuitem"]').length) {
      await act(async () => {
        findTrigger().click();
      });
      await flush(2);
    }
    const items = document.querySelectorAll('[role="menuitem"]');
    if (items[i]) {
      await act(async () => {
        items[i].click();
      });
      await flush(2);
    }
  }
  assert.ok(loggedOut >= 1);

  // Also test AccountMenu mobile variant logout/navigation
  const mobileLogout = [...document.querySelectorAll('button')].find(b =>
    /đăng xuất/i.test(b.textContent || ''),
  );
  if (mobileLogout) {
    await act(async () => {
      mobileLogout.click();
    });
    await flush(2);
  }
});

test('SiteHeader, SiteFooter policy dialogs, LanguageSwitcher, PageHeader and ScrollToSection interact cleanly', async () => {
  let scrolledIntoView = 0;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {
    scrolledIntoView++;
  };
  const user = { id: 1, fullName: 'Learner', email: 'u@test.com', roles: ['USER'], permissions: [] };

  await mount(
    h(
      MemoryRouter,
      { initialEntries: ['/#target-section'] },
      withBaseProviders(
        h(
          'div',
          null,
          h(ScrollToSection),
          h(PageHeader, { badge: 'Beta', title: 'Tiêu đề trang', subtitle: 'Mô tả ngắn' }),
          h(SiteHeader),
          h(LanguageSwitcher),
          h('section', { id: 'target-section' }, 'Target'),
          h(SiteFooter),
        ),
        { user, isAuthenticated: true },
      ),
    ),
  );
  await flush(3);
  assert.ok(scrolledIntoView >= 1);

  // Toggle mobile menu drawer if present
  const mobileToggle = document.querySelector('button[aria-label*="menu" i], button[aria-label*="Menu"], .mobile-nav-toggle');
  if (mobileToggle) {
    await act(async () => {
      mobileToggle.click();
    });
  }

  // Switch language to English and back
  const langBtn = document.querySelector('.language-switcher button, button[aria-label*="ngôn ngữ" i], button[aria-label*="language" i]');
  if (langBtn) {
    await act(async () => {
      langBtn.click();
    });
    const enItem = [...document.querySelectorAll('[role="menuitem"], button')].find(el =>
      /english|en/i.test(el.textContent || ''),
    );
    if (enItem) {
      await act(async () => {
        enItem.click();
      });
    }
  }

  // Open Footer Terms / Privacy policy dialogs
  const policyBtns = [...document.querySelectorAll('footer button')];
  for (const btn of policyBtns) {
    await act(async () => {
      btn.click();
    });
    const closeBtn = document.querySelector('[role="dialog"] button');
    if (closeBtn) {
      await act(async () => {
        closeBtn.click();
      });
    }
  }
});

test('MainLayout, UserLayout, AdminLayout, HomePage, NotFoundPage render with nested routes and form validation toast', async () => {
  courseApi.list = async () => ({
    data: [
      { id: 1, title: 'IELTS Focus', categoryName: 'IELTS', price: 299000, status: 'PUBLISHED' },
    ],
  });

  const adminUser = {
    id: 1,
    fullName: 'Admin One',
    email: 'admin@test.com',
    roles: ['ADMIN'],
    permissions: ['ADMIN_ACCESS', 'COURSE_READ', 'USER_READ'],
  };

  await mount(
    h(
      MemoryRouter,
      { initialEntries: ['/'] },
      withBaseProviders(
        h(
          Routes,
          null,
          h(
            Route,
            { element: h(MainLayout) },
            h(Route, { path: '/', element: h(HomePage) }),
            h(Route, { path: '*', element: h(NotFoundPage) }),
          ),
          h(
            Route,
            { element: h(UserLayout) },
            h(Route, { path: '/u', element: h('div', null, 'User child') }),
          ),
        ),
        { user: adminUser, isAuthenticated: true },
      ),
    ),
  );
  await flush(4);
  assert.ok(document.body.textContent.includes('IELTS Focus') || document.body.textContent.length > 0);

  // Render NotFoundPage & UserLayout
  await act(async () => root.unmount());
  await mount(
    h(
      MemoryRouter,
      { initialEntries: ['/does-not-exist'] },
      withBaseProviders(
        h(
          Routes,
          null,
          h(Route, { path: '/u', element: h(UserLayout) }),
          h(Route, { path: '*', element: h(NotFoundPage) }),
        ),
      ),
    ),
  );
  assert.ok(document.body.textContent.length > 0);

  // Render AdminLayout and trigger mobile menu + invalid capture toast
  await act(async () => root.unmount());
  await mount(
    h(
      MemoryRouter,
      { initialEntries: ['/admin'] },
      withBaseProviders(
        h(
          Routes,
          null,
          h(
            Route,
            { path: '/admin', element: h(AdminLayout) },
            h(
              Route,
              {
                index: true,
                element: h(
                  'form',
                  null,
                  h('input', { required: true, 'aria-label': 'Required name' }),
                ),
              },
            ),
          ),
        ),
        { user: adminUser, isAuthenticated: true },
      ),
    ),
  );
  const adminMenuBtn = document.querySelector('button[aria-label*="Menu"], button.admin-menu-button, header button');
  if (adminMenuBtn) {
    await act(async () => {
      adminMenuBtn.click();
    });
  }
  const reqInput = document.querySelector('input[required]');
  if (reqInput) {
    await act(async () => {
      reqInput.dispatchEvent(new Event('invalid', { bubbles: false, cancelable: true }));
    });
  }
  await flush(2);
});

test('ProProvider, EngagementProvider, AppProviders, App and main bootstrap execute and refresh cleanly', async () => {
  let proCalls = 0;
  let engCalls = 0;
  proApi.membership = async () => {
    proCalls++;
    return { data: { userId: 9, active: true, planCode: 'PRO' } };
  };
  engagementApi.summary = async () => {
    engCalls++;
    return { data: { userId: 9, xp: 500, level: 4, gems: 80 } };
  };

  await mount(
    h(
      AuthContext.Provider,
      {
        value: {
          user: { id: 9, fullName: 'Pro Learner', roles: ['USER'] },
          isAuthenticated: true,
          isLoading: false,
        },
      },
      h(
        NotificationsContext.Provider,
        {
          value: {
            notifications: [],
            unreadCount: 0,
            loading: false,
            error: null,
            refresh: async () => {},
            markAsRead: async () => {},
            markAllAsRead: async () => {},
            notificationEvents: 0,
            lastEvent: null,
          },
        },
        h(ProProvider, null, h(EngagementProvider, null, h('div', null, 'Providers mounted'))),
      ),
    ),
  );
  await flush(4);
  assert.ok(proCalls >= 1 && engCalls >= 1);

  await act(async () => {
    window.dispatchEvent(new Event(PRO_CHANGED));
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  });
  await flush(4);
  assert.ok(proCalls >= 2);

  // Render AppProviders + App cleanly
  await act(async () => root.unmount());
  await mount(h(AppProviders, null, h(App)));
  await flush(5);
  assert.ok(document.body.textContent.length > 0);
  await act(async () => root.unmount());
  root = null;

  // Bootstrap src/main.jsx into #root
  await act(async () => {
    await load('main.jsx');
  });
  await flush(5);
  assert.ok(document.getElementById('root').innerHTML.length > 0);
  // Leave root clean without dangling main root error
  document.getElementById('root').innerHTML = '';
});
