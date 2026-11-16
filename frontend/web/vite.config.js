import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));
const resourceRoot = fileURLToPath(new URL('../../docs/resources', import.meta.url));
function documentFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink() || entry.name.toUpperCase() === 'AUDIO') return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? documentFiles(path) : /\.(pdf|docx)$/i.test(entry.name) ? [path] : [];
  });
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [webRoot, ...documentFiles(resourceRoot)] } },
});
