const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
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

// ---------------------------------------------------------------------------
// Todo 8: omo profiles block semantics. profile-manager.js captures
// OMO_CONFIG_PATH = path.join(os.homedir(), '.omo', 'omo.jsonc') at require
// time, so every sandboxed case reloads the module fresh with process.env.HOME
// pointed at a temp home. os.homedir() reads $HOME live (verified on Node 24),
// but the PATH constant is frozen at load — hence the require.cache clearing.
// ---------------------------------------------------------------------------

function makeTempHome(t) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-test-'));
    fs.mkdirSync(path.join(home, '.omo'), { recursive: true });
    t.after(() => {
        try {
            fs.rmSync(home, { recursive: true, force: true });
        } catch {
            // no-op
        }
    });
    return home;
}

function writeOmo(home, doc) {
    const file = path.join(home, '.omo', 'omo.jsonc');
    fs.writeFileSync(file, JSON.stringify(doc, null, 2), 'utf8');
    return file;
}

// Hermetic reload: active-source vars (OMO_PROFILE / OCX_PROFILE /
// OPENCODE_CONFIG_DIR) are cleared unless explicitly provided, then the module
// is re-required so OMO_CONFIG_PATH resolves under the temp HOME.
function loadProfileManager(home, env = {}) {
    for (const key of ['HOME', 'OMO_PROFILE', 'OCX_PROFILE', 'OPENCODE_CONFIG_DIR']) {
        if (key in env) process.env[key] = env[key];
        else delete process.env[key];
    }
    process.env.HOME = home;
    for (const mod of ['./profile-manager', './lib/config-providers']) {
        delete require.cache[require.resolve(path.join(__dirname, mod))];
    }
    return require('./profile-manager');
}

test('safeName rejects non-string values', () => {
    for (const bad of [undefined, 123, true, ['x'], {}]) {
        assert.throws(() => safeName(bad), /Invalid profile name/, `should reject ${JSON.stringify(bad)}`);
    }
});

test('listProfiles reports empty state when no profiles exist', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { '[opencode]': {} });
    const pm = loadProfileManager(home);
    assert.deepStrictEqual(pm.listProfiles(), { profiles: [], active: null });
});

test('createProfile writes the profile block into omo.jsonc', (t) => {
    const home = makeTempHome(t);
    const omoFile = writeOmo(home, { '[opencode]': {} });
    const pm = loadProfileManager(home);
    assert.deepStrictEqual(pm.createProfile('work'), { success: true });
    const parsed = JSON.parse(fs.readFileSync(omoFile, 'utf8'));
    assert.ok(parsed.profiles && parsed.profiles.work, 'profiles.work should exist');
    assert.deepStrictEqual(parsed.profiles.work, { '[opencode]': {} });
    assert.deepStrictEqual(pm.listProfiles().profiles, ['work']);
});

test('deleteProfile rejects deleting the active profile', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { profiles: { work: { '[opencode]': {} } } });
    const pm = loadProfileManager(home, { OMO_PROFILE: 'work' });
    assert.throws(() => pm.deleteProfile('work'), /Cannot delete active profile/);
    assert.deepStrictEqual(pm.listProfiles().profiles, ['work'], 'profile survives the rejected delete');
});

test('deleteProfile removes a non-active profile', (t) => {
    const home = makeTempHome(t);
    const omoFile = writeOmo(home, { profiles: { work: { '[opencode]': {} } } });
    const pm = loadProfileManager(home, { OMO_PROFILE: 'personal' });
    assert.deepStrictEqual(pm.deleteProfile('work'), { success: true, removed: true });
    const parsed = JSON.parse(fs.readFileSync(omoFile, 'utf8'));
    assert.ok(!parsed.profiles || !parsed.profiles.work, 'source profile deleted');
});

test('activateProfile bakes [opencode], deletes source block, touches no other fs path', (t) => {
    const home = makeTempHome(t);
    const omoFile = writeOmo(home, {
        '[opencode]': { model: 'old', nested: { keep: 1 } },
        profiles: { work: { '[opencode]': { model: 'new', temperature: 0.7, nested: { extra: true } } } }
    });
    // AC8: unrelated filesystem paths that activation must NOT delete/rename
    // (a real directory here — NOT a symlink, which the old implementation
    // would have rmSync'd; bake-only must leave it byte-identical).
    const configDir = path.join(home, '.config', 'opencode');
    const configFile = path.join(configDir, 'opencode.jsonc');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configFile, '{"schema":"x"}', 'utf8');
    const notesFile = path.join(home, 'notes.txt');
    fs.writeFileSync(notesFile, 'keep me', 'utf8');

    const pm = loadProfileManager(home);
    assert.deepStrictEqual(pm.activateProfile('work'), { success: true, message: '已激活 work' });

    const parsed = JSON.parse(fs.readFileSync(omoFile, 'utf8'));
    assert.strictEqual(parsed['[opencode]'].model, 'new', 'profile [opencode] baked into top-level');
    assert.strictEqual(parsed['[opencode]'].temperature, 0.7, 'non-conflicting profile key copied');
    assert.deepStrictEqual(parsed['[opencode]'].nested, { keep: 1, extra: true }, 'deep merge preserves unknown keys');
    assert.ok(!parsed.profiles || !parsed.profiles.work, 'source profile block deleted');
    // AC8: no other filesystem path deleted/renamed
    assert.strictEqual(fs.readFileSync(configFile, 'utf8'), '{"schema":"x"}');
    assert.ok(fs.existsSync(configDir) && fs.statSync(configDir).isDirectory(), 'config dir still exists');
    assert.strictEqual(fs.readFileSync(notesFile, 'utf8'), 'keep me');
    assert.deepStrictEqual(pm.listProfiles().profiles, []);
});

test('active resolves from OMO_PROFILE (MINOR-8 source #1)', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { profiles: { work: { '[opencode]': {} } } });
    const pm = loadProfileManager(home, { OMO_PROFILE: 'work' });
    assert.strictEqual(pm.listProfiles().active, 'work');
});

test('active resolves from OCX_PROFILE when OMO_PROFILE unset (MINOR-8 source #2)', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { profiles: { personal: { '[opencode]': {} } } });
    const pm = loadProfileManager(home, { OCX_PROFILE: 'personal' });
    assert.strictEqual(pm.listProfiles().active, 'personal');
});

test('active resolves from OPENCODE_CONFIG_DIR /profiles/<name> suffix (MINOR-8 source #3)', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { profiles: { work: { '[opencode]': {} } } });
    const pm = loadProfileManager(home, { OPENCODE_CONFIG_DIR: '/home/u/.config/opencode/profiles/work' });
    assert.strictEqual(pm.listProfiles().active, 'work');
});

test('active precedence OMO_PROFILE > OCX_PROFILE > OPENCODE_CONFIG_DIR (MINOR-8)', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, {
        profiles: { a: { '[opencode]': {} }, b: { '[opencode]': {} }, c: { '[opencode]': {} } }
    });
    let pm = loadProfileManager(home, {
        OMO_PROFILE: 'a',
        OCX_PROFILE: 'b',
        OPENCODE_CONFIG_DIR: '/x/profiles/c'
    });
    assert.strictEqual(pm.listProfiles().active, 'a');
    pm = loadProfileManager(home, { OCX_PROFILE: 'b', OPENCODE_CONFIG_DIR: '/x/profiles/c' });
    assert.strictEqual(pm.listProfiles().active, 'b');
    pm = loadProfileManager(home, { OPENCODE_CONFIG_DIR: '/x/profiles/c' });
    assert.strictEqual(pm.listProfiles().active, 'c');
});

test('activateProfile rejects non-[opencode] top-level keys and preserves profile + file (M-C)', (t) => {
    const home = makeTempHome(t);
    const omoFile = writeOmo(home, {
        '[opencode]': { model: 'old' },
        profiles: { work: { agents: { x: 1 }, '[opencode]': { model: 'new' } } }
    });
    const before = fs.readFileSync(omoFile, 'utf8');
    const pm = loadProfileManager(home);
    assert.throws(() => pm.activateProfile('work'), /无法 bake|agents/);
    assert.strictEqual(fs.readFileSync(omoFile, 'utf8'), before, 'file byte-identical after reject');
    assert.deepStrictEqual(pm.listProfiles().profiles, ['work'], 'profile still present');
});
