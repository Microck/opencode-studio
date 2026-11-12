// Supervise both services without a development server or shell job control.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const root = path.resolve(__dirname, '..');
const standalone = process.env.STUDIO_STANDALONE === '1';
const publicOrigin = process.env.STUDIO_PUBLIC_ORIGIN || `http://127.0.0.1:${process.env.PORT || '3000'}`;
const lockDir = path.join(process.env.HOME || '', '.config', 'opencode-studio');
if (standalone) fs.mkdirSync(lockDir, { recursive: true });
const children = [
  spawn(standalone ? 'flock' : process.execPath, standalone
    ? ['--nonblock', '--no-fork', path.join(lockDir, 'container.lock'), '/bin/sh', '-c',
      'rm -f -- "$1"; exec "$2" "$3"', '--', path.join(os.tmpdir(), 'opencode-studio-server.lock.json'),
      process.execPath, path.join(root, 'server/index.js')]
    : [path.join(root, 'server/index.js')], {
    stdio: 'inherit', env: { ...process.env, STUDIO_SERVICE: '1',
      STUDIO_PUBLIC_ORIGIN: publicOrigin, ...(standalone ? { STUDIO_CONTAINER_LOCK: '1' } : {}) },
  }),
  spawn(process.execPath, standalone
    ? [path.join(root, 'client-next/.next/standalone/server.js')]
    : [path.join(root, 'client-next/node_modules/next/dist/bin/next'), 'start', '-H', '127.0.0.1'], {
    cwd: path.join(root, 'client-next'), stdio: 'inherit',
    env: { ...process.env, STUDIO_PROXY_API: '1', STUDIO_PUBLIC_ORIGIN: publicOrigin,
      ...(standalone ? { HOSTNAME: '0.0.0.0' } : {}) },
  }),
];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  const timer = setTimeout(() => process.exit(code), 5000);
  timer.unref();
  Promise.all(children.map(child => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) resolve();
    else child.once('exit', resolve);
  }))).then(() => process.exit(code));
}
for (const child of children) {
  child.once('error', error => { console.error(error); stop(1); });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`Service exited unexpectedly (${signal || code})`);
      stop(1);
    }
  });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(0));
