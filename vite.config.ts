import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/config/frontend.json': 'http://127.0.0.1:8080',
      '/role_templates/list.json': 'http://127.0.0.1:8080',
      '/role_templates/': 'http://127.0.0.1:8080',
      '/agents/list.json': 'http://127.0.0.1:8080',
      '/members/list.json': 'http://127.0.0.1:8080',
      '/rooms/list.json': 'http://127.0.0.1:8080',
      '/rooms/': 'http://127.0.0.1:8080',
      '/teams/list.json': 'http://127.0.0.1:8080',
      '/teams/create.json': 'http://127.0.0.1:8080',
      '^/teams/.+\\.json$': 'http://127.0.0.1:8080',
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
      },
    },
  },
});
