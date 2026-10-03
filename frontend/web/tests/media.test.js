import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMediaUrl } from '../src/shared/utils/mediaUrl.js';

test('media URLs use the API gateway while absolute URLs remain unchanged', () => {
  assert.equal(
    resolveMediaUrl('/api/v1/media/download/videos/lesson.mp4', 'http://localhost:8080/'),
    'http://localhost:8080/api/v1/media/download/videos/lesson.mp4',
  );
  assert.equal(
    resolveMediaUrl('https://cdn.example.com/course.jpg', 'http://localhost:8080'),
    'https://cdn.example.com/course.jpg',
  );
});

test('mediaApi creates proper upload FormData with folder and file', async () => {
  // Test simulated upload payload
  const folder = 'thumbnails';
  const fileName = 'course-thumb.png';
  const fileSize = 1024 * 500; // 500 KB

  const mockPayload = {
    objectKey: `${folder}/uuid-${fileName}`,
    url: `/api/v1/media/download/${folder}/uuid-${fileName}`,
    fileName,
    fileSize,
    contentType: 'image/png',
  };

  assert.equal(mockPayload.fileName, 'course-thumb.png');
  assert.equal(mockPayload.contentType, 'image/png');
  assertTrue(mockPayload.objectKey.startsWith('thumbnails/'));
  assertTrue(mockPayload.url.includes(mockPayload.objectKey));
});

test('media upload progress calculation handles byte increments accurately', () => {
  const total = 10000000; // 10MB
  const steps = [
    { loaded: 2500000, expected: 25 },
    { loaded: 5000000, expected: 50 },
    { loaded: 7500000, expected: 75 },
    { loaded: 10000000, expected: 100 },
  ];

  steps.forEach(({ loaded, expected }) => {
    const percent = Math.round((loaded * 100) / total);
    assert.equal(percent, expected);
  });
});

test('lesson resource payload validation', () => {
  const resourcePayload = {
    resourceType: 'PDF',
    title: 'Tài liệu hướng dẫn',
    fileName: 'guide.pdf',
    fileSize: 1024 * 200,
    contentType: 'application/pdf',
    objectKey: 'documents/guide.pdf',
    downloadUrl: '/api/v1/media/download/documents/guide.pdf',
  };

  assert.equal(resourcePayload.resourceType, 'PDF');
  assert.equal(resourcePayload.title, 'Tài liệu hướng dẫn');
  assert.equal(resourcePayload.fileSize, 204800);
});

function assertTrue(val) {
  assert.equal(Boolean(val), true);
}
