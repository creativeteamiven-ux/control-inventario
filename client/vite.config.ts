import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Copia zbar.wasm junto a los chunks (Vite no siempre emite el URL interno del paquete). */
function copyZbarWasm(): Plugin {
  const src = path.resolve(__dirname, 'node_modules/@undecaf/zbar-wasm/dist/zbar.wasm');
  const copy = (destDir: string) => {
    if (!fs.existsSync(src) || !fs.existsSync(destDir)) return;
    fs.copyFileSync(src, path.join(destDir, 'zbar.wasm'));
  };
  return {
    name: 'copy-zbar-wasm',
    buildStart() {
      const pub = path.resolve(__dirname, 'public');
      if (fs.existsSync(pub)) copy(pub);
    },
    writeBundle(options) {
      const outDir = options.dir || path.resolve(__dirname, 'dist');
      copy(outDir);
      copy(path.join(outDir, 'assets'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Destino del proxy de la API en desarrollo. Por defecto 3001; sobreescribe con
  // VITE_PROXY_TARGET (ej. en client/.env.local) si tu backend corre en otro puerto.
  const apiTarget = env.VITE_PROXY_TARGET || 'http://localhost:3001';

  // HTTPS en desarrollo (necesario para usar la cámara desde el celular por la red local).
  // Actívalo con: npm run dev:https  (o VITE_HTTPS=true)
  const useHttps = env.VITE_HTTPS === 'true' || env.HTTPS === 'true';

  return {
    plugins: [react(), copyZbarWasm(), ...(useHttps ? [basicSsl()] : [])],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    assetsInclude: ['**/*.wasm'],
    optimizeDeps: {
      exclude: ['@undecaf/zbar-wasm'],
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
