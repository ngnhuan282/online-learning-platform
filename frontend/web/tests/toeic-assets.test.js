import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareToeicAssets } from '../scripts/prepare-toeic-assets.mjs';

const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const archiveDirectory = fileURLToPath(new URL('../resources/toeic/', import.meta.url));
const existingImages = fileURLToPath(new URL('../public/toeic-assets/ets2024-reading/', import.meta.url));
const temporaryParent = join(workspace, '.tmp');
mkdirSync(temporaryParent, { recursive: true });
const temporary = mkdtempSync(join(temporaryParent, 'toeic-packs-'));
const outputDirectory = join(temporary, 'images');
const hash = file => createHash('sha256').update(readFileSync(file)).digest('hex');
after(() => {
  const target = realpathSync(temporary);
  assert.ok(target.startsWith(resolve(temporaryParent) + sep));
  rmSync(target, { recursive: true, force: true });
});

test('ten versioned archives restore every TOEIC source image byte-for-byte on a clean checkout', () => {
  prepareToeicAssets();
  assert.equal(readdirSync(archiveDirectory).filter(name => name.endsWith('.tar.gz')).length, 10);
  const result = prepareToeicAssets({ archiveDirectory, outputDirectory });
  assert.equal(result.archives, 10);
  assert.equal(result.images, 1220);
  assert.equal(result.extracted, 1220);
  let compared = 0;
  for (const test of readdirSync(outputDirectory).filter(name => /^test\d{2}$/.test(name))) {
    for (const file of readdirSync(join(outputDirectory, test))) {
      assert.equal(
        hash(join(outputDirectory, test, file)),
        hash(join(existingImages, test, file)),
        `${test}/${file}`,
      );
      compared++;
    }
  }
  assert.equal(compared, 1220);
});

test('cached preparation skips intact packs and restores a removed generated image', () => {
  const cached = prepareToeicAssets({ archiveDirectory, outputDirectory });
  assert.equal(cached.extracted, 0);
  const file = join(outputDirectory, 'test01/question-101.webp');
  assert.ok(resolve(file).startsWith(resolve(temporary) + sep));
  unlinkSync(file);
  const recovered = prepareToeicAssets({ archiveDirectory, outputDirectory });
  assert.ok(recovered.extracted > 0);
  assert.equal(hash(file), hash(join(existingImages, 'test01/question-101.webp')));
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
