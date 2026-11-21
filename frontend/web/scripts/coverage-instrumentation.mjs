import { isAbsolute, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import istanbul from 'istanbul-lib-instrument';

export const sourceDirectory = fileURLToPath(new URL('../src/', import.meta.url));

export function isSourceFile(filename) {
  const path = relative(sourceDirectory, filename);
  return !path.startsWith('..') && !isAbsolute(path) && /\.jsx?$/.test(path);
}

export function instrumentSource(code, filename) {
  const instrumenter = istanbul.createInstrumenter({
    esModules: true,
    compact: false,
    produceSourceMap: true,
    parserPlugins: ['jsx', 'importMeta'],
  });
  const path = normalize(resolve(filename));
  return {
    code: instrumenter.instrumentSync(code, path),
    map: instrumenter.lastSourceMap(),
    coverage: instrumenter.lastFileCoverage(),
  };
}

export const coveragePlugin = {
  name: 'frontend-test-coverage',
  enforce: 'pre',
  transform(code, id) {
    if (!isSourceFile(id)) return null;
    const { code: instrumented, map } = instrumentSource(code, id);
    return { code: instrumented, map };
  },
};
