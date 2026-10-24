import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { findAvailablePort } from './dev-port.mjs';

function fixture(errors) {
    const calls = [];
    const createServer = () => Object.assign(new EventEmitter(), {
        listen(port, host, callback) {
            calls.push({ port, host });
            queueMicrotask(() => {
                const code = errors.shift();
                if (code) this.emit('error', Object.assign(new Error(code), { code }));
                else callback();
            });
        },
        close(callback) { callback(); },
    });
    return { calls, createServer };
}

test('frontend port discovery stays on loopback', async () => {
    const f = fixture(['EADDRINUSE']);
    assert.equal(await findAvailablePort(1080, 10, f.createServer), 1081);
    assert.deepEqual(f.calls, [{ port: 1080, host: '127.0.0.1' }, { port: 1081, host: '127.0.0.1' }]);
});
test('frontend port exhaustion stops at the backend origin boundary', async () => {
    const f = fixture(Array(10).fill('EADDRINUSE'));
    await assert.rejects(findAvailablePort(1080, 10, f.createServer), /1080-1089/);
    assert.equal(f.calls.length, 10);
});
test('frontend permission errors are not retried', async () => {
    const f = fixture(['EACCES']);
    await assert.rejects(findAvailablePort(1080, 10, f.createServer), { code: 'EACCES' });
    assert.equal(f.calls.length, 1);
});
