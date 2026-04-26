import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.join(here, 'src'),
      idecn: path.join(here, 'src', 'components', 'IDE.tsx'),
    },
  },
  optimizeDeps: {
    include: ['@monaco-editor/react', 'jotai', 'shiki', 'dockview-react'],
  },
});
