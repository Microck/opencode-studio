const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function readCliConfig(file) {
    const exists = fs.existsSync(file);
    const content = exists ? fs.readFileSync(file, 'utf8') : '{}\n';
    return { content, exists, revision: exists ? crypto.createHash('sha256').update(content).digest('hex') : null };
}
function writeCliConfig(file, payload, atomicWrite) {
    if (!payload || typeof payload.content !== 'string' || !Object.hasOwn(payload, 'revision')) {
        throw Object.assign(new Error('Content and revision are required'), { statusCode: 400 });
    }
    let parsed;
    try { parsed = JSON.parse(payload.content); } catch {
        throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 });
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw Object.assign(new Error('CLI configuration must be a JSON object'), { statusCode: 400 });
    }
    if (readCliConfig(file).revision !== payload.revision) {
        throw Object.assign(new Error('CLI configuration changed on disk. Reload before saving.'), { statusCode: 409 });
    }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    atomicWrite(file, payload.content);
    return readCliConfig(file);
}
module.exports = { readCliConfig, writeCliConfig };
