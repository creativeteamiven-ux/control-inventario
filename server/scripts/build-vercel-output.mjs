/**
 * Genera .vercel/output para Build Output API.
 * Así Vercel trata la app Express como función serverless y no como estático.
 * Ejecutar desde la raíz de server/ después de `npm run build`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '..');
const outDir = path.join(serverRoot, '.vercel', 'output');
const funcDir = path.join(outDir, 'functions', 'index.func');

function mkdirp(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    mkdirp(dest);
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    mkdirp(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

// Crear estructura
mkdirp(funcDir);

// Copiar artefactos del build
const toCopy = [
  ['index.js', 'index.js'],
  ['routes', 'routes'],
  ['middleware', 'middleware'],
  ['lib', 'lib'],
  ['prisma', 'prisma'],
  ['package.json', 'package.json'],
  ['package-lock.json', 'package-lock.json'],
];

for (const [from, to] of toCopy) {
  const src = path.join(serverRoot, from);
  const dest = path.join(funcDir, to);
  if (fs.existsSync(src)) {
    if (fs.statSync(src).isDirectory()) {
      copyRecursive(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

// Copiar paquete shared (monorepo) y ajustar package.json para instalación en .func
const sharedSrc = path.join(serverRoot, '..', 'packages', 'shared');
const sharedDest = path.join(funcDir, 'packages', 'shared');
if (fs.existsSync(sharedSrc)) {
  mkdirp(path.dirname(sharedDest));
  copyRecursive(sharedSrc, sharedDest);
  const pkgPath = path.join(funcDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.dependencies && pkg.dependencies['@soundvault/shared']) {
    pkg.dependencies['@soundvault/shared'] = 'file:./packages/shared';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  }
}

// Instalar dependencias en .func (más ligero que copiar node_modules)
const { spawnSync } = await import('child_process');
console.log('Instalando dependencias en .func...');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let r = spawnSync(npm, ['install', '--omit=dev'], { cwd: funcDir, stdio: 'inherit', shell: true });
if (r.status !== 0) process.exit(r.status || 1);
console.log('Ejecutando prisma generate...');
r = spawnSync('npx', ['prisma', 'generate'], { cwd: funcDir, stdio: 'inherit', shell: true });
if (r.status !== 0) process.exit(r.status || 1);

// .vc-config.json para la función Node
const vcConfig = {
  runtime: 'nodejs20.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: true,
};
fs.writeFileSync(
  path.join(funcDir, '.vc-config.json'),
  JSON.stringify(vcConfig, null, 2)
);

// config.json: todas las rutas -> función index
const config = {
  version: 3,
  routes: [
    {
      src: '/(.*)',
      dest: '/index',
    },
  ],
  headers: [
    {
      source: '/(.*)',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: 'https://control-inventario-02.vercel.app' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
        { key: 'Access-Control-Max-Age', value: '86400' },
      ],
    },
  ],
};
mkdirp(outDir);
fs.writeFileSync(
  path.join(outDir, 'config.json'),
  JSON.stringify(config, null, 2)
);

console.log('Build Output API generado en .vercel/output');
