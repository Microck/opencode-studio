import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import * as jsoncParser from 'jsonc-parser';

import providers from './config-providers.js';

const makeTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-server-test-'));

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

        expect(inventory.candidates).toEqual([detected, manual]);
        expect(inventory.detected).toBe(detected);
        expect(inventory.manual).toBe(manual);
        expect(inventory.current).toBe(current);
    });

    it('parses jsonc comments and trailing commas by default', () => {
        const text = ['{', '  // comment', '  "name": "demo",', '  "items": [1, 2,],', '}'].join('\n');

        expect(providers.parseJsonText(text)).toEqual({ name: 'demo', items: [1, 2] });
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

        expect(providers.loadConfigFileSync(configPath)).toEqual({
            provider: { ascend: { reasoning: true } },
        });
    });

    it('parses malformed json with injected jsonc parser', () => {
        expect(() => providers.parseJsonText('{"name":', {})).toThrow(SyntaxError);

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

        expect(parsed).toEqual({ name: 'demo', items: [1, 2] });
        expect(errors).toEqual([]);
    });

    it('preserves unknown keys as raw text through atomic writes', () => {
        const tempDir = makeTempDir();
        const targetPath = path.join(tempDir, 'config.json');
        const content = '{"known":true,"unknown":"kept","nested":{"extra":1}}';

        providers.writeConfigTextAtomicSync(targetPath, content);

        expect(fs.readFileSync(targetPath, 'utf8')).toBe(content);
        expect(fs.readdirSync(tempDir).sort()).toEqual(['config.json']);
    });

    it('writes atomically into a temp directory and leaves no temp files behind', () => {
        const tempDir = makeTempDir();
        const targetPath = path.join(tempDir, 'atomic.json');

        providers.atomicWriteTextSync(targetPath, '{"ok":true}');

        expect(fs.readFileSync(targetPath, 'utf8')).toBe('{"ok":true}');
        expect(fs.readdirSync(tempDir)).toEqual(['atomic.json']);
    });

    it('creates contracts for supported providers and rejects unsupported ids', () => {
        const contract = providers.createProviderContract(providers.PROVIDER_IDS.OPENCODE);

        expect(contract.id).toBe('opencode');
        expect(contract.capabilities).toEqual({
            canDetect: true,
            canLoad: true,
            canValidate: true,
            canSave: true,
            canCreate: true,
            canImportConfig: true,
            canExportConfig: true
        });
        expect(() => providers.createProviderContract('unknown-provider')).toThrow('Unsupported provider id: unknown-provider');
    });
});

describe('provider rules detection', () => {
    it('extracts basename across slash styles for cross-platform suffix checks', () => {
        expect(providers.getPathBasenameAnySeparator('/tmp/a/slim.jsonc')).toBe('slim.jsonc');
        expect(providers.getPathBasenameAnySeparator('C:\\temp\\a\\slim.json')).toBe('slim.json');
    });

    it('returns all provider records with expected metadata fields', () => {
        const tempDir = makeTempDir();
        fs.writeFileSync(path.join(tempDir, 'opencode.json'), '{"name":"opencode"}');
        fs.writeFileSync(path.join(tempDir, 'oh-my-openagent.json'), '{"name":"agent"}');
        fs.writeFileSync(path.join(tempDir, 'oh-my-opencode-slim.json'), '{"name":"slim"}');
        fs.writeFileSync(path.join(tempDir, 'tui.json'), '{"theme":"dark"}');

        const detected = providers.detectProviders({ roots: [tempDir] });

        expect(detected.map((provider) => provider.id)).toEqual([
            providers.PROVIDER_IDS.OPENCODE,
            providers.PROVIDER_IDS.OH_MY_OPENAGENT,
            providers.PROVIDER_IDS.OH_MY_OPENCODE_SLIM
        ]);
        for (const provider of detected) {
            expect(provider).toHaveProperty('id');
            expect(provider).toHaveProperty('displayName');
            expect(provider).toHaveProperty('paths');
            expect(provider).toHaveProperty('exists');
            expect(provider).toHaveProperty('activePath');
            expect(provider).toHaveProperty('capabilities');
            expect(provider).toHaveProperty('diagnostics');
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

        expect(openAgent.activePath).toBe(primary);
        expect(openAgent.diagnostics.some((d) => d.code === 'OPENAGENT_ALIAS_DUPLICATE')).toBe(true);
        const duplicateDiagnostic = openAgent.diagnostics.find((d) => d.code === 'OPENAGENT_ALIAS_DUPLICATE');
        expect(duplicateDiagnostic.details.paths).toEqual([primary, legacy]);
    });

    it('creates safe openagent profile paths next to active config', () => {
        const tempDir = makeTempDir();
        const active = path.join(tempDir, 'oh-my-openagent.json');
        fs.writeFileSync(active, '{"a":1}');

        const openAgent = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OH_MY_OPENAGENT);

        expect(providers.getOpenAgentProfileDir(openAgent)).toBe(path.join(tempDir, providers.OPENAGENT_PROFILE_DIRNAME));
        expect(providers.getOpenAgentDefaultActivePath(openAgent)).toBe(active);
        expect(providers.sanitizeConfigProfileName('Work Config!.json')).toBe('Work-Config');

        const profilePath = providers.getOpenAgentProfilePath(openAgent, 'Work Config!');
        expect(profilePath).toBe(path.join(tempDir, providers.OPENAGENT_PROFILE_DIRNAME, 'Work-Config.json'));
        expect(providers.isOpenAgentProfilePath(openAgent, profilePath)).toBe(true);
        expect(providers.isOpenAgentProfilePath(openAgent, path.join(tempDir, 'other.json'))).toBe(false);
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

        expect(providers.listOpenAgentProfilePaths(openAgent)).toEqual([
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
        expect(duplicateDiagnostic).toBeTruthy();
        expect(duplicateDiagnostic.details.paths).toEqual([pathA, pathB]);
    });

    it('reports malformed provider json using jsonc parser diagnostics', () => {
        const tempDir = makeTempDir();
        const malformedPath = path.join(tempDir, 'opencode.json');
        fs.writeFileSync(malformedPath, '{"name":');

        const opencode = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OPENCODE);

        const malformedDiagnostic = opencode.diagnostics.find((d) => d.code === 'MALFORMED_PROVIDER_CONFIG');
        expect(malformedDiagnostic).toBeTruthy();
        expect(malformedDiagnostic.details.path).toBe(malformedPath);
    });

    it('reports missing slim companion tui config', () => {
        const tempDir = makeTempDir();
        const slimPath = path.join(tempDir, 'oh-my-opencode-slim.json');
        fs.writeFileSync(slimPath, '{"slim":true}');

        const slim = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OH_MY_OPENCODE_SLIM);

        const missingDiagnostic = slim.diagnostics.find((d) => d.code === 'SLIM_TUI_CONFIG_MISSING');
        expect(missingDiagnostic).toBeTruthy();
        expect(missingDiagnostic.details.path).toBe(slimPath);
    });

    it('reports malformed slim companion tui config', () => {
        const tempDir = makeTempDir();
        fs.writeFileSync(path.join(tempDir, 'oh-my-opencode-slim.json'), '{"slim":true}');
        const malformedTuiPath = path.join(tempDir, 'tui.jsonc');
        fs.writeFileSync(malformedTuiPath, '{"theme":');

        const slim = providers.detectProviders({ roots: [tempDir] })
            .find((provider) => provider.id === providers.PROVIDER_IDS.OH_MY_OPENCODE_SLIM);

        const malformedDiagnostic = slim.diagnostics.find((d) => d.code === 'SLIM_TUI_CONFIG_MALFORMED');
        expect(malformedDiagnostic).toBeTruthy();
        expect(malformedDiagnostic.details.path).toBe(malformedTuiPath);
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

        expect(merged).toEqual({
            name: 'demo',
            plugins: { keep: true, nested: { original: 2, added: true } },
            unknownTopLevel: { keep: true },
            known: 'updated'
        });
    });

    it('extracts expected revision hash from string or object payloads', () => {
        expect(providers.getExpectedRevisionHash({ expectedRevision: 'abc' })).toBe('abc');
        expect(providers.getExpectedRevisionHash({ expectedRevision: { hash: 'def' } })).toBe('def');
        expect(providers.getExpectedRevisionHash({ revision: { hash: 'ghi' } })).toBe('ghi');
        expect(providers.getExpectedRevisionHash({})).toBeNull();
    });

    it('flags stale revisions when expected hash does not match current hash', () => {
        expect(providers.isStaleRevision({ expectedHash: 'abc', currentRevision: { hash: 'abc' } })).toBe(false);
        expect(providers.isStaleRevision({ expectedHash: 'abc', currentRevision: { hash: 'zzz' } })).toBe(true);
        expect(providers.isStaleRevision({ expectedHash: 'abc', currentRevision: null })).toBe(true);
        expect(providers.isStaleRevision({ expectedHash: null, currentRevision: null })).toBe(false);
    });

    it('accepts matching provider import payload and rejects mismatch', () => {
        const okMatch = providers.validateImportProviderMatch({
            routeProviderId: providers.PROVIDER_IDS.OPENCODE,
            payload: { providerId: providers.PROVIDER_IDS.OPENCODE }
        });
        expect(okMatch.ok).toBe(true);

        const mismatch = providers.validateImportProviderMatch({
            routeProviderId: providers.PROVIDER_IDS.OPENCODE,
            payload: { id: providers.PROVIDER_IDS.OH_MY_OPENAGENT }
        });
        expect(mismatch.ok).toBe(false);
        expect(mismatch.diagnostic.code).toBe('PROVIDER_MISMATCH');
    });

    it('creates only missing file and never overwrites existing file', () => {
        const tempDir = makeTempDir();
        const targetPath = path.join(tempDir, 'safe-create.jsonc');
        const initialRaw = '{\n  // initial\n  "a": 1,\n}\n';
        const secondRaw = '{"a":2}';

        const created = providers.createFileIfMissingSync(targetPath, initialRaw, 'utf8');
        expect(created).toEqual({ created: true, path: targetPath });
        expect(fs.readFileSync(targetPath, 'utf8')).toBe(initialRaw);

        const existing = providers.createFileIfMissingSync(targetPath, secondRaw, 'utf8');
        expect(existing).toEqual({ created: false, path: targetPath });
        expect(fs.readFileSync(targetPath, 'utf8')).toBe(initialRaw);
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
        expect(noPath.ok).toBe(false);
        expect(noPath.diagnostics[0].code).toBe('PROVIDER_PATH_REQUIRED');

        const withAllowedPath = providers.resolveProviderWritePath({ provider, requestedPath: candidatePath });
        expect(withAllowedPath).toEqual({ ok: true, path: candidatePath });
    });
});
