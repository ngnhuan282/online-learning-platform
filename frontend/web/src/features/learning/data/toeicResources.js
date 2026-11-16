import { buildToeicCatalog } from '../utils/toeicCatalog';

// Vite emits these as assets. Browsers download a document only when it is opened.
const documents = import.meta.glob(
  [
    '../../../../../../docs/resources/**/*.{pdf,docx}',
    '!../../../../../../docs/resources/**/[Aa][Uu][Dd][Ii][Oo]/**',
  ],
  { query: '?url', import: 'default', eager: true },
);

export const toeicCatalog = buildToeicCatalog(documents);
