const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { readNativeCredentialMetadata } = require('./native-credentials');

test('v2 credential metadata excludes secret values and does not change storage', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-credential-test-'));
    const file = path.join(directory, 'opencode.db');
    try {
        const db = new DatabaseSync(file);
        db.exec('CREATE TABLE credential (id TEXT PRIMARY KEY, integration_id TEXT, label TEXT, active INTEGER, value TEXT)');
        db.prepare('INSERT INTO credential VALUES (?,?,?,?,?)').run('fixture', 'fixture-provider', 'Synthetic account', 1, '{"key":"synthetic-never-a-real-secret"}');
        db.close();
        const before = fs.readFileSync(file);
        const result = readNativeCredentialMetadata([directory], DatabaseSync);
        assert.deepEqual(result, { storage: 'opencode-v2-database', credentials: [{ id: 'fixture', integrationID: 'fixture-provider', label: 'Synthetic account', active: true }] });
        assert.equal(JSON.stringify(result).includes('synthetic-never-a-real-secret'), false);
        assert.deepEqual(fs.readFileSync(file), before);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});

test('missing native credential store does not create directories or databases', () => {
    const directory = path.join(os.tmpdir(), 'studio-missing-credentials-' + Date.now());
    assert.equal(readNativeCredentialMetadata([directory], DatabaseSync), null);
    assert.equal(fs.existsSync(directory), false);
});
