import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Destino del proxy de la API en desarrollo. Por defecto 3001; sobreescribe con
  // VITE_PROXY_TARGET (ej. en client/.env.local) si tu backend corre en otro puerto.
  const apiTarget = env.VITE_PROXY_TARGET || 'http://localhost:3001';

  // HTTPS en desarrollo (necesario para usar la cámara desde el celular por la red local).
  // Actívalo con: npm run dev:https  (o VITE_HTTPS=true)
  const useHttps = env.VITE_HTTPS === 'true' || env.HTTPS === 'true';

  return {
    plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api': { target: apiTarget, changeOrigin: true },
        '/uploads': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
