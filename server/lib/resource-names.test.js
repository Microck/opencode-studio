const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
    assertSafeBackupResourceNames,
    isSafeAgentName,
    isSafeAuthProfileName,
    isSafePluginName,
    isSafeSkillName,
} = require('./resource-names');

describe('resource name policy', () => {
    it('accepts normal skill, plugin, and agent names', () => {
        assert.equal(isSafeSkillName('code-review'), true);
        assert.equal(isSafePluginName('watcher.plugin'), true);
        assert.equal(isSafePluginName('watcher.ts'), true);
        assert.equal(isSafeAgentName('Build Agent'), true);
        assert.equal(isSafeAuthProfileName('jikui.feng+oss@example.com'), true);
    });

    it('rejects path traversal and path separator names', () => {
        for (const name of ['../escape', '..\\escape', '/tmp/escape', 'nested/plugin', '.', '..']) {
            assert.equal(isSafeSkillName(name), false, `skill ${name}`);
            assert.equal(isSafePluginName(name), false, `plugin ${name}`);
            assert.equal(isSafeAgentName(name), false, `agent ${name}`);
            assert.equal(isSafeAuthProfileName(name), false, `auth profile ${name}`);
        }
    });

    it('rejects malformed auth profile names', () => {
        for (const name of [' user@example.com', 'user@example.com ', 'profile:name', 'profile*name', '']) {
            assert.equal(isSafeAuthProfileName(name), false, `auth profile ${name}`);
        }
    });

    it('rejects malformed backup skill and plugin names before restore writes', () => {
        assert.doesNotThrow(() => {
            assertSafeBackupResourceNames({
                skills: [{ name: 'debugging', content: 'ok' }],
                plugins: [{ name: 'hooks', content: 'ok' }],
            });
        });

        assert.throws(
            () => assertSafeBackupResourceNames({ skills: [{ name: '../escape', content: 'bad' }] }),
            /Invalid skill name/
        );
        assert.throws(
            () => assertSafeBackupResourceNames({ plugins: [{ name: '../escape', content: 'bad' }] }),
            /Invalid plugin name/
        );
        assert.throws(
            () => assertSafeBackupResourceNames({ skills: { name: 'debugging', content: 'bad' } }),
            /Invalid skills list/
        );
        assert.throws(
            () => assertSafeBackupResourceNames({ plugins: { name: 'hooks', content: 'bad' } }),
            /Invalid plugins list/
        );
    });
});
