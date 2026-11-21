import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

process.on('exit', () => {
  if (globalThis.__coverage__) {
    const filename = join(process.env.FRONTEND_TEST_COVERAGE, `${process.pid}.json`);
    writeFileSync(filename, JSON.stringify(globalThis.__coverage__));
  }
});
