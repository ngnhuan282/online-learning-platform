import { readFile, writeFile } from 'node:fs/promises';

// Keep the same isolated DB/keys; only shorten access expiry for the browser expiry regression.
const source = process.argv[2] || '.tmp/a8-a9.env';
const output = process.argv[3] || '.tmp/a8-a9-refresh.env';
const contents = (await readFile(source, 'utf8')).replace(/^JWT_ACCESS_TOKEN_SECONDS=.*\r?\n?/gm, '');
await writeFile(output, `${contents.trim()}\nJWT_ACCESS_TOKEN_SECONDS=5\n`, { mode: 0o600, flag: 'wx' });
console.log(`Created ${output} with a 5-second access TTL for isolated refresh E2E.`);
