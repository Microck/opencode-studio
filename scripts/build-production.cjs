const { spawnSync } = require('node:child_process');
const path = require('node:path');
const executable = path.resolve(__dirname, '../client-next/node_modules/next/dist/bin/next');
const result = spawnSync(process.execPath, [executable, 'build'], {
  cwd: path.resolve(__dirname, '../client-next'), stdio: 'inherit',
  env: { ...process.env, STUDIO_PROXY_API: '1', NEXT_PUBLIC_STUDIO_PROXY: '1' },
});
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
