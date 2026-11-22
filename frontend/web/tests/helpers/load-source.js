import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function loadSource(path, parent) {
  const url = new URL(path, parent);
  if (!process.env.FRONTEND_TEST_COVERAGE) return import(url);

  const [{ registerHooks }, { instrumentSource, isSourceFile }] = await Promise.all([
    import('node:module'),
    import('../../scripts/coverage-instrumentation.mjs'),
  ]);
  const hooks = registerHooks({
    load(location, context, nextLoad) {
      if (!location.startsWith('file:') || !isSourceFile(fileURLToPath(location))) {
        return nextLoad(location, context);
      }
      const filename = fileURLToPath(location);
      const { code } = instrumentSource(readFileSync(filename, 'utf8'), filename);
      return { format: 'module', source: code, shortCircuit: true };
    },
  });

  try {
    return await import(url);
  } finally {
    hooks.deregister();
  }
}
