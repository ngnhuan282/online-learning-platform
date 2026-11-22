import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { toeicArchivePaths, verifyToeicArchives } from '../../frontend/web/scripts/prepare-toeic-assets.mjs';

const exec = promisify(execFile);

function s3Location(uri) {
  const match = /^s3:\/\/([a-z0-9][a-z0-9.-]{1,61}[a-z0-9])\/([^\s?#]+)$/.exec(uri);
  const prefix = match?.[2].replace(/\/+$/, '');
  if (!prefix || prefix.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('TOEIC_ARCHIVES_S3_URI must be an S3 bucket and non-empty prefix (s3://bucket/prefix/).');
  }
  return { bucket: match[1], prefix: `${prefix}/` };
}

async function runAws(args, region) {
  try {
    const { stdout } = await exec('aws', [...args, '--region', region, '--no-cli-pager'], {
      windowsHide: true,
    });
    return stdout;
  } catch (error) {
    if (error.code === 'ENOENT')
      throw new Error('Install AWS CLI v2 on the production host to read TOEIC from S3.');
    throw new Error(`Could not read TOEIC archives from S3: ${error.stderr?.trim() || error.message}`);
  }
}

export async function checkToeicS3({ uri, region }, aws = runAws) {
  const { bucket, prefix } = s3Location(uri);
  const result = await aws(
    [
      's3api',
      'list-objects-v2',
      '--bucket',
      bucket,
      '--prefix',
      prefix,
      '--query',
      'Contents[].Key',
      '--output',
      'json',
    ],
    region,
  );
  const keys = new Set(JSON.parse(result) ?? []);
  const paths = toeicArchivePaths();
  const missing = paths.filter(path => !keys.has(`${prefix}${path}`));
  if (missing.length)
    throw new Error(`Missing TOEIC archives in s3://${bucket}/${prefix}: ${missing.join(', ')}`);
  console.log(`Found all ${paths.length} TOEIC archives in s3://${bucket}/${prefix}.`);
}

export async function withToeicS3Archives({ uri, region, temporaryRoot }, useArchives, aws = runAws) {
  const { bucket, prefix } = s3Location(uri);
  await mkdir(temporaryRoot, { recursive: true });
  const downloadDirectory = await mkdtemp(join(await realpath(temporaryRoot), 'toeic-s3-'));
  const paths = toeicArchivePaths();
  try {
    await aws(
      [
        's3',
        'cp',
        `s3://${bucket}/${prefix}`,
        downloadDirectory,
        '--recursive',
        '--only-show-errors',
        '--exclude',
        '*',
        ...paths.flatMap(path => ['--include', path]),
      ],
      region,
    );
    const archives = verifyToeicArchives(downloadDirectory);
    console.log(`Downloaded and verified ${archives.length} TOEIC archives from S3.`);
    return await useArchives(archives);
  } finally {
    await rm(downloadDirectory, { recursive: true, force: true });
  }
}
