import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'lib/index.ts'),
        'vue-devtools': resolve(__dirname, 'lib/vue-devtools.ts'),
        'redux-devtools': resolve(__dirname, 'lib/redux-devtools.ts'),
      },
      name: 'CommonStore',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['@vue/devtools-kit'],
      output: {
        globals: {},
      },
    },
  },
});
