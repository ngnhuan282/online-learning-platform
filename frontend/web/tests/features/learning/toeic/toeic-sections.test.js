import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatToeicSourceLabel,
  formatToeicTitle,
  normalizeToeicLibraryExams,
} from '../../../../src/features/learning/utils/toeicSections.js';

const listeningExam = (id, num) => {
  const padded = String(num).padStart(2, '0');
  return {
    id,
    section: 'LISTENING',
    title: `ETS 2024 — Test ${padded} · Listening`,
    sourceLabel: `ETS 2024 Listening · Test ${padded}`,
  };
};

test('shifts ETS 2024 Listening display numbers continuously when Test 04 is missing', () => {
  const raw = [
    { id: 1, section: 'READING', title: 'ETS 2024 — Test 05', sourceLabel: 'ETS 2024 Reading · Test 5' },
    listeningExam(11, 1),
    listeningExam(12, 2),
    listeningExam(13, 3),
    listeningExam(14, 5),
    listeningExam(15, 6),
    listeningExam(19, 10),
    {
      id: 910011,
      section: 'LISTENING',
      title: 'TOEIC Listening Mini 11 · Part 1 Photo Descriptions',
      sourceLabel: 'ChitChatGo TOEIC Practice · Set 11',
    },
  ];

  const normalized = normalizeToeicLibraryExams(raw);

  assert.equal(normalized[0].title, 'ETS 2024 — Test 05');
  assert.deepEqual(
    normalized.slice(1, 7).map(item => item.title),
    [
      'ETS 2024 — Test 01 · Listening',
      'ETS 2024 — Test 02 · Listening',
      'ETS 2024 — Test 03 · Listening',
      'ETS 2024 — Test 04 · Listening',
      'ETS 2024 — Test 05 · Listening',
      'ETS 2024 — Test 09 · Listening',
    ],
  );
  assert.deepEqual(
    normalized.slice(1, 7).map(item => item.sourceLabel),
    [
      'ETS 2024 Listening · Test 01',
      'ETS 2024 Listening · Test 02',
      'ETS 2024 Listening · Test 03',
      'ETS 2024 Listening · Test 04',
      'ETS 2024 Listening · Test 05',
      'ETS 2024 Listening · Test 09',
    ],
  );
  assert.equal(normalized[7].title, 'TOEIC Listening Mini 11 · Part 1 Photo Descriptions');
  assert.equal(formatToeicTitle('ETS 2024 — Test 05 · Listening'), 'ETS 2024 — Test 04 · Listening');
  assert.equal(formatToeicSourceLabel('ETS 2024 Listening · Test 10'), 'ETS 2024 Listening · Test 09');
});

test('preserves original ETS 2024 Listening numbers when Test 04 exists in catalogue', () => {
  const raw = [
    listeningExam(11, 1),
    listeningExam(12, 2),
    listeningExam(13, 3),
    listeningExam(14, 4),
    listeningExam(15, 5),
  ];

  const normalized = normalizeToeicLibraryExams(raw);

  assert.deepEqual(
    normalized.map(item => item.title),
    [
      'ETS 2024 — Test 01 · Listening',
      'ETS 2024 — Test 02 · Listening',
      'ETS 2024 — Test 03 · Listening',
      'ETS 2024 — Test 04 · Listening',
      'ETS 2024 — Test 05 · Listening',
    ],
  );
  assert.equal(formatToeicTitle('ETS 2024 — Test 05 · Listening'), 'ETS 2024 — Test 05 · Listening');
});
