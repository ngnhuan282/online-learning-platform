import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  lstatSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tar = args =>
  execFileSync('tar', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
const resources = fileURLToPath(new URL('../resources/', import.meta.url));
const release = JSON.parse(readFileSync(join(resources, 'toeic-archives.json'), 'utf8'));
const releaseArchives = Object.entries(release).flatMap(([collection, hashes]) =>
  Object.entries(hashes).map(([name, sha256]) => ({ collection, name, sha256 })),
);
const sha256Of = file => createHash('sha256').update(readFileSync(file)).digest('hex');

export function toeicArchivePaths() {
  return releaseArchives.map(({ collection, name }) => `${collection}/${name}`);
}

export function verifyToeicArchives(directory = process.env.TOEIC_ARCHIVES_DIR, { optional = false } = {}) {
  const root = resolve(directory || resources);
  const archives = releaseArchives.map(archive => ({
    ...archive,
    source: join(root, archive.collection, archive.name),
  }));
  if (optional && !directory && !archives.some(({ source }) => existsSync(source))) return null;

  for (const { source, sha256 } of archives) {
    if (!existsSync(source)) {
      throw new Error(`Missing TOEIC archive ${source}. Put the release archives in TOEIC_ARCHIVES_DIR.`);
    }
    if (sha256Of(source) !== sha256) throw new Error(`TOEIC archive checksum mismatch: ${source}`);
  }
  return archives;
}

export function stageToeicArchives(archives) {
  for (const { collection, name, source } of archives) {
    const destination = join(resources, collection, name);
    if (source === destination) continue;
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
}

export function prepareToeicAssets({
  archiveDirectory = join(resources, 'toeic-reading'),
  outputDirectory = fileURLToPath(new URL('../public/toeic-assets/ets2024-reading/', import.meta.url)),
  archiveNames,
} = {}) {
  const { files, archives, extracted } = prepareCollection(
    archiveDirectory,
    outputDirectory,
    '(?:question-\\d+|passage-\\d+-\\d+-p\\d+)\\.webp',
    archiveNames,
  );
  return { archives, images: files, extracted };
}

export function prepareToeicListeningAssets({
  archiveDirectory = join(resources, 'toeic-listening'),
  outputDirectory = fileURLToPath(new URL('../public/toeic-assets/ets2024-listening/', import.meta.url)),
  archiveNames,
} = {}) {
  return prepareCollection(
    archiveDirectory,
    outputDirectory,
    '(?:(?:question|graphic)-\\d{3}\\.webp|audio-\\d{3}(?:-\\d{3})?\\.mp3)',
    archiveNames,
  );
}

function prepareCollection(archiveDirectory, outputDirectory, pathPattern, archiveNames) {
  const names =
    archiveNames ??
    readdirSync(archiveDirectory)
      .filter(name => /^test\d{2}\.tar\.gz$/.test(name))
      .sort();
  if (!names.length) throw new Error(`Missing TOEIC archives in ${archiveDirectory}.`);
  mkdirSync(outputDirectory, { recursive: true });
  if (lstatSync(outputDirectory).isSymbolicLink())
    throw new Error('TOEIC generated media folder must not be a symbolic link.');
  const manifestFile = join(outputDirectory, '.archive-manifest.json');
  if (existsSync(manifestFile) && lstatSync(manifestFile).isSymbolicLink())
    throw new Error('TOEIC media cache must not be a symbolic link.');
  let previous = {};
  try {
    previous = JSON.parse(readFileSync(manifestFile, 'utf8'));
  } catch {
    /* A missing cache is regenerated. */
  }
  const manifest = {};
  let count = 0;
  let extracted = 0;
  for (const name of names) {
    const archive = join(archiveDirectory, name);
    const sha256 = sha256Of(archive);
    const test = name.slice(0, -'.tar.gz'.length);
    const allowed = new RegExp(`^${test}/${pathPattern}$`);
    const folder = join(outputDirectory, test);
    if (existsSync(folder) && lstatSync(folder).isSymbolicLink())
      throw new Error('TOEIC test media folder must not be a symbolic link.');
    const cached = previous[name];
    if (
      cached?.sha256 === sha256 &&
      Array.isArray(cached.files) &&
      cached.files.length &&
      cached.files.every(
        file =>
          allowed.test(file) &&
          existsSync(join(outputDirectory, file)) &&
          !lstatSync(join(outputDirectory, file)).isSymbolicLink() &&
          lstatSync(join(outputDirectory, file)).isFile(),
      )
    ) {
      manifest[name] = cached;
      count += cached.files.length;
      continue;
    }
    const files = tar(['-tzf', archive]).split(/\r?\n/).filter(Boolean);
    if (!files.length || new Set(files).size !== files.length || files.some(file => !allowed.test(file))) {
      throw new Error(`Invalid TOEIC archive paths in ${name}.`);
    }
    const entries = tar(['-tvzf', archive]).split(/\r?\n/).filter(Boolean);
    if (
      entries.length !== files.length ||
      entries.some(line => !line.startsWith('-') || /\s(?:link to|->)\s/.test(line))
    ) {
      throw new Error(`Only regular media files are allowed in ${name}.`);
    }
    for (const file of files) {
      const target = join(outputDirectory, file);
      if (existsSync(target) && !lstatSync(target).isFile())
        throw new Error('TOEIC media target must be a regular file.');
    }
    tar(['-xzf', archive, '-C', outputDirectory]);
    manifest[name] = { sha256, files };
    count += files.length;
    extracted += files.length;
  }
  writeFileSync(manifestFile, JSON.stringify(manifest));
  return { archives: names.length, files: count, extracted };
}

export function prepareToeicRelease({ optional = false } = {}) {
  const archives = verifyToeicArchives(undefined, { optional });
  if (!archives) return null;

  const prepareOptions = collection => {
    const selected = archives.filter(archive => archive.collection === collection);
    return {
      archiveDirectory: dirname(selected[0].source),
      archiveNames: selected.map(archive => archive.name),
    };
  };
  return {
    reading: prepareToeicAssets(prepareOptions('toeic-reading')),
    listening: prepareToeicListeningAssets(prepareOptions('toeic-listening')),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const media = prepareToeicRelease({ optional: process.argv.includes('--if-present') });
  if (!media) {
    console.log('TOEIC media not prepared. Set TOEIC_ARCHIVES_DIR to include the release media.');
  } else {
    const { reading, listening } = media;
    console.log(
      `TOEIC: ${reading.images} Reading images and ${listening.files} Listening media files available ` +
        `(${reading.extracted + listening.extracted} extracted).`,
    );
  }
}
