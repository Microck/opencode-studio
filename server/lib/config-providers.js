const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jsoncParser = require('jsonc-parser');

const PROVIDER_IDS = Object.freeze({
    OPENCODE: 'opencode',
    OH_MY_OPENAGENT: 'oh-my-openagent',
    OH_MY_OPENCODE_SLIM: 'oh-my-opencode-slim'
});

const PROVIDER_ID_LIST = Object.freeze([
    PROVIDER_IDS.OPENCODE,
    PROVIDER_IDS.OH_MY_OPENAGENT,
    PROVIDER_IDS.OH_MY_OPENCODE_SLIM
]);

const PROVIDER_RULES = Object.freeze({
    [PROVIDER_IDS.OPENCODE]: Object.freeze({
        id: PROVIDER_IDS.OPENCODE,
        displayName: 'OpenCode',
        basenames: Object.freeze(['opencode.json', 'opencode.jsonc'])
    }),
    [PROVIDER_IDS.OH_MY_OPENAGENT]: Object.freeze({
        id: PROVIDER_IDS.OH_MY_OPENAGENT,
        displayName: 'Oh My OpenAgent',
        basenames: Object.freeze([
            'oh-my-openagent.json',
            'oh-my-openagent.jsonc',
            'oh-my-opencode.json',
            'oh-my-opencode.jsonc'
        ])
    }),
    [PROVIDER_IDS.OH_MY_OPENCODE_SLIM]: Object.freeze({
        id: PROVIDER_IDS.OH_MY_OPENCODE_SLIM,
        displayName: 'Oh My OpenCode Slim',
        basenames: Object.freeze(['oh-my-opencode-slim.json', 'oh-my-opencode-slim.jsonc']),
        fallbackBasenames: Object.freeze(['slim.json', 'slim.jsonc']),
        companionBasenames: Object.freeze(['tui.json', 'tui.jsonc'])
    })
});

const OPENAGENT_PROFILE_DIRNAME = 'oh-my-openagent-configs';

const CONTRACT_METHOD_NAMES = Object.freeze([
    'detect',
    'load',
    'validate',
    'save',
    'create',
    'importConfig',
    'exportConfig'
]);

const defaultCapabilities = () => ({
    canDetect: true,
    canLoad: true,
    canValidate: true,
    canSave: true,
    canCreate: true,
    canImportConfig: true,
    canExportConfig: true
});

const createNotImplementedMethod = (providerId, methodName) => {
    return () => {
        throw new Error(`Provider "${providerId}" method "${methodName}" is not implemented`);
    };
};

const createProviderContract = (providerId, overrides = {}) => {
    if (!PROVIDER_ID_LIST.includes(providerId)) {
        throw new Error(`Unsupported provider id: ${providerId}`);
    }

    const contract = {
        id: providerId,
        capabilities: { ...defaultCapabilities(), ...(overrides.capabilities || {}) }
    };

    for (const methodName of CONTRACT_METHOD_NAMES) {
        contract[methodName] = typeof overrides[methodName] === 'function'
            ? overrides[methodName]
            : createNotImplementedMethod(providerId, methodName);
    }

    return contract;
};

const normalizePath = (inputPath) => {
    if (!inputPath || typeof inputPath !== 'string') return null;
    return path.normalize(path.resolve(inputPath));
};

const uniqNormalizedPaths = (paths) => {
    const normalized = [];
    const seen = new Set();
    for (const p of paths || []) {
        const value = normalizePath(p);
        if (!value || seen.has(value)) continue;
        seen.add(value);
        normalized.push(value);
    }
    return normalized;
};

const createPathInventory = ({ candidates = [], detected = null, manual = null, current = null } = {}) => {
    const normalizedCandidates = uniqNormalizedPaths(candidates);
    const normalizedDetected = normalizePath(detected);
    const normalizedManual = normalizePath(manual);
    const normalizedCurrent = normalizePath(current);
    return {
        candidates: normalizedCandidates,
        detected: normalizedDetected,
        manual: normalizedManual,
        current: normalizedCurrent || normalizedManual || normalizedDetected || null
    };
};

const createDiagnostic = ({ severity = 'error', code = 'CONFIG_PROVIDER', message, details = null } = {}) => ({
    severity,
    code,
    message: message || 'Unknown config provider error',
    details
});

const pathExistsSync = (targetPath) => {
    try {
        return fs.existsSync(targetPath);
    } catch {
        return false;
    }
};

const statPathSync = (targetPath) => {
    try {
        return fs.statSync(targetPath);
    } catch {
        return null;
    }
};

const isFileSync = (targetPath) => {
    const stats = statPathSync(targetPath);
    return !!stats && stats.isFile();
};

const isDirectorySync = (targetPath) => {
    const stats = statPathSync(targetPath);
    return !!stats && stats.isDirectory();
};

const parseJsonText = (text, { parseJsonc } = {}) => {
    if (typeof text !== 'string') {
        throw new Error('Config text must be a string');
    }

    if (typeof parseJsonc === 'function') return parseJsonc(text);

    const errors = [];
    const value = jsoncParser.parse(text, errors, {
        allowTrailingComma: true,
        disallowComments: false
    });
    if (errors.length > 0) {
        const first = errors[0];
        const error = new SyntaxError(`Invalid JSON/JSONC (code ${first.error} at offset ${first.offset})`);
        error.jsoncErrors = errors;
        throw error;
    }
    return value;
};

const loadConfigFileSync = (filePath) => {
    return parseJsonText(fs.readFileSync(filePath, 'utf8'));
};

const toAbsolutePath = (baseRoot, basename) => normalizePath(path.join(baseRoot, basename));

const resolveRoots = ({ roots = [], customPaths = [] } = {}) => {
    return uniqNormalizedPaths([...(roots || []), ...(customPaths || [])]);
};

const buildCandidatesForRule = (rule, roots) => {
    const allBasenames = [...rule.basenames, ...(rule.fallbackBasenames || [])];
    const candidates = [];
    for (const root of roots) {
        for (const basename of allBasenames) {
            candidates.push(toAbsolutePath(root, basename));
        }
    }
    return uniqNormalizedPaths(candidates);
};

const findExistingPaths = (paths) => {
    const existing = [];
    for (const p of paths) {
        if (isFileSync(p)) existing.push(p);
    }
    return existing;
};

const parseConfigForDiagnostics = (targetPath, { parseJsonc } = {}) => {
    const diagnostics = [];
    if (!targetPath || !isFileSync(targetPath)) return diagnostics;

    try {
        const rawText = readConfigTextSync(targetPath, 'utf8');
        parseJsonText(rawText, { parseJsonc });
    } catch (error) {
        diagnostics.push(createDiagnostic({
            severity: 'error',
            code: 'MALFORMED_PROVIDER_CONFIG',
            message: `Malformed config file: ${targetPath}`,
            details: {
                path: targetPath,
                error: error.message
            }
        }));
    }

    return diagnostics;
};

const getPathBasenameAnySeparator = (inputPath) => {
    if (typeof inputPath !== 'string') return '';
    return inputPath.split(/[\\/]/).pop() || '';
};

const sanitizeConfigProfileName = (name) => {
    if (typeof name !== 'string') return null;
    const value = name.trim().replace(/\.(jsonc?|JSONC?)$/, '');
    if (!value) return null;
    const safe = value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return safe || null;
};

const getOpenAgentProfileDir = (provider) => {
    if (!provider || provider.id !== PROVIDER_IDS.OH_MY_OPENAGENT) return null;
    const basePath = provider.activePath || (Array.isArray(provider.paths) ? provider.paths[0] : null);
    if (!basePath) return null;
    return normalizePath(path.join(path.dirname(basePath), OPENAGENT_PROFILE_DIRNAME));
};

const getOpenAgentDefaultActivePath = (provider) => {
    if (!provider || provider.id !== PROVIDER_IDS.OH_MY_OPENAGENT || !Array.isArray(provider.paths)) return null;
    return provider.activePath || provider.paths.find((p) => getPathBasenameAnySeparator(p) === 'oh-my-openagent.json') || provider.paths[0] || null;
};

const getOpenAgentProfilePath = (provider, name) => {
    const profileDir = getOpenAgentProfileDir(provider);
    const safeName = sanitizeConfigProfileName(name);
    if (!profileDir || !safeName) return null;
    return normalizePath(path.join(profileDir, `${safeName}.json`));
};

const isOpenAgentProfilePath = (provider, profilePath) => {
    const profileDir = getOpenAgentProfileDir(provider);
    const normalized = normalizePath(profilePath);
    if (!profileDir || !normalized) return false;
    const relative = path.relative(profileDir, normalized);
    const basename = getPathBasenameAnySeparator(normalized);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative) && /\.jsonc?$/i.test(basename);
};

const listOpenAgentProfilePaths = (provider) => {
    const profileDir = getOpenAgentProfileDir(provider);
    if (!profileDir || !isDirectorySync(profileDir)) return [];
    return fs.readdirSync(profileDir)
        .filter((name) => /\.jsonc?$/i.test(name))
        .map((name) => normalizePath(path.join(profileDir, name)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
};

const createProviderDetectionResult = ({ id, displayName, candidates, existing, activePath, diagnostics = [] }) => ({
    id,
    displayName,
    paths: candidates,
    exists: !!activePath,
    activePath: activePath || null,
    capabilities: defaultCapabilities(),
    diagnostics
});

const detectSingleProvider = (rule, options = {}) => {
    const roots = resolveRoots({ roots: options.roots, customPaths: options.customPaths });
    const candidates = buildCandidatesForRule(rule, roots);
    const existing = findExistingPaths(candidates);
    const diagnostics = [];

    if (existing.length > 1) {
        diagnostics.push(createDiagnostic({
            severity: 'warning',
            code: 'DUPLICATE_PROVIDER_CONFIG',
            message: `Multiple config files detected for ${rule.displayName}`,
            details: { paths: existing }
        }));
    }

    if (rule.id === PROVIDER_IDS.OH_MY_OPENAGENT) {
        const hasPrimary = existing.some((p) => {
            const basename = getPathBasenameAnySeparator(p);
            return basename === 'oh-my-openagent.json' || basename === 'oh-my-openagent.jsonc';
        });
        const hasLegacy = existing.some((p) => {
            const basename = getPathBasenameAnySeparator(p);
            return basename === 'oh-my-opencode.json' || basename === 'oh-my-opencode.jsonc';
        });
        if (hasPrimary && hasLegacy) {
            diagnostics.push(createDiagnostic({
                severity: 'warning',
                code: 'OPENAGENT_ALIAS_DUPLICATE',
                message: 'Detected both oh-my-openagent and legacy oh-my-opencode config aliases',
                details: { paths: existing }
            }));
        }
    }

    const activePath = existing[0] || null;
    diagnostics.push(...parseConfigForDiagnostics(activePath, { parseJsonc: options.parseJsonc }));

    if (rule.id === PROVIDER_IDS.OH_MY_OPENCODE_SLIM && activePath) {
        const companionCandidates = roots.flatMap((root) =>
            rule.companionBasenames.map((basename) => toAbsolutePath(root, basename))
        );
        const companionExisting = findExistingPaths(companionCandidates);
        const companionActive = companionExisting[0] || null;

        if (!companionActive) {
            diagnostics.push(createDiagnostic({
                severity: 'warning',
                code: 'SLIM_TUI_CONFIG_MISSING',
                message: `Missing Slim companion config (tui.json or tui.jsonc) for ${activePath}`,
                details: {
                    path: activePath,
                    expectedPaths: companionCandidates
                }
            }));
        } else {
            diagnostics.push(...parseConfigForDiagnostics(companionActive, { parseJsonc: options.parseJsonc }).map((d) => ({
                ...d,
                code: 'SLIM_TUI_CONFIG_MALFORMED'
            })));
        }

        const activeBasename = getPathBasenameAnySeparator(activePath);
        const usedFallback = rule.fallbackBasenames.includes(activeBasename);
        if (usedFallback) {
            diagnostics.push(createDiagnostic({
                severity: 'warning',
                code: 'SLIM_BASENAME_FALLBACK',
                message: 'Slim config matched fallback basename; prefer oh-my-opencode-slim.json[c]',
                details: { path: activePath }
            }));
        }
    }

    return createProviderDetectionResult({
        id: rule.id,
        displayName: rule.displayName,
        candidates,
        existing,
        activePath,
        diagnostics
    });
};

const detectProviders = ({ roots = [], customPathsByProvider = {}, parseJsonc } = {}) => {
    return PROVIDER_ID_LIST.map((providerId) => {
        const rule = PROVIDER_RULES[providerId];
        return detectSingleProvider(rule, {
            roots,
            customPaths: customPathsByProvider[providerId] || [],
            parseJsonc
        });
    });
};

const readConfigTextSync = (filePath, options = 'utf8') => {
    return fs.readFileSync(filePath, options);
};

const computeContentHash = (content) => {
    return crypto.createHash('sha256').update(content).digest('hex');
};

const buildContentRevision = ({ content, stats = null, algorithm = 'sha256' } = {}) => {
    const hash = algorithm === 'sha256' ? computeContentHash(content) : null;
    return {
        algorithm,
        hash,
        size: stats ? stats.size : Buffer.byteLength(content || ''),
        mtimeMs: stats ? stats.mtimeMs : null
    };
};

const isPlainObject = (value) => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
};

const deepMergePreservingUnknown = (baseValue, nextValue) => {
    if (!isPlainObject(baseValue) || !isPlainObject(nextValue)) {
        return nextValue;
    }

    const merged = { ...baseValue };
    for (const [key, value] of Object.entries(nextValue)) {
        if (isPlainObject(value) && isPlainObject(baseValue[key])) {
            merged[key] = deepMergePreservingUnknown(baseValue[key], value);
            continue;
        }
        merged[key] = value;
    }
    return merged;
};

const getExpectedRevisionHash = (payload = {}) => {
    if (typeof payload.expectedRevision === 'string') return payload.expectedRevision;
    if (isPlainObject(payload.expectedRevision) && typeof payload.expectedRevision.hash === 'string') {
        return payload.expectedRevision.hash;
    }
    if (isPlainObject(payload.revision) && typeof payload.revision.hash === 'string') {
        return payload.revision.hash;
    }
    return null;
};

const isStaleRevision = ({ expectedHash, currentRevision } = {}) => {
    if (!expectedHash) return false;
    if (!currentRevision || typeof currentRevision.hash !== 'string') return true;
    return currentRevision.hash !== expectedHash;
};

const validateImportProviderMatch = ({ routeProviderId, payload = {} } = {}) => {
    const declaredProviderId = payload.id || payload.providerId || payload.provider;
    if (!declaredProviderId) return { ok: true, declaredProviderId: null };
    if (declaredProviderId === routeProviderId) {
        return { ok: true, declaredProviderId };
    }
    return {
        ok: false,
        declaredProviderId,
        diagnostic: createDiagnostic({
            severity: 'error',
            code: 'PROVIDER_MISMATCH',
            message: 'Import payload provider does not match route provider',
            details: {
                routeProvider: routeProviderId,
                payloadProvider: declaredProviderId
            }
        })
    };
};

const createFileIfMissingSync = (filePath, content, options = 'utf8') => {
    if (pathExistsSync(filePath)) {
        return { created: false, path: filePath };
    }
    writeConfigTextAtomicSync(filePath, content, options);
    return { created: true, path: filePath };
};

const resolveProviderWritePath = ({ provider, requestedPath } = {}) => {
    if (!provider || !Array.isArray(provider.paths)) {
        return {
            ok: false,
            diagnostics: [createDiagnostic({
                severity: 'error',
                code: 'NO_PROVIDER_PATH',
                message: 'No writable path available for provider'
            })]
        };
    }

    if (typeof requestedPath === 'string' && requestedPath.trim().length > 0) {
        const normalized = normalizePath(requestedPath);
        if (!normalized || !provider.paths.includes(normalized)) {
            return {
                ok: false,
                diagnostics: [createDiagnostic({
                    severity: 'error',
                    code: 'UNSAFE_PROVIDER_PATH',
                    message: 'Requested path is not allowed for this provider',
                    details: { path: normalized || requestedPath }
                })]
            };
        }
        return { ok: true, path: normalized };
    }

    if (provider.activePath) return { ok: true, path: provider.activePath };

    return {
        ok: false,
        diagnostics: [createDiagnostic({
            severity: 'error',
            code: 'PROVIDER_PATH_REQUIRED',
            message: 'Explicit provider path is required when no active provider config exists'
        })]
    };
};

const atomicWriteTextSync = (filePath, data, options = 'utf8') => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tempPath = path.join(
        dir,
        `.${path.basename(filePath)}.${crypto.randomBytes(6).toString('hex')}.tmp`
    );

    try {
        fs.writeFileSync(tempPath, data, options);
        let retries = 5;
        while (retries > 0) {
            try {
                fs.renameSync(tempPath, filePath);
                break;
            } catch (error) {
                if (retries === 1) throw error;
                retries -= 1;
                const start = Date.now();
                while (Date.now() - start < 50) {}
            }
        }
    } catch (error) {
        if (fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
            } catch {
                // no-op
            }
        }
        throw error;
    }
};

const writeConfigTextAtomicSync = (filePath, content, options = 'utf8') => {
    atomicWriteTextSync(filePath, content, options);
};

module.exports = {
    PROVIDER_IDS,
    PROVIDER_ID_LIST,
    PROVIDER_RULES,
    OPENAGENT_PROFILE_DIRNAME,
    CONTRACT_METHOD_NAMES,
    defaultCapabilities,
    createProviderContract,
    createNotImplementedMethod,
    normalizePath,
    uniqNormalizedPaths,
    createPathInventory,
    createDiagnostic,
    pathExistsSync,
    statPathSync,
    isFileSync,
    isDirectorySync,
    parseJsonText,
    loadConfigFileSync,
    resolveRoots,
    buildCandidatesForRule,
    findExistingPaths,
    parseConfigForDiagnostics,
    getPathBasenameAnySeparator,
    sanitizeConfigProfileName,
    getOpenAgentProfileDir,
    getOpenAgentDefaultActivePath,
    getOpenAgentProfilePath,
    isOpenAgentProfilePath,
    listOpenAgentProfilePaths,
    createProviderDetectionResult,
    detectSingleProvider,
    detectProviders,
    readConfigTextSync,
    computeContentHash,
    buildContentRevision,
    isPlainObject,
    deepMergePreservingUnknown,
    getExpectedRevisionHash,
    isStaleRevision,
    validateImportProviderMatch,
    createFileIfMissingSync,
    resolveProviderWritePath,
    atomicWriteTextSync,
    writeConfigTextAtomicSync
};
