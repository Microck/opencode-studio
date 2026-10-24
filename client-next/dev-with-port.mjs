import { spawn } from "node:child_process";
import { findAvailablePort } from "./scripts/dev-port.mjs";
const DEFAULT_PORT = 1080;

findAvailablePort(DEFAULT_PORT).then(port => {
    process.env.PORT = port.toString();
    console.log(`Starting Next.js on port ${port}`);

    const dev = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1'], {
        stdio: 'inherit',
        shell: false
    });

    dev.on('error', (err) => {
        console.error('Failed to start dev server:', err);
        process.exit(1);
    });

    dev.on('exit', (code, signal) => {
        process.exitCode = code ?? (signal ? 1 : 0);
    });

    process.on('SIGTERM', () => {
        dev.kill('SIGTERM');
        process.exit(0);
    });

    process.on('SIGINT', () => {
        dev.kill('SIGINT');
        process.exit(0);
    });
}).catch(error => {
    console.error('Unable to start development server:', error.message);
    process.exitCode = 1;
});
