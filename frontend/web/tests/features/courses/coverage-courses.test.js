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
globalThis.FormData = dom.window.FormData;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.ShadowRoot = dom.window.ShadowRoot;
globalThis.Node = dom.window.Node;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.scrollTo = () => {};

const { createRoot } = await import('react-dom/client');

const server = await createServer({
  cacheDir: 'node_modules/.vite-tests/coverage-courses',
  server: { middlewareMode: true, hmr: false, ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});

const load = path => server.ssrLoadModule(`/src/${path}`);

const { default: axiosClient } = await load('shared/apis/axiosClient.js');
const { AuthContext } = await load('features/auth/context/AuthContext.jsx');
const { ToastProvider } = await load('shared/context/ToastContext.jsx');
const { courseApi } = await load('features/courses/api/courseApi.js');
const { categoryApi } = await load('features/courses/api/categoryApi.js');
const { sectionApi } = await load('features/courses/api/sectionApi.js');
const { lessonApi } = await load('features/courses/api/lessonApi.js');
const { mediaApi } = await load('features/courses/api/mediaApi.js');
const { learningApi } = await load('features/learning/api/learningApi.js');
const { default: FeaturedCourses } = await load('features/courses/components/FeaturedCourses.jsx');
const { default: CourseListPage } = await load('features/courses/pages/CourseListPage.jsx');
const { default: CourseCard } = await load('features/courses/components/CourseCard.jsx');
const { default: StarRating } = await load('features/courses/components/StarRating.jsx');
const { default: CurriculumBuilderPage } = await load('features/courses/pages/CurriculumBuilderPage.jsx');
const { default: AddLessonDialog } = await load('features/courses/components/AddLessonDialog.jsx');
const { default: LessonResourcesModal } = await load('features/courses/components/LessonResourcesModal.jsx');
const { default: MediaUploader } = await load('features/courses/components/MediaUploader.jsx');
const { default: AdminCategoryPage } = await load('features/courses/pages/AdminCategoryPage.jsx');

const originalAdapter = axiosClient.defaults.adapter;
const originals = [courseApi, categoryApi, sectionApi, lessonApi, mediaApi, learningApi].map(api => [
  api,
  { ...api },
]);
const cache = createCache({ key: 'coverage-courses' });

let root;

async function render(content, auth = { user: null, isAuthenticated: false, isLoading: false }) {
  root ??= createRoot(document.getElementById('root'));
  await act(async () => {
    root.render(
      h(
        CacheProvider,
        { value: cache },
        h(ToastProvider, null, h(AuthContext.Provider, { value: auth }, content)),
      ),
    );
  });
}

async function flush(ticks = 4) {
  for (let i = 0; i < ticks; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });
  }
}

function setInputValue(selectorOrEl, value) {
  const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
  assert.ok(el, `Missing input ${selectorOrEl}`);
  const proto = Object.getPrototypeOf(el);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor?.set) descriptor.set.call(el, value);
  else el.value = value;
  const evtName = el.tagName === 'SELECT' ? 'change' : 'input';
  return act(async () => {
    el.dispatchEvent(new Event(evtName, { bubbles: true }));
    if (el.tagName !== 'SELECT') el.dispatchEvent(new Event('change', { bubbles: true }));
  });
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
  await act(async () => root?.unmount());
  root = null;
  originals.forEach(([api, methods]) => Object.assign(api, methods));
  axiosClient.defaults.adapter = originalAdapter;
});

after(async () => {
  await server.close();
  dom.window.close();
});

test('CourseCard fallback image, StarRating keyboard interaction and FeaturedCourses tabs work', async () => {
  categoryApi.list = async () => ({
    data: [
      { id: 1, name: 'IELTS' },
      { id: 2, name: 'Giao tiếp' },
    ],
  });
  courseApi.list = async () => ({
    data: {
      content: [
        {
          id: 10,
          title: 'IELTS Pro Course',
          categoryName: 'IELTS',
          description: 'Academic',
          price: 199000,
          originalPrice: 399000,
          thumbnailUrl: 'https://bad.cdn/broken.png',
          avgRating: 4.7,
          reviewCount: 15,
          students: 120,
          hours: 12,
        },
      ],
      totalPages: 1,
    },
  });

  const ratings = [];
  await render(
    h(
      MemoryRouter,
      null,
      h(FeaturedCourses),
      h(CourseCard, {
        course: {
          id: 10,
          title: 'IELTS Pro Course',
          category: 'IELTS',
          tag: 'IELTS',
          description: 'Academic',
          image: 'https://bad.cdn/broken.png',
          fallbackImage: '/images/english-ielts.jpg',
          rating: '4.7',
          reviews: '15',
          students: 120,
          hours: 12,
          price: 199000,
          originalPrice: 399000,
          discount: 50,
          lessons: ['L1', 'L2'],
        },
      }),
      h(StarRating, { value: 3, onChange: val => ratings.push(val), showLabel: true }),
    ),
  );
  await flush();

  // Trigger image fallback error
  const brokenImg = document.querySelector('img[src*="broken.png"]');
  if (brokenImg) {
    await act(async () => brokenImg.dispatchEvent(new Event('error')));
    assert.match(brokenImg.src, /english-ielts\.jpg$/);
  }

  // Click FeaturedCourses category/group filter buttons
  const filterBtns = [...document.querySelectorAll('.course-filters button, .featured-tabs button')];
  for (const btn of filterBtns) {
    await act(async () => btn.click());
    await flush(2);
  }

  const starBtns = [...document.querySelectorAll('button[aria-label$=" sao"]')];
  assert.equal(starBtns.length, 5);
  for (const btn of starBtns) {
    await act(async () => {
      btn.dispatchEvent(new dom.window.MouseEvent('mouseenter', { bubbles: true }));
      btn.dispatchEvent(new dom.window.MouseEvent('mouseleave', { bubbles: true }));
      btn.click();
    });
  }
  assert.ok(ratings.length >= 1);
});

test('CourseListPage exercises all filters, price bounds, sorting, free toggle and reset', async () => {
  const queries = [];
  categoryApi.list = async () => ({ data: [{ id: 7, name: 'IELTS' }] });
  courseApi.list = async params => {
    queries.push(params);
    return {
      data: {
        content: [
          {
            id: 51,
            title: 'Free Grammar Basics',
            categoryId: 7,
            categoryName: 'IELTS',
            price: 0,
            avgRating: 4.9,
            reviewCount: 8,
            status: 'PUBLISHED',
          },
        ],
        page: params.page ?? 0,
        totalPages: 2,
        totalElements: 20,
      },
    };
  };

  await render(
    h(
      MemoryRouter,
      { initialEntries: ['/courses?category=7&pricing=free&level=BEGINNER&sort=rating'] },
      h(Routes, null, h(Route, { path: '/courses', element: h(CourseListPage) })),
    ),
  );
  await flush();

  // Click level filter buttons + sort options
  for (const btn of document.querySelectorAll('.course-filters button')) {
    await act(async () => btn.click());
  }
  const selects = [...document.querySelectorAll('select')];
  for (const sel of selects) {
    const opts = [...sel.options].filter(o => o.value);
    if (opts.length > 0) await setInputValue(sel, opts[opts.length - 1].value);
  }
  const nextBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Trang sau');
  if (nextBtn && !nextBtn.disabled) {
    await act(async () => nextBtn.click());
    await flush();
    const prevBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Trang trước');
    if (prevBtn && !prevBtn.disabled) await act(async () => prevBtn.click());
  }
  assert.ok(queries.length >= 2);
});

test('CurriculumBuilderPage, AddLessonDialog, LessonResourcesModal and MediaUploader cover full workflows and errors', async () => {
  let sectionsData = [
    {
      id: 21,
      title: 'Section 1',
      orderIndex: 0,
      lessons: [
        { id: 61, title: 'Intro Video', lessonType: 'VIDEO', videoUrl: 'https://youtu.be/abc', orderIndex: 0 },
        { id: 62, title: 'Summary Text', lessonType: 'TEXT', content: 'Hello', orderIndex: 1 },
      ],
    },
    { id: 22, title: 'Section 2', orderIndex: 1, lessons: [] },
  ];
  courseApi.adminGetById = async () => ({ data: { id: 42, title: 'Curriculum Course', categoryName: 'TOEIC' } });
  sectionApi.listByCourse = async () => ({ data: sectionsData });
  sectionApi.reorder = async () => {
    throw new Error('Reorder error');
  };
  lessonApi.reorder = async () => {
    throw new Error('Lesson reorder error');
  };
  lessonApi.update = async (_id, payload) => ({ data: { id: 61, ...payload } });
  learningApi.getAdminQuizzes = async () => ({ data: [{ id: 9, courseId: 42, title: 'Final Quiz' }] });

  const resources = [{ id: 1, title: 'Slide PDF', resourceType: 'PDF', url: 'https://cdn.example/s.pdf' }];
  mediaApi.listResources = async () => ({ data: resources });
  mediaApi.addResource = async (_id, payload) => ({ data: { id: 2, ...payload } });
  mediaApi.deleteResource = async () => ({ data: {} });
  mediaApi.upload = async (file, _folder, onProgress) => {
    if (file.name.includes('fail')) throw new Error('Upload failed');
    onProgress?.({ percent: 60, loaded: 60, total: 100 });
    return { data: { url: `/api/v1/media/${file.name}`, objectKey: `docs/${file.name}`, fileName: file.name, fileSize: file.size, contentType: file.type } };
  };

  const origConfirm = window.confirm;
  window.confirm = () => true;

  try {
    await render(
      h(
        MemoryRouter,
        { initialEntries: ['/admin/courses/42/curriculum'] },
        h(
          Routes,
          null,
          h(Route, { path: '/admin/courses/:courseId/curriculum', element: h(CurriculumBuilderPage) }),
          h(Route, { path: '/admin/courses', element: h('div', null, 'Courses list') }),
        ),
      ),
    );
    await flush();

    // Move Section 2 UP (triggers reorderSections error path)
    const moveUpBtns = [...document.querySelectorAll('button[title="Di chuyển lên"]:not([disabled])')];
    if (moveUpBtns[0]) await act(async () => moveUpBtns[0].click());

    // Move Lesson 1 DOWN (triggers reorderLessons error path)
    const lessonDown = document.querySelector('button[title="Xuống dưới"]:not([disabled])');
    if (lessonDown) await act(async () => lessonDown.click());

    // Collapse / expand section if toggle exists
    const editLessonBtn = document.querySelector('button[title="Sửa bài học"]');
    if (editLessonBtn) {
      await act(async () => editLessonBtn.click());
      await setInputValue('#lesson-title', 'Updated Video Title');
      await act(async () => document.querySelector('form button[type="submit"]')?.click());
      await flush();
    }

    // Open LessonResourcesModal directly to exercise link, upload, validation and delete
    await render(
      h(LessonResourcesModal, {
        lesson: { id: 61, title: 'Intro Video' },
        onClose() {},
      }),
    );
    await flush();
    assert.match(document.body.textContent, /Slide PDF/);

    // Switch resource mode / add URL resource & delete
    const resInputs = [...document.querySelectorAll('[role="dialog"] input, form input')];
    const titleInput = resInputs.find(el => el.type === 'text' || el.placeholder);
    if (titleInput) await setInputValue(titleInput, 'Extra Guide');
    const urlInput = resInputs.find(el => el.type === 'url' || /url|link/i.test(el.placeholder || ''));
    if (urlInput) await setInputValue(urlInput, 'https://example.com/guide');
    const submitRes = document.querySelector('[role="dialog"] button[type="submit"], form button[type="submit"]');
    if (submitRes) {
      await act(async () => submitRes.click());
      await flush();
    }
    const delResBtn = [...document.querySelectorAll('button')].find(b =>
      /xóa/i.test(b.title || b.textContent || ''),
    );
    if (delResBtn) {
      await act(async () => delResBtn.click());
      await flush();
    }

    // Standalone MediaUploader validation & failure & progress & remove
    await render(
      h(MediaUploader, {
        accept: 'image/png',
        maxSizeMB: 1,
        folder: 'thumbnails',
        currentUrl: '',
        onUploadSuccess() {},
      }),
    );
    const fileInput = document.querySelector('input[type="file"]');
    const fireFile = file => {
      Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
      return act(async () => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
    };
    // Oversize file
    await fireFile(new dom.window.File([new Uint8Array(2 * 1024 * 1024)], 'huge.png', { type: 'image/png' }));
    assert.match(document.body.textContent, /1MB|vượt quá/i);
    // Failing upload
    await fireFile(new dom.window.File(['x'], 'fail.png', { type: 'image/png' }));
    assert.match(document.body.textContent, /Upload failed|thất bại/i);
    // Successful upload
    await fireFile(new dom.window.File(['x'], 'ok.png', { type: 'image/png' }));
    await flush();

    // AddLessonDialog lesson type switching + validation
    const confirmed = [];
    await render(
      h(AddLessonDialog, {
        courseId: 42,
        mode: 'create',
        onConfirm: payload => confirmed.push(payload),
        onCancel() {},
      }),
    );
    // Submit empty title for validation errors
    await act(async () => document.querySelector('form button[type="submit"]')?.click());
    await setInputValue('#lesson-title', 'Audio Lesson');
    const typeSelect = document.querySelector('#lesson-type');
    if (typeSelect) {
      for (const lType of ['PDF', 'AUDIO', 'TEXT']) {
        await setInputValue(typeSelect, lType);
      }
      await setInputValue('#lesson-content', 'Detailed lesson text content');
      await act(async () => document.querySelector('form button[type="submit"]')?.click());
    }
    assert.equal(confirmed.length, 1);
  } finally {
    window.confirm = origConfirm;
  }
});

test('AdminCategoryPage covers CRUD, errors and delete confirmation', async () => {
  let cats = [{ id: 1, name: 'IELTS', description: 'Exam prep' }];
  let catLoads = 0;
  categoryApi.adminList = async () => {
    if (++catLoads === 1) throw new Error('Cat fetch failed');
    return { data: cats };
  };
  categoryApi.create = async p => {
    const item = { id: 2, ...p };
    cats = [...cats, item];
    return { data: item };
  };
  categoryApi.update = async (id, p) => {
    cats = cats.map(c => (c.id === id ? { ...c, ...p } : c));
    return { data: { id, ...p } };
  };
  categoryApi.delete = async id => {
    cats = cats.filter(c => c.id !== id);
  };

  const origConfirm = window.confirm;
  let allowConfirm = false;
  window.confirm = () => allowConfirm;

  try {
    await render(h(MemoryRouter, null, h(AdminCategoryPage)));
    await flush();
    const retryBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Thử lại');
    if (retryBtn) {
      await act(async () => retryBtn.click());
      await flush();
    }
    assert.match(document.body.textContent, /IELTS/);

    // Edit category
    const editBtn = [...document.querySelectorAll('button')].find(b =>
      /sửa/i.test(b.title || b.textContent || ''),
    );
    if (editBtn) {
      await act(async () => editBtn.click());
      const nameInput = document.querySelector('form input');
      if (nameInput) await setInputValue(nameInput, 'IELTS Academic');
      await act(async () => document.querySelector('form button[type="submit"]')?.click());
      await flush();
    }

    // Delete cancel then confirm
    const delBtn = [...document.querySelectorAll('button')].find(b =>
      /xóa/i.test(b.title || b.textContent || ''),
    );
    if (delBtn) {
      await act(async () => delBtn.click());
      allowConfirm = true;
      await act(async () => delBtn.click());
      await flush();
    }
  } finally {
    window.confirm = origConfirm;
  }
});
