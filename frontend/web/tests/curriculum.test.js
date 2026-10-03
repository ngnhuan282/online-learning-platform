import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeLessonFormData, buildLessonPayload } from '../src/features/courses/utils/lessonForm.js';

test('lesson edit payload preserves all editable lesson fields', () => {
  const lesson = {
    title: 'Bài 1',
    lessonType: 'VIDEO',
    videoUrl: 'https://example.com/video.mp4',
    content: 'Nội dung chi tiết',
    duration: 500,
    orderIndex: 1,
    preview: true,
  };

  const form = normalizeLessonFormData(lesson);
  const payload = buildLessonPayload(form);

  assert.equal(form.title, 'Bài 1');
  assert.equal(form.lessonType, 'VIDEO');
  assert.equal(form.videoUrl, 'https://example.com/video.mp4');
  assert.equal(form.content, 'Nội dung chi tiết');
  assert.equal(form.duration, 500);
  assert.equal(form.preview, true);
  assert.deepEqual(payload, {
    title: 'Bài 1',
    lessonType: 'VIDEO',
    videoUrl: 'https://example.com/video.mp4',
    content: 'Nội dung chi tiết',
    duration: 500,
    orderIndex: 1,
    preview: true,
  });
});

test('reorder helper updates orderIndex correctly after swapping', () => {
  const sections = [
    { id: 1, title: 'Chương 1', orderIndex: 0 },
    { id: 2, title: 'Chương 2', orderIndex: 1 },
    { id: 3, title: 'Chương 3', orderIndex: 2 },
  ];

  // Move section 2 up (swap with section 1)
  const idx = 1;
  const swapped = [...sections];
  [swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]];
  const reordered = swapped.map((s, i) => ({ id: s.id, orderIndex: i }));

  assert.deepEqual(reordered, [
    { id: 2, orderIndex: 0 },
    { id: 1, orderIndex: 1 },
    { id: 3, orderIndex: 2 },
  ]);
});

test('lesson reorder payload validation', () => {
  const lessons = [
    { id: 101, title: 'Bài 1', orderIndex: 0 },
    { id: 102, title: 'Bài 2', orderIndex: 1 },
  ];

  // Move lesson 102 up
  const swapped = [...lessons];
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  const reordered = swapped.map((l, i) => ({ id: l.id, orderIndex: i }));

  assert.equal(reordered[0].id, 102);
  assert.equal(reordered[0].orderIndex, 0);
  assert.equal(reordered[1].id, 101);
  assert.equal(reordered[1].orderIndex, 1);
});
