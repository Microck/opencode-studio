// HTTP smoke test: spawns the REAL server under a sandbox HOME, discovers the
// auto-selected port from its stdout, talks HTTP to it, and kills the child.
// Mirrors the sandbox-HOME discipline of profile-manager.test.js — never
// touches the real ~/.omo or ~/.config.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

// "Server running at http://127.0.0.1:<port>" — capture the whole URL so the
// test still works if HOST env is ever set (e.g. 0.0.0.0).
const STARTUP_LINE_RE = /Server running at (http:\/\/[^:]+:\d+)/;

// The server performs an initial auth sync + lock handling on startup, so the
// startup line can take a while; be generous.
const STARTUP_TIMEOUT_MS = 30_000;
const EXIT_TIMEOUT_MS = 5_000;

function waitForStartupLine(child) {
    return new Promise((resolve, reject) => {
        let stdoutBuf = '';
        let stderrBuf = '';
        let settled = false;

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error(
                `Server startup line not seen within ${STARTUP_TIMEOUT_MS}ms.\n` +
                `--- child stdout ---\n${stdoutBuf || '(empty)'}\n` +
                `--- child stderr ---\n${stderrBuf || '(empty)'}`
            ));
        }, STARTUP_TIMEOUT_MS);

        child.stdout.on('data', (chunk) => {
            stdoutBuf += chunk;
            const match = stdoutBuf.match(STARTUP_LINE_RE);
            if (match && !settled) {
                settled = true;
                clearTimeout(timer);
                resolve(match[1]);
            }
        });
        child.stderr.on('data', (chunk) => {
            stderrBuf += chunk;
        });
        child.on('error', (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        });
        child.on('exit', (code, signal) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(new Error(
                `Server exited (code=${code}, signal=${signal}) before printing its startup line.\n` +
                `--- child stdout ---\n${stdoutBuf || '(empty)'}\n` +
                `--- child stderr ---\n${stderrBuf || '(empty)'}`
            ));
        });
    });
}

function waitForExit(child) {
    return new Promise((resolve) => {
        let done = false;
        const timer = setTimeout(() => {
            if (done) return;
            done = true;
            child.kill('SIGKILL');
            resolve({ code: null, signal: 'SIGKILL (timeout)' });
        }, EXIT_TIMEOUT_MS);
        child.once('exit', (code, signal) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve({ code, signal });
        });
    });
}

test('spawns real server in sandbox HOME and /api/health returns ok', async (t) => {
    const sandboxHome = fs.mkdtempSync(path.join(os.tmpdir(), 'http-smoke-'));
    t.after(() => {
        try {
            fs.rmSync(sandboxHome, { recursive: true, force: true });
        } catch {
            // no-op
        }
    });

    const child = spawn(process.execPath, ['index.js'], {
        cwd: __dirname, // server/ — `node index.js` must resolve from here
        env: { ...process.env, HOME: sandboxHome },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let baseUrl;
    try {
        // Fail LOUDLY if the port probe never matches — no false green.
        baseUrl = await waitForStartupLine(child);
        assert.match(baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/, `unexpected startup URL: ${baseUrl}`);

        const res = await fetch(`${baseUrl}/api/health`);
        assert.strictEqual(res.status, 200, `expected HTTP 200, got ${res.status}`);
        // Misleading-success guard: assert the JSON body, not just the 200.
        const body = await res.json();
        assert.strictEqual(body.status, 'ok', `expected body.status === 'ok', got ${JSON.stringify(body)}`);
    } finally {
        // Never leak the child, even on assertion failure.
        child.kill('SIGTERM');
        await waitForExit(child);
    }
});
