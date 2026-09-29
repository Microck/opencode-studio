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

const { parseJsonText } = require('./lib/config-providers');

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
    assert.deepStrictEqual(pm.listProfiles(), { profiles: [], legacy: [], active: null });
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

// ---------------------------------------------------------------------------
// Task 7b regression fix: legacy profile dirs (pre-Todo-7 symlink mechanism)
// must surface in listProfiles() as READ-ONLY display entries. They are never
// deleted/renamed/activated — only omo.jsonc blocks are operable.
// ---------------------------------------------------------------------------

function makeLegacyDirs(home, names) {
    const dir = path.join(home, '.config', 'opencode-profiles');
    for (const name of names) {
        fs.mkdirSync(path.join(dir, name), { recursive: true });
    }
    return dir;
}

function writeLegacyConfig(dir, name) {
    const file = path.join(dir, name, 'opencode.json');
    fs.writeFileSync(file, '{"schema":"legacy"}', 'utf8');
    return file;
}

test('listProfiles merges omo blocks and legacy dirs, omo wins on collision', (t) => {
    const home = makeTempHome(t);
    // 'work' exists BOTH as an omo block and a legacy dir -> counted once, omo wins.
    writeOmo(home, { profiles: { work: { '[opencode]': {} }, new: { '[opencode]': {} } } });
    const legacyDir = makeLegacyDirs(home, ['work', 'legacyA', 'legacyB', '.omo', 'backup-2026']);
    fs.writeFileSync(path.join(legacyDir, 'draft.zip'), 'not a profile', 'utf8');
    for (const name of ['work', 'legacyA', 'legacyB']) {
        writeLegacyConfig(legacyDir, name);
    }

    const pm = loadProfileManager(home);
    const result = pm.listProfiles();
    assert.deepStrictEqual(result.profiles, ['work', 'new', 'legacyA', 'legacyB']);
    assert.deepStrictEqual(result.legacy, ['legacyA', 'legacyB']);
});

test('legacy-only dirs listed even when no omo.jsonc profiles exist', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { '[opencode]': {} });
    const legacyDir = makeLegacyDirs(home, ['default', 'deepseek']);
    for (const name of ['default', 'deepseek']) {
        writeLegacyConfig(legacyDir, name);
    }
    const pm = loadProfileManager(home);
    const result = pm.listProfiles();
    assert.deepStrictEqual(result.profiles, ['deepseek', 'default']);
    assert.deepStrictEqual(result.legacy, ['deepseek', 'default']);
    assert.strictEqual(result.active, null);
});

test('deleteProfile refuses legacy-only names and leaves the dir intact', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { '[opencode]': {} });
    const legacyDir = makeLegacyDirs(home, ['legacyA']);
    const configFile = writeLegacyConfig(legacyDir, 'legacyA');

    const pm = loadProfileManager(home, { OMO_PROFILE: 'other' });
    assert.throws(() => pm.deleteProfile('legacyA'), /legacy 目录，只读/);
    assert.ok(fs.existsSync(configFile), 'legacy config file survives refused delete');
    assert.strictEqual(fs.readFileSync(configFile, 'utf8'), '{"schema":"legacy"}');
    assert.deepStrictEqual(pm.listProfiles().legacy, ['legacyA'], 'still listed after refused delete');
});

test('activateProfile on a legacy-only name without omo config throws import error, dir intact', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { '[opencode]': {} });
    const legacyDir = makeLegacyDirs(home, ['legacyA']);
    const configFile = writeLegacyConfig(legacyDir, 'legacyA');

    const pm = loadProfileManager(home);
    assert.throws(() => pm.activateProfile('legacyA'), /没有可导入的 omo 配置/);
    assert.ok(fs.existsSync(configFile), 'legacy config file survives failed import');
    assert.strictEqual(fs.readFileSync(configFile, 'utf8'), '{"schema":"legacy"}');
    assert.deepStrictEqual(pm.listProfiles().legacy, ['legacyA'], 'still legacy-only after failed import');
});

test('legacy dirs are never deleted by any operation (AC8-style guard)', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { profiles: { work: { '[opencode]': {} } } });
    const legacyDir = makeLegacyDirs(home, ['work', 'keep-me']);
    // 'work' is also a legacy dir on disk — deleting the omo block must NOT
    // touch the directory; 'keep-me' is legacy-only and must survive everything.
    writeLegacyConfig(legacyDir, 'work');
    const keepFile = writeLegacyConfig(legacyDir, 'keep-me');

    const pm = loadProfileManager(home, { OMO_PROFILE: 'other' });
    assert.deepStrictEqual(pm.deleteProfile('work'), { success: true, removed: true });
    assert.ok(fs.existsSync(path.join(legacyDir, 'work')), 'legacy dir not deleted by omo block delete');
    assert.ok(fs.existsSync(keepFile), 'legacy-only dir intact after omo block delete');
    assert.deepStrictEqual(pm.listProfiles().legacy, ['keep-me', 'work'], 'both still listed as legacy');
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

// ---------------------------------------------------------------------------
// Task 7c: legacy profile activation. importLegacyProfile reads a legacy dir's
// omo config (omo.jsonc [opencode] block, or the bare oh-my-openagent.json
// block) into profiles.<name>, and activateProfile auto-imports legacy-only
// names before baking. Legacy dirs are READ-ONLY — never deleted or renamed.
// ---------------------------------------------------------------------------

const LEGACY_SCHEMA_URL = 'https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/omo.schema.json';

function writeLegacyOmoJsonc(legacyDir, name, block) {
    const file = path.join(legacyDir, name, 'omo.jsonc');
    const doc = JSON.stringify({ $schema: LEGACY_SCHEMA_URL, '[opencode]': block }, null, 2);
    fs.writeFileSync(file, doc, 'utf8');
    return { file, doc };
}

function writeLegacyBareJson(legacyDir, name, block) {
    const file = path.join(legacyDir, name, 'oh-my-openagent.json');
    const doc = JSON.stringify(block, null, 2);
    fs.writeFileSync(file, doc, 'utf8');
    return { file, doc };
}

test('importLegacyProfile imports the [opencode] block, preserving header and $schema', (t) => {
    const home = makeTempHome(t);
    const omoFile = path.join(home, '.omo', 'omo.jsonc');
    fs.writeFileSync(omoFile, `// OMO configuration
{
  "$schema": "${LEGACY_SCHEMA_URL}",
  "_migrations": ["m1"],
  "[opencode]": { "model": "old" }
}
`, 'utf8');
    const legacyDir = makeLegacyDirs(home, ['deepseek']);
    const legacy = writeLegacyOmoJsonc(legacyDir, 'deepseek', {
        agents: { atlas: { enabled: true, model: 'deepseek/deepseek-v4-pro' } },
        sisyphus_agent: { replace_plan: true }
    });

    const pm = loadProfileManager(home);
    assert.deepStrictEqual(pm.importLegacyProfile('deepseek'), { success: true, imported: true, name: 'deepseek' });

    const raw = fs.readFileSync(omoFile, 'utf8');
    assert.ok(raw.startsWith('// OMO configuration\n'), 'comment header preserved');
    assert.ok(raw.includes('omo.schema.json'), '$schema preserved');
    assert.ok(raw.includes('_migrations'), '_migrations preserved');
    const parsed = parseJsonText(raw);
    assert.strictEqual(parsed['[opencode]'].model, 'old', 'top-level [opencode] untouched');
    assert.strictEqual(parsed.profiles.deepseek['[opencode]'].agents.atlas.model, 'deepseek/deepseek-v4-pro', 'agents imported');
    assert.deepStrictEqual(pm.listProfiles().profiles, ['deepseek'], 'now an omo profile');
    assert.deepStrictEqual(pm.listProfiles().legacy, [], 'no longer legacy-only');
    assert.strictEqual(fs.readFileSync(legacy.file, 'utf8'), legacy.doc, 'legacy source file byte-identical');
});

test('importLegacyProfile reads the bare oh-my-openagent.json block as fallback', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { '[opencode]': {} });
    const legacyDir = makeLegacyDirs(home, ['default']);
    const legacy = writeLegacyBareJson(legacyDir, 'default', { model: 'gpt-5', agents: { atlas: { enabled: true } } });

    const pm = loadProfileManager(home);
    assert.deepStrictEqual(pm.importLegacyProfile('default'), { success: true, imported: true, name: 'default' });
    const parsed = JSON.parse(fs.readFileSync(path.join(home, '.omo', 'omo.jsonc'), 'utf8'));
    assert.strictEqual(parsed.profiles.default['[opencode]'].model, 'gpt-5', 'whole bare doc imported as block');
    assert.strictEqual(parsed.profiles.default['[opencode]'].agents.atlas.enabled, true);
    assert.deepStrictEqual(pm.listProfiles().profiles, ['default']);
    assert.strictEqual(fs.readFileSync(legacy.file, 'utf8'), legacy.doc, 'legacy file untouched');
});

test('importLegacyProfile throws on missing/invalid legacy dirs and artifact names', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { '[opencode]': {} });
    const legacyDir = makeLegacyDirs(home, ['backup-2026', 'empty']);

    const pm = loadProfileManager(home);
    assert.throws(() => pm.importLegacyProfile('backup-2026'), /没有可导入的 omo 配置/, 'artifact dir rejected');
    writeLegacyConfig(legacyDir, 'empty');
    assert.throws(() => pm.importLegacyProfile('empty'), /没有可导入的 omo 配置/, 'dir with only opencode.json rejected');
    assert.throws(() => pm.importLegacyProfile('missing-dir'), /没有可导入的 omo 配置/, 'no dir at all rejected');
    assert.deepStrictEqual(pm.listProfiles().legacy, ['empty'], 'nothing imported (backup-* is an artifact name)');
});

test('importLegacyProfile throws when the omo profile already exists', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { profiles: { work: { '[opencode]': { model: 'x' } } } });
    const legacyDir = makeLegacyDirs(home, ['work']);
    writeLegacyOmoJsonc(legacyDir, 'work', { model: 'new' });

    const pm = loadProfileManager(home);
    assert.throws(() => pm.importLegacyProfile('work'), /已存在，请先删除或直接切换/);
    const parsed = JSON.parse(fs.readFileSync(path.join(home, '.omo', 'omo.jsonc'), 'utf8'));
    assert.strictEqual(parsed.profiles.work['[opencode]'].model, 'x', 'existing profile untouched');
});

test('importLegacyProfile throws on an empty [opencode] block', (t) => {
    const home = makeTempHome(t);
    writeOmo(home, { '[opencode]': {} });
    const legacyDir = makeLegacyDirs(home, ['empty']);
    writeLegacyOmoJsonc(legacyDir, 'empty', {});
    const pm = loadProfileManager(home);
    assert.throws(() => pm.importLegacyProfile('empty'), /没有可导入的 omo 配置|为空/);
    const parsed = JSON.parse(fs.readFileSync(path.join(home, '.omo', 'omo.jsonc'), 'utf8'));
    assert.ok(!parsed.profiles || Object.keys(parsed.profiles).length === 0, 'no profile imported');
    assert.deepStrictEqual(pm.listProfiles().legacy, ['empty'], 'still legacy-only');
});

test('activateProfile auto-imports a legacy-only name, bakes it, legacy dir untouched', (t) => {
    const home = makeTempHome(t);
    const omoFile = writeOmo(home, {
        '[opencode]': { model: 'old', nested: { keep: 1 } }
    });
    const legacyDir = makeLegacyDirs(home, ['deepseek']);
    const legacy = writeLegacyOmoJsonc(legacyDir, 'deepseek', {
        agents: { atlas: { enabled: true, model: 'deepseek/deepseek-v4-pro' } },
        sisyphus_agent: { replace_plan: true }
    });

    const pm = loadProfileManager(home);
    assert.deepStrictEqual(pm.activateProfile('deepseek'), { success: true, message: '已激活 deepseek' });

    const parsed = JSON.parse(fs.readFileSync(omoFile, 'utf8'));
    assert.strictEqual(parsed['[opencode]'].model, 'old', 'non-conflicting top-level key preserved');
    assert.strictEqual(parsed['[opencode]'].agents.atlas.model, 'deepseek/deepseek-v4-pro', 'agents merged into top-level');
    assert.strictEqual(parsed['[opencode]'].sisyphus_agent.replace_plan, true, 'sisyphus_agent merged');
    assert.ok(!parsed.profiles || !parsed.profiles.deepseek, 'imported profile removed after bake');
    assert.strictEqual(fs.readFileSync(legacy.file, 'utf8'), legacy.doc, 'legacy dir file byte-identical');
    assert.deepStrictEqual(pm.listProfiles().legacy, ['deepseek'], 'dir still listed as legacy (untouched)');
});
