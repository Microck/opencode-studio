const { test } = require('node:test');
const assert = require('node:assert');
const { safeName } = require('./profile-manager');

test('safeName rejects traversal and dot names', () => {
    for (const bad of ['.', '..', '../evil', 'a/b', '..\\..', '/etc/passwd', '', null]) {
        assert.throws(() => safeName(bad), /Invalid profile name/, `should reject ${JSON.stringify(bad)}`);
    }
});

test('safeName accepts direct-child names', () => {
    for (const ok of ['work', 'personal', 'my.profile', 'p_1-2']) {
        assert.strictEqual(safeName(ok), ok);
    }
});
