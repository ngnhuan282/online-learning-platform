import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { prepareToeicRelease } from '../scripts/prepare-toeic-assets.mjs';

const media = prepareToeicRelease({ optional: true });

const seedUrl = new URL(
  '../../../backend/learning-service/src/main/resources/toeic/ets2024-reading.json',
  import.meta.url,
);
const content = () => JSON.parse(readFileSync(seedUrl, 'utf8'));

test('the source collection contains ten Reading tests and four substantial native lessons per test', () => {
  const exams = content();
  assert.equal(exams.length, 10);
  assert.equal(new Set(exams.map(exam => exam.slug)).size, 10);
  assert.equal(new Set(exams.map(exam => exam.seedKey)).size, 10);
  for (const exam of exams) {
    assert.equal(exam.durationMinutes, 75);
    assert.equal(exam.published, true);
    assert.equal(exam.lessons.length, 4, exam.slug);
    assert.equal(new Set(exam.lessons.map(lesson => lesson.id)).size, 4);
    for (const lesson of exam.lessons) {
      assert.ok(lesson.title.trim().length > 0);
      assert.ok(lesson.content.trim().length >= 400, `${exam.slug}: ${lesson.id} must teach real content`);
      assert.doesNotMatch(lesson.content, /<iframe|<object|<embed/i);
    }
  }
});

test('every source question is answerable, has four choices and retains a source reference', () => {
  for (const exam of content()) {
    assert.deepEqual(
      exam.questions.map(question => question.number),
      Array.from({ length: 100 }, (_, i) => i + 101),
    );
    assert.equal(new Set(exam.questions.map(question => question.id)).size, 100);
    assert.deepEqual(
      [5, 6, 7].map(part => exam.questions.filter(question => question.part === part).length),
      [30, 16, 54],
    );
    for (const question of exam.questions) {
      const label = `${exam.slug}: ${question.number}`;
      assert.deepEqual(
        question.options.map(option => option.id),
        ['A', 'B', 'C', 'D'],
        label,
      );
      assert.ok(
        question.options.every(option => typeof option.text === 'string' && option.text.trim()),
        label,
      );
      assert.ok(['A', 'B', 'C', 'D'].includes(question.correctOptionId), label);
      assert.ok(question.prompt?.trim() || question.imageUrl, label);
      assert.ok(question.explanation?.trim().length >= 30, `${label}: explanation`);
      assert.ok(question.source?.trim(), `${label}: provenance`);
      if (question.part !== 5)
        assert.ok(
          question.passage?.trim() || question.passageImageUrls?.length,
          `${label}: missing reading passage`,
        );
      for (const image of [question.imageUrl, ...(question.passageImageUrls ?? [])].filter(Boolean)) {
        assert.match(image, /^\/toeic-assets\/[\w/.-]+\.(?:png|jpe?g|webp)$/);
        assert.equal(image.includes('..'), false);
        if (media) assert.equal(existsSync(new URL(`../public${image}`, import.meta.url)), true, image);
      }
    }
  }
});

test('known source questions retain the official keys, including the corrected Test 8 header mapping', () => {
  const exams = content();
  const key = (testNumber, questionNumber) =>
    exams[testNumber - 1].questions.find(question => question.number === questionNumber);
  assert.equal(key(1, 101).correctOptionId, 'B');
  assert.match(key(1, 101).prompt, /Sendai|Nakata/i);
  assert.notEqual(key(8, 194).explanation, key(8, 195).explanation);
  assert.notEqual(key(8, 195).explanation, key(8, 196).explanation);
});

test('nine Listening seeds provide all 900 questions, aligned recordings, transcripts and illustrations', () => {
  const exams = JSON.parse(readFileSync(new URL('ets2024-listening.json', seedUrl), 'utf8'));
  assert.equal(exams.length, 9);
  assert.equal(new Set(exams.map(exam => exam.seedKey)).size, 9);
  const groups = new Map();
  const assetFiles = new Set();
  for (const exam of exams) {
    assert.match(exam.slug, /^ets-2024-test-(?:0[1235-9]|10)-listening$/);
    assert.equal(exam.published, true);
    assert.equal(exam.durationMinutes, 45);
    assert.equal(exam.questions.length, 100);
    const counts = [0, 0, 0, 0];
    for (const [index, question] of exam.questions.entries()) {
      const number = index + 1;
      const part = number <= 6 ? 1 : number <= 31 ? 2 : number <= 70 ? 3 : 4;
      const choiceIds = part === 2 ? ['A', 'B', 'C'] : ['A', 'B', 'C', 'D'];
      const label = `${exam.slug}: ${number}`;
      assert.equal(question.number, number, label);
      assert.equal(question.part, part, label);
      counts[part - 1]++;
      assert.deepEqual(
        question.options.map(option => option.id),
        choiceIds,
        label,
      );
      assert.ok(choiceIds.includes(question.correctOptionId), label);
      if (part === 1) assert.match(question.imageUrl, /question-00[1-6]\.webp$/);
      if (part >= 3) {
        assert.ok(question.prompt.endsWith('?'), label);
        assert.ok(
          question.options.every(option => option.text.trim()),
          label,
        );
      }
      const { audioUrl, transcript } = question.listening;
      const first = number < 32 ? number : number - ((number - 32) % 3);
      const fileNumber = n => String(n).padStart(3, '0');
      const range = part <= 2 ? fileNumber(first) : `${fileNumber(first)}-${fileNumber(first + 2)}`;
      assert.ok(audioUrl.endsWith(`/test${exam.slug.slice(14, 16)}/audio-${range}.mp3`), label);
      assert.ok(transcript.trim().length > 40, label);
      assert.equal(groups.get(audioUrl) ?? transcript, transcript, label);
      groups.set(audioUrl, transcript);
      for (const file of [audioUrl, question.imageUrl, ...(question.passageImageUrls ?? [])].filter(
        Boolean,
      )) {
        if (media) assert.equal(existsSync(new URL(`../public${file}`, import.meta.url)), true, file);
        assetFiles.add(file);
      }
    }
    assert.deepEqual(counts, [6, 25, 39, 30]);
  }
  assert.equal(groups.size, 486);
  assert.equal(assetFiles.size, 585);
});

test(
  'the external release supplies all Reading and Listening media',
  { skip: !media && 'TOEIC archives not supplied' },
  () => {
    assert.deepEqual([media.reading.archives, media.reading.images], [10, 1220]);
    assert.deepEqual([media.listening.archives, media.listening.files], [9, 585]);
  },
);
