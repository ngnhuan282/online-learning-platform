import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { after, test } from 'node:test';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  prepareToeicAssets,
  prepareToeicListeningAssets,
  verifyToeicArchives,
} from '../../../../scripts/prepare-toeic-assets.mjs';

const workspace = fileURLToPath(new URL('../../../../../../', import.meta.url));
const temporaryParent = join(workspace, '.tmp');
mkdirSync(temporaryParent, { recursive: true });
const temporary = mkdtempSync(join(temporaryParent, 'toeic-packs-'));
const fixture = join(temporary, 'fixtures');
const image = 'test01/question-101.webp';
const audio = 'test01/audio-032-034.mp3';
const archiveDirectory = join(temporary, 'reading');
const listeningArchives = join(temporary, 'listening');
mkdirSync(join(fixture, 'test01'), { recursive: true });
for (const [directory, file] of [
  [archiveDirectory, image],
  [listeningArchives, audio],
]) {
  mkdirSync(directory);
  writeFileSync(join(fixture, file), `fixture ${file}`);
  execFileSync('tar', ['-czf', join(directory, 'test01.tar.gz'), '-C', fixture, file]);
}
after(() => {
  const target = realpathSync(temporary);
  assert.ok(target.startsWith(resolve(temporaryParent) + sep));
  rmSync(target, { recursive: true, force: true });
});

test('TOEIC preparation preserves bytes and paths for both media collections', () => {
  const outputDirectory = join(temporary, 'images');
  const result = prepareToeicAssets({ archiveDirectory, outputDirectory });
  assert.deepEqual(result, { archives: 1, images: 1, extracted: 1 });
  assert.deepEqual(readFileSync(join(outputDirectory, image)), readFileSync(join(fixture, image)));
  const audioOutput = join(temporary, 'audio');
  assert.deepEqual(
    prepareToeicListeningAssets({ archiveDirectory: listeningArchives, outputDirectory: audioOutput }),
    { archives: 1, files: 1, extracted: 1 },
  );
  assert.deepEqual(readFileSync(join(audioOutput, audio)), readFileSync(join(fixture, audio)));
});

test('cached preparation skips intact packs and restores a removed generated image', () => {
  const outputDirectory = join(temporary, 'cache');
  prepareToeicAssets({ archiveDirectory, outputDirectory });
  const cached = prepareToeicAssets({ archiveDirectory, outputDirectory });
  assert.equal(cached.extracted, 0);
  const file = join(outputDirectory, image);
  assert.ok(resolve(file).startsWith(resolve(temporary) + sep));
  unlinkSync(file);
  const recovered = prepareToeicAssets({ archiveDirectory, outputDirectory });
  assert.ok(recovered.extracted > 0);
  assert.deepEqual(readFileSync(file), readFileSync(join(fixture, image)));
});

test('a configured release directory rejects missing archives and altered content', () => {
  const releasePath = join(temporary, 'release');
  assert.throws(() => verifyToeicArchives(releasePath, { optional: true }), /Missing TOEIC archive/);
  mkdirSync(join(releasePath, 'toeic-reading'), { recursive: true });
  copyFileSync(join(archiveDirectory, 'test01.tar.gz'), join(releasePath, 'toeic-reading/test01.tar.gz'));
  assert.throws(() => verifyToeicArchives(releasePath), /TOEIC archive checksum mismatch/);
});

test('an archive containing paths for another test is rejected before extraction', () => {
  const invalid = join(temporary, 'invalid');
  const destination = join(temporary, 'rejected');
  mkdirSync(invalid);
  copyFileSync(join(archiveDirectory, 'test01.tar.gz'), join(invalid, 'test02.tar.gz'));
  assert.throws(
    () => prepareToeicAssets({ archiveDirectory: invalid, outputDirectory: destination }),
    /Invalid TOEIC archive paths/,
  );
  assert.equal(existsSync(join(destination, 'test01/question-101.webp')), false);
});
