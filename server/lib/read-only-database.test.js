const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { openReadOnlyDatabase } = require('./read-only-database');

test('read-only database rejects writes and cannot create a missing database', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-readonly-db-'));
    const file = path.join(directory, 'fixture.db');
    let reader;
    try {
        const setup = new DatabaseSync(file);
        setup.exec('CREATE TABLE fixture(value TEXT); INSERT INTO fixture VALUES (\'keep\')');
        setup.close();
        reader = openReadOnlyDatabase(DatabaseSync, file);
        assert.equal(reader.prepare('SELECT value FROM fixture').get().value, 'keep');
        assert.throws(() => reader.exec("INSERT INTO fixture VALUES ('must fail')"), /readonly|read-only/i);
        assert.equal(reader.prepare('SELECT count(*) AS count FROM fixture').get().count, 1);
        const missing = path.join(directory, 'missing.db');
        assert.throws(() => openReadOnlyDatabase(DatabaseSync, missing));
        assert.equal(fs.existsSync(missing), false);
    } finally {
        if (reader) reader.close();
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
