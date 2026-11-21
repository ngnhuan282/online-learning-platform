import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const collectingCoverage = Boolean(process.env.FRONTEND_TEST_COVERAGE);

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [
    collectingCoverage && (await import('./scripts/coverage-instrumentation.mjs')).coveragePlugin,
    react(),
  ],
  optimizeDeps: collectingCoverage
    ? { noDiscovery: true, include: [] }
    : {
        include: [
          'react',
          'react-dom',
          'react-dom/client',
          'react/jsx-runtime',
          'react/jsx-dev-runtime',
          'react-router-dom',
          'axios',
          '@emotion/react',
          '@emotion/styled',
          '@mui/material',
          '@mui/icons-material',
          'exceljs',
          'katex',
          'react-markdown',
          'rehype-katex',
          'remark-gfm',
          'remark-math',
        ],
      },
}));
