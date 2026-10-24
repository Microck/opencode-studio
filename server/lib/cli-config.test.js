const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readCliConfig, writeCliConfig } = require('./cli-config');

test('v2 CLI settings preserve other files and reject stale or invalid writes', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-cli-config-'));
    const file = path.join(directory, 'cli.json');
    try {
        fs.writeFileSync(path.join(directory, 'tui.json'), '{"theme":"old"}');
        fs.writeFileSync(path.join(directory, 'opencode.json'), '{"agents":{}}');
        assert.deepEqual(readCliConfig(file), { content: '{}\n', exists: false, revision: null });
        assert.equal(fs.existsSync(file), false);
        const saved = writeCliConfig(file, { content: '{"theme":"new","custom":{"keep":true}}', revision: null }, fs.writeFileSync);
        assert.equal(saved.exists, true);
        assert.throws(() => writeCliConfig(file, { content: '{}', revision: null }, fs.writeFileSync), { statusCode: 409 });
        for (const content of ['null', '[]', '{bad']) assert.throws(() => writeCliConfig(file, { content, revision: saved.revision }, fs.writeFileSync), { statusCode: 400 });
        assert.equal(readCliConfig(file).content, saved.content);
        assert.equal(fs.readFileSync(path.join(directory, 'tui.json'), 'utf8'), '{"theme":"old"}');
        assert.equal(fs.readFileSync(path.join(directory, 'opencode.json'), 'utf8'), '{"agents":{}}');
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
