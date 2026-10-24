const fs = require('node:fs');
const path = require('node:path');
const { openReadOnlyDatabase } = require('./read-only-database');

// Metadata only. Never select credential.value or rewrite OpenCode's database.
function readNativeCredentialMetadata(dataDirectories, DatabaseSync) {
    if (!DatabaseSync) return null;
    for (const directory of dataDirectories) {
        const file = path.join(directory, 'opencode.db');
        if (!fs.existsSync(file)) continue;
        let db;
        try {
            db = openReadOnlyDatabase(DatabaseSync, file);
            if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='credential'").get()) continue;
            const credentials = db.prepare('SELECT id, integration_id, label, active FROM credential ORDER BY label, id').all()
                .map(row => ({ id: row.id, integrationID: row.integration_id, label: row.label, active: !!row.active }));
            return { credentials, storage: 'opencode-v2-database' };
        } finally {
            if (db) db.close();
        }
    }
    return null;
}
module.exports = { readNativeCredentialMetadata };
