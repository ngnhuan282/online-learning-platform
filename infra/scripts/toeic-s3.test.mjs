import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { toeicArchivePaths } from '../../frontend/web/scripts/prepare-toeic-assets.mjs';
import { checkToeicS3, withToeicS3Archives } from './toeic-s3.mjs';

const prefix = 'documents/toeic/ets2024/';
const source = { uri: `s3://example-media/${prefix}`, region: 'ap-southeast-1' };
const paths = toeicArchivePaths();

test('S3 preflight requires the exact Reading and Listening keys in the release', async () => {
  const list = JSON.stringify([...paths.map(path => `${prefix}${path}`), `${prefix}extra.pdf`]);
  assert.equal(paths.length, 19);
  assert.deepEqual(
    paths.filter(path => path.startsWith('toeic-reading/')),
    Array.from(
      { length: 10 },
      (_, index) => `toeic-reading/test${String(index + 1).padStart(2, '0')}.tar.gz`,
    ),
  );
  assert.equal(paths.filter(path => path.startsWith('toeic-listening/')).length, 9);
  await checkToeicS3({ ...source, uri: source.uri.slice(0, -1) }, async (args, region) => {
    assert.equal(region, source.region);
    assert.deepEqual(args, [
      's3api',
      'list-objects-v2',
      '--bucket',
      'example-media',
      '--prefix',
      prefix,
      '--query',
      'Contents[].Key',
      '--output',
      'json',
    ]);
    return list;
  });
  await assert.rejects(
    checkToeicS3(source, async () => JSON.stringify(paths.slice(1).map(path => `${prefix}${path}`))),
    /Missing TOEIC archives.*toeic-reading\/test01\.tar\.gz/,
  );
  await assert.rejects(
    checkToeicS3(source, async () =>
      JSON.stringify(paths.map(path => `${prefix}${path.replace(/^toeic-reading\//, 'toeic/')}`)),
    ),
    /Missing TOEIC archives.*toeic-reading\/test01\.tar\.gz/,
  );
});

test('S3 preflight rejects a bucket without an archive prefix', async () => {
  const noAwsCall = () => assert.fail('AWS should not be called for an invalid URI');
  await assert.rejects(
    checkToeicS3({ ...source, uri: 's3://example-media/' }, noAwsCall),
    /non-empty prefix/,
  );
});

test('a corrupt S3 download never reaches the build and its temporary files are removed', async t => {
  const parent = fileURLToPath(new URL('../../.tmp/', import.meta.url));
  await mkdir(parent, { recursive: true });
  const temporaryRoot = await mkdtemp(join(await realpath(parent), 'toeic-s3-test-'));
  t.after(() => rm(temporaryRoot, { recursive: true, force: true }));

  let destination;
  await assert.rejects(
    withToeicS3Archives(
      { ...source, temporaryRoot },
      () => assert.fail('Corrupt media must never be staged'),
      async (args, region) => {
        assert.equal(region, source.region);
        destination = args[3];
        assert.equal(dirname(destination), temporaryRoot);
        assert.deepEqual(args, [
          's3',
          'cp',
          source.uri,
          destination,
          '--recursive',
          '--only-show-errors',
          '--exclude',
          '*',
          ...paths.flatMap(path => ['--include', path]),
        ]);
        const corrupted = join(destination, paths[0]);
        await mkdir(dirname(corrupted), { recursive: true });
        await writeFile(corrupted, 'incorrect archive bytes');
      },
    ),
    /TOEIC archive checksum mismatch/,
  );
  await assert.rejects(stat(destination), { code: 'ENOENT' });
});
