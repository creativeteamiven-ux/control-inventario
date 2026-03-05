#!/usr/bin/env node
/**
 * Arranca backend y frontend en una sola terminal (Windows / sin concurrently).
 * Uso: npm run dev:local
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

const server = spawn(npm, ['run', 'dev'], {
  cwd: path.join(root, 'server'),
  stdio: 'inherit',
  shell: true,
});

const client = spawn(npm, ['run', 'dev'], {
  cwd: path.join(root, 'client'),
  stdio: 'inherit',
  shell: true,
});

function killAll() {
  server.kill('SIGTERM');
  client.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);

server.on('error', (err) => {
  console.error('Error servidor:', err.message);
});
client.on('error', (err) => {
  console.error('Error cliente:', err.message);
});

server.on('exit', (code) => {
  if (code !== null && code !== 0) client.kill();
});
client.on('exit', (code) => {
  if (code !== null && code !== 0) server.kill();
});
