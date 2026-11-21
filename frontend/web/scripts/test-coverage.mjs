import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import istanbul from 'istanbul-lib-coverage';
import { instrumentSource, isSourceFile, sourceDirectory } from './coverage-instrumentation.mjs';

const minimum = 95;
const root = fileURLToPath(new URL('..', import.meta.url));
const output = join(root, 'coverage');
const raw = await mkdtemp(join(tmpdir(), 'learning-frontend-coverage-'));

try {
  const run = spawnSync(
    process.execPath,
    ['--import', './scripts/collect-test-coverage.mjs', '--test', '--test-concurrency=1', 'tests/*.test.js'],
    {
      cwd: root,
      env: { ...process.env, FRONTEND_TEST_COVERAGE: raw },
      stdio: 'inherit',
    },
  );
  if (run.error) throw run.error;

  const report = istanbul.createCoverageMap();
  for (const file of await readdir(raw)) {
    report.merge(JSON.parse(await readFile(join(raw, file), 'utf8')));
  }
  for (const entry of await readdir(sourceDirectory, { withFileTypes: true, recursive: true })) {
    const filename = join(entry.parentPath, entry.name);
    if (!entry.isFile() || !isSourceFile(filename) || report.data[filename]) continue;
    report.addFileCoverage(instrumentSource(await readFile(filename, 'utf8'), filename).coverage);
  }

  const { lines } = report.getCoverageSummary().toJSON();
  const files = Object.fromEntries(
    report
      .files()
      .sort()
      .map(file => [relative(root, file), report.fileCoverageFor(file).toSummary().toJSON()]),
  );
  await mkdir(output, { recursive: true });
  await writeFile(join(output, 'coverage-summary.json'), JSON.stringify({ lines, files }, null, 2));
  await writeFile(join(output, 'coverage-final.json'), JSON.stringify(report));

  const percent = (100 * lines.covered) / lines.total;
  console.log(`\nFrontend line coverage: ${percent.toFixed(2)}% (${lines.covered}/${lines.total} lines).`);
  if (!(percent >= minimum)) console.error(`Frontend line coverage must be at least ${minimum}%.`);
  process.exitCode = (run.status ?? 1) || Number(!(percent >= minimum));
} finally {
  await Promise.all((await readdir(raw)).map(file => unlink(join(raw, file))));
  await rmdir(raw);
}
