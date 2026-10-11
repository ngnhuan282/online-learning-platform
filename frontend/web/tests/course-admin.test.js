import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'vite';

process.env.VITE_API_URL = 'http://gateway.test';
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});

const load = path => server.ssrLoadModule(`/src/${path}`);

test('admin course helpers normalize paginated and nested API payloads without falling back to demo data', async () => {
  const mod = await load('features/courses/utils/courseForm.js');
  const list = mod.normalizeCourseList({
    success: true,
    data: {
      content: [
        {
          id: 42,
          title: 'Spring Boot Advanced',
          description: 'Nâng cao',
          categoryId: 7,
          categoryName: 'Java',
          price: 299000,
          originalPrice: 399000,
          level: 'advanced',
          status: 'PUBLISHED',
          thumbnailUrl: '/images/java.jpg',
        },
      ],
    },
  });

  assert.equal(list.length, 1);
  assert.equal(list[0].title, 'Spring Boot Advanced');
  assert.equal(list[0].categoryName, 'Java');
  assert.equal(list[0].price, 299000);
  assert.deepEqual(mod.normalizeCourseList({ data: { content: [] } }), []);
  assert.deepEqual(
    mod.normalizeCoursePayload({ categoryId: '7', level: 'beginner', status: 'published', price: '299000' }),
    {
      categoryId: 7,
      level: 'BEGINNER',
      status: 'PUBLISHED',
      price: 299000,
      originalPrice: 0,
      thumbnailUrl: '/images/english-ielts.jpg',
      title: undefined,
      description: undefined,
    },
  );
  await server.close();
});
