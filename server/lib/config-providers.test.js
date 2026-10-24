const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const jsoncParser = require('jsonc-parser');

const providers = require('./config-providers.js');

const temporaryDirectories = [];
const makeTempDir = () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-server-test-'));
    temporaryDirectories.push(dir);
    return dir;
};
after(() => temporaryDirectories.forEach(dir => fs.rmSync(dir, { recursive: true, force: true })));

describe('config provider seams', () => {
    it('normalizes path inventories and keeps precedence order', () => {
        const tempDir = makeTempDir();
        const detected = path.join(tempDir, 'detected.json');
        const manual = path.join(tempDir, 'manual.json');
        const current = path.join(tempDir, 'current.json');

        const inventory = providers.createPathInventory({
            candidates: [path.join(tempDir, '.', 'detected.json'), detected, '', null, manual],
            detected,
            manual,
            current: path.join(tempDir, '.', 'current.json')
        });

        assert.deepEqual(inventory.candidates, [detected, manual]);
        assert.equal(inventory.detected, detected);
        assert.equal(inventory.manual, manual);
        assert.equal(inventory.current, current);
    });

    it('parses jsonc comments and trailing commas by default', () => {
        const text = ['{', '  // comment', '  "name": "demo",', '  "items": [1, 2,],', '}'].join('\n');

        assert.deepEqual(providers.parseJsonText(text), { name: 'demo', items: [1, 2] });
    });

    it('loads jsonc config files with comments and trailing commas', () => {
        const tempDir = makeTempDir();
        const configPath = path.join(tempDir, 'opencode.jsonc');
        fs.writeFileSync(configPath, [
            '{',
            '  // OpenCode accepts comments in its JSONC config.',
            '  "provider": {',
            '    "ascend": {',
            '      "reasoning": true,',
            '    },',
            '  },',
            '}',
        ].join('\n'));

        assert.deepEqual(providers.loadConfigFileSync(configPath), {
            provider: { ascend: { reasoning: true } },
        });
    });

    it('parses malformed json with injected jsonc parser', () => {
        assert.throws(() => providers.parseJsonText('{"name":', {}), SyntaxError);

        const text = ['{', '  // comment', '  "name": "demo",', '  "items": [1, 2,],', '}'].join('\n');

        const errors = [];
        const parsed = providers.parseJsonText(text, {
            parseJsonc: (input) => {
                const jsoncErrors = [];
                const value = jsoncParser.parse(input, jsoncErrors, {
                    allowTrailingComma: true,
                    disallowComments: false
                });
                errors.push(...jsoncErrors);
                return value;
            }
        });

        assert.deepEqual(parsed, { name: 'demo', items: [1, 2] });
        assert.deepEqual(errors, []);
    });

    it('preserves unknown keys as raw text through atomic writes', () => {
        const tempDir = makeTempDir();
        const targetPath = path.join(tempDir, 'config.json');
        const content = '{"known":true,"unknown":"kept","nested":{"extra":1}}';

        providers.writeConfigTextAtomicSync(targetPath, content);

        assert.equal(fs.readFileSync(targetPath, 'utf8'), content);
        assert.deepEqual(fs.readdirSync(tempDir).sort(), ['config.json']);
    });

    it('writes atomically into a temp directory and leaves no temp files behind', () => {
        const tempDir = makeTempDir();
        const targetPath = path.join(tempDir, 'atomic.json');

        providers.atomicWriteTextSync(targetPath, '{"ok":true}');

        assert.equal(fs.readFileSync(targetPath, 'utf8'), '{"ok":true}');
        assert.deepEqual(fs.readdirSync(tempDir), ['atomic.json']);
    });

    it('creates contracts for supported providers and rejects unsupported ids', () => {
        const contract = providers.createProviderContract(providers.PROVIDER_IDS.OPENCODE);

        assert.equal(contract.id, 'opencode');
        assert.deepEqual(contract.capabilities, {
            canDetect: true,
            canLoad: true,
            canValidate: true,
            canSave: true,
            canCreate: true,
            canImportConfig: true,
            canExportConfig: true
        });
        assert.throws(() => providers.createProviderContract('unknown-provider'), { message: 'Unsupported provider id: unknown-provider' });
    });
});

describe('provider rules detection', () => {
    it('extracts basename across slash styles for cross-platform suffix checks', () => {
        assert.equal(providers.getPathBasenameAnySeparator('/tmp/a/slim.jsonc'), 'slim.jsonc');
        assert.equal(providers.getPathBasenameAnySeparator('C:\\temp\\a\\slim.json'), 'slim.json');
    });

    it('returns all provider records with expected metadata fields', () => {
        const tempDir = makeTempDir();
        fs.writeFileSync(path.join(tempDir, 'opencode.json'), '{"name":"opencode"}');
        fs.writeFileSync(path.join(tempDir, 'oh-my-openagent.json'), '{"name":"agent"}');
        fs.writeFileSync(path.join(tempDir, 'oh-my-opencode-slim.json'), '{"name":"slim"}');
        fs.writeFileSync(path.join(tempDir, 'tui.json'), '{"theme":"dark"}');

        const detected = providers.detectProviders({ roots: [tempDir] });

        assert.deepEqual(detected.map((provider) => provider.id), [
            providers.PROVIDER_IDS.OPENCODE,
            providers.PROVIDER_IDS.OH_MY_OPENAGENT,
            providers.PROVIDER_IDS.OH_MY_OPENCODE_SLIM
        ]);
        for (const provider of detected) {
            assert.ok(Object.hasOwn(provider, 'id'));
            assert.ok(Object.hasOwn(provider, 'displayName'));
            assert.ok(Object.hasOwn(provider, 'paths'));
            assert.ok(Object.hasOwn(provider, 'exists'));
            assert.ok(Object.hasOwn(provider, 'activePath'));
            assert.ok(Object.hasOwn(provider, 'capabilities'));
            assert.ok(Object.hasOwn(provider, 'diagnostics'));
        }
    });

    it('preserves openagent alias path and warns on duplicate alias configs', () => {
        const tempDir = makeTempDir();
        const primary = path.join(tempDir, 'oh-my-openagent.jsonc');
        const legacy = path.join(tempDir, 'oh-my-opencode.json');
        fs.writeFileSync(primary, '{"a":1}');
        fs.writeFileSync(legacy, '{"a":2}');

        const openAgent = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OH_MY_OPENAGENT);

        assert.equal(openAgent.activePath, primary);
        assert.equal(openAgent.diagnostics.some((d) => d.code === 'OPENAGENT_ALIAS_DUPLICATE'), true);
        const duplicateDiagnostic = openAgent.diagnostics.find((d) => d.code === 'OPENAGENT_ALIAS_DUPLICATE');
        assert.deepEqual(duplicateDiagnostic.details.paths, [primary, legacy]);
    });

    it('creates safe openagent profile paths next to active config', () => {
        const tempDir = makeTempDir();
        const active = path.join(tempDir, 'oh-my-openagent.json');
        fs.writeFileSync(active, '{"a":1}');

        const openAgent = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OH_MY_OPENAGENT);

        assert.equal(providers.getOpenAgentProfileDir(openAgent), path.join(tempDir, providers.OPENAGENT_PROFILE_DIRNAME));
        assert.equal(providers.getOpenAgentDefaultActivePath(openAgent), active);
        assert.equal(providers.sanitizeConfigProfileName('Work Config!.json'), 'Work-Config');

        const profilePath = providers.getOpenAgentProfilePath(openAgent, 'Work Config!');
        assert.equal(profilePath, path.join(tempDir, providers.OPENAGENT_PROFILE_DIRNAME, 'Work-Config.json'));
        assert.equal(providers.isOpenAgentProfilePath(openAgent, profilePath), true);
        assert.equal(providers.isOpenAgentProfilePath(openAgent, path.join(tempDir, 'other.json')), false);
    });

    it('lists only json openagent profile files', () => {
        const tempDir = makeTempDir();
        const active = path.join(tempDir, 'oh-my-openagent.json');
        fs.writeFileSync(active, '{"a":1}');

        const openAgent = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OH_MY_OPENAGENT);
        const profileDir = providers.getOpenAgentProfileDir(openAgent);
        fs.mkdirSync(profileDir, { recursive: true });
        fs.writeFileSync(path.join(profileDir, 'a.json'), '{}');
        fs.writeFileSync(path.join(profileDir, 'b.jsonc'), '{}');
        fs.writeFileSync(path.join(profileDir, 'notes.txt'), '{}');

        assert.deepEqual(providers.listOpenAgentProfilePaths(openAgent), [
            path.join(profileDir, 'a.json'),
            path.join(profileDir, 'b.jsonc')
        ]);
    });

    it('warns with exact duplicate paths when multiple provider configs exist', () => {
        const rootA = makeTempDir();
        const rootB = makeTempDir();
        const pathA = path.join(rootA, 'opencode.json');
        const pathB = path.join(rootB, 'opencode.jsonc');
        fs.writeFileSync(pathA, '{"a":1}');
        fs.writeFileSync(pathB, '{"a":2}');

        const opencode = providers.detectProviders({ roots: [rootA, rootB] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OPENCODE);

        const duplicateDiagnostic = opencode.diagnostics.find((d) => d.code === 'DUPLICATE_PROVIDER_CONFIG');
        assert.ok(duplicateDiagnostic);
        assert.deepEqual(duplicateDiagnostic.details.paths, [pathA, pathB]);
    });

    it('reports malformed provider json using jsonc parser diagnostics', () => {
        const tempDir = makeTempDir();
        const malformedPath = path.join(tempDir, 'opencode.json');
        fs.writeFileSync(malformedPath, '{"name":');

        const opencode = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OPENCODE);

        const malformedDiagnostic = opencode.diagnostics.find((d) => d.code === 'MALFORMED_PROVIDER_CONFIG');
        assert.ok(malformedDiagnostic);
        assert.equal(malformedDiagnostic.details.path, malformedPath);
    });

    it('reports missing slim companion tui config', () => {
        const tempDir = makeTempDir();
        const slimPath = path.join(tempDir, 'oh-my-opencode-slim.json');
        fs.writeFileSync(slimPath, '{"slim":true}');

        const slim = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OH_MY_OPENCODE_SLIM);

        const missingDiagnostic = slim.diagnostics.find((d) => d.code === 'SLIM_TUI_CONFIG_MISSING');
        assert.ok(missingDiagnostic);
        assert.equal(missingDiagnostic.details.path, slimPath);
    });

    it('reports malformed slim companion tui config', () => {
        const tempDir = makeTempDir();
        fs.writeFileSync(path.join(tempDir, 'oh-my-opencode-slim.json'), '{"slim":true}');
        const malformedTuiPath = path.join(tempDir, 'tui.jsonc');
        fs.writeFileSync(malformedTuiPath, '{"theme":');

        const slim = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OH_MY_OPENCODE_SLIM);

        const malformedDiagnostic = slim.diagnostics.find((d) => d.code === 'SLIM_TUI_CONFIG_MALFORMED');
        assert.ok(malformedDiagnostic);
        assert.equal(malformedDiagnostic.details.path, malformedTuiPath);
    });
});

describe('provider write/import helper semantics', () => {
    it('deep merges object payloads while preserving unknown keys', () => {
        const existing = {
            name: 'demo',
            plugins: { keep: true, nested: { original: 1 } },
            unknownTopLevel: { keep: true }
        };
        const incoming = {
            plugins: { nested: { original: 2, added: true } },
            known: 'updated'
        };

        const merged = providers.deepMergePreservingUnknown(existing, incoming);

        assert.deepEqual(merged, {
            name: 'demo',
            plugins: { keep: true, nested: { original: 2, added: true } },
            unknownTopLevel: { keep: true },
            known: 'updated'
        });
    });

    it('extracts expected revision hash from string or object payloads', () => {
        assert.equal(providers.getExpectedRevisionHash({ expectedRevision: 'abc' }), 'abc');
        assert.equal(providers.getExpectedRevisionHash({ expectedRevision: { hash: 'def' } }), 'def');
        assert.equal(providers.getExpectedRevisionHash({ revision: { hash: 'ghi' } }), 'ghi');
        assert.equal(providers.getExpectedRevisionHash({}), null);
    });

    it('flags stale revisions when expected hash does not match current hash', () => {
        assert.equal(providers.isStaleRevision({ expectedHash: 'abc', currentRevision: { hash: 'abc' } }), false);
        assert.equal(providers.isStaleRevision({ expectedHash: 'abc', currentRevision: { hash: 'zzz' } }), true);
        assert.equal(providers.isStaleRevision({ expectedHash: 'abc', currentRevision: null }), true);
        assert.equal(providers.isStaleRevision({ expectedHash: null, currentRevision: null }), false);
    });

    it('accepts matching provider import payload and rejects mismatch', () => {
        const okMatch = providers.validateImportProviderMatch({
            routeProviderId: providers.PROVIDER_IDS.OPENCODE,
            payload: { providerId: providers.PROVIDER_IDS.OPENCODE }
        });
        assert.equal(okMatch.ok, true);

        const mismatch = providers.validateImportProviderMatch({
            routeProviderId: providers.PROVIDER_IDS.OPENCODE,
            payload: { id: providers.PROVIDER_IDS.OH_MY_OPENAGENT }
        });
        assert.equal(mismatch.ok, false);
        assert.equal(mismatch.diagnostic.code, 'PROVIDER_MISMATCH');
    });

    it('creates only missing file and never overwrites existing file', () => {
        const tempDir = makeTempDir();
        const targetPath = path.join(tempDir, 'safe-create.jsonc');
        const initialRaw = '{\n  // initial\n  "a": 1,\n}\n';
        const secondRaw = '{"a":2}';

        const created = providers.createFileIfMissingSync(targetPath, initialRaw, 'utf8');
        assert.deepEqual(created, { created: true, path: targetPath });
        assert.equal(fs.readFileSync(targetPath, 'utf8'), initialRaw);

        const existing = providers.createFileIfMissingSync(targetPath, secondRaw, 'utf8');
        assert.deepEqual(existing, { created: false, path: targetPath });
        assert.equal(fs.readFileSync(targetPath, 'utf8'), initialRaw);
    });

    it('requires explicit write path when provider has no active path', () => {
        const tempDir = makeTempDir();
        const candidatePath = path.join(tempDir, 'opencode.json');
        const provider = {
            id: providers.PROVIDER_IDS.OPENCODE,
            paths: [candidatePath],
            activePath: null
        };

        const noPath = providers.resolveProviderWritePath({ provider, requestedPath: undefined });
        assert.equal(noPath.ok, false);
        assert.equal(noPath.diagnostics[0].code, 'PROVIDER_PATH_REQUIRED');

        const withAllowedPath = providers.resolveProviderWritePath({ provider, requestedPath: candidatePath });
        assert.deepEqual(withAllowedPath, { ok: true, path: candidatePath });
    });
});
