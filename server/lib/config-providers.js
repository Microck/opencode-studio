const fs = require('fs');
const path = require('path');
const os = require('os');
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
            'omo.jsonc',
            'omo.json',
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

const OMO_BASENAMES = Object.freeze(['omo.jsonc', 'omo.json']);

const OPENAGENT_LEGACY_BASENAMES = Object.freeze([
    'oh-my-openagent.json',
    'oh-my-openagent.jsonc',
    'oh-my-opencode.json',
    'oh-my-opencode.jsonc'
]);

const MAX_OMO_PROJECT_SCAN_DEPTH = 256;

const OMO_PROFILE_DIR_SUFFIX_RE = /(?:^|[\\/])profiles[\\/]([^\\/]+)[\\/]*$/;

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

// omo-key sanitizer: preserves Unicode/spaces (unlike sanitizeConfigProfileName);
// returns null (never throws) so read paths return null and write paths throw.
const sanitizeOmoKey = (name) => {
    if (typeof name !== 'string') return null;
    const value = name.trim().replace(/\.(jsonc?|JSONC?)$/, '');
    if (!value) return null;
    if (value === '.' || value === '..') return null;
    if (!/[\p{L}\p{N}]/u.test(value)) return null;
    if (value.includes('/') || value.includes('\\')) return null;
    if (value.split('.').some((segment) => segment === '')) return null;
    return value;
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

const isSymlinkedPathSync = (targetPath) => {
    try {
        return fs.lstatSync(targetPath).isSymbolicLink();
    } catch {
        return false;
    }
};

const realpathOrSelfSync = (targetPath) => {
    try {
        return fs.realpathSync(targetPath);
    } catch {
        return targetPath;
    }
};

const findLoadableOmoConfigPathInDir = (dirPath) => {
    const omoDir = path.join(dirPath, '.omo');
    if (isSymlinkedPathSync(omoDir)) return null;
    for (const basename of OMO_BASENAMES) {
        const candidate = path.join(omoDir, basename);
        if (isFileSync(candidate) && !isSymlinkedPathSync(candidate)) return candidate;
    }
    return null;
};

// Mirrors plugin findProjectConfigPathsFarthestFirst: walk up from cwd (max 256
// layers), skip symlinked .omo dirs, stop at $HOME (exclusive), then reverse so
// the farthest ancestor comes first. Returns the .omo directory roots that
// actually contain a loadable omo.jsonc/omo.json.
const findProjectOmoRootsFarthestFirst = ({ cwd = process.cwd(), homeDir = os.homedir() } = {}) => {
    const startDir = normalizePath(cwd);
    const homeBoundary = normalizePath(homeDir);
    const realHomeBoundary = realpathOrSelfSync(homeBoundary);
    const nearestFirst = [];
    let currentDir = startDir;
    for (let depth = 0; depth < MAX_OMO_PROJECT_SCAN_DEPTH; depth += 1) {
        const normalizedCurrentDir = normalizePath(currentDir);
        if (normalizedCurrentDir === homeBoundary || realpathOrSelfSync(normalizedCurrentDir) === realHomeBoundary) {
            break;
        }
        const configPath = findLoadableOmoConfigPathInDir(currentDir);
        if (configPath) nearestFirst.push(normalizePath(path.dirname(configPath)));
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) break;
        currentDir = parentDir;
    }
    return nearestFirst.reverse();
};

// User-level ~/.omo first, then project-level .omo roots farthest-first.
// Reusable by server/index.js for wiring omo roots into the caller-supplied roots.
const getOmoSearchRoots = ({ cwd = process.cwd(), homeDir = os.homedir() } = {}) => {
    const userRoot = normalizePath(path.join(homeDir, '.omo'));
    const projectRoots = findProjectOmoRootsFarthestFirst({ cwd, homeDir });
    return uniqNormalizedPaths([userRoot, ...projectRoots]);
};

const buildOmoRootCandidates = (omoRoots) => {
    const candidates = [];
    for (const root of omoRoots) {
        for (const basename of OMO_BASENAMES) {
            candidates.push(toAbsolutePath(root, basename));
        }
    }
    return uniqNormalizedPaths(candidates);
};

// Derive omo candidate roots from the caller-provided search scope when one is
// given (caller roots that are `.omo` dirs are used directly; other caller roots
// contribute their `root/.omo` subdir only when it holds a loadable omo config).
// Fall back to the homedir-based getOmoSearchRoots() only when the caller scoped
// nothing, so caller-scoped detection never leaks the real ~/.omo into results.
const resolveOmoCandidateRoots = ({ roots = [], customPaths = [] } = {}) => {
    const callerRoots = uniqNormalizedPaths([...(roots || []), ...(customPaths || [])]);
    if (callerRoots.length === 0) return getOmoSearchRoots();
    const omoRoots = [];
    for (const root of callerRoots) {
        if (getPathBasenameAnySeparator(root) === '.omo') {
            omoRoots.push(root);
            continue;
        }
        if (findLoadableOmoConfigPathInDir(root)) {
            omoRoots.push(normalizePath(path.join(root, '.omo')));
        }
    }
    return uniqNormalizedPaths(omoRoots);
};

const isOmoBasename = (basename) => OMO_BASENAMES.includes(basename);

// Returns only the "[opencode]" block of an omo config file (never the whole file).
const getOmoConfigBlock = (filePath) => {
    if (!filePath || !isFileSync(filePath)) return {};
    try {
        const parsed = parseJsonText(fs.readFileSync(filePath, 'utf8'));
        if (!isPlainObject(parsed)) return {};
        const block = parsed['[opencode]'];
        return isPlainObject(block) ? block : {};
    } catch {
        return {};
    }
};

const OMO_SCHEMA_URL = 'https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/omo.schema.json';

// Skeleton created when an omo.jsonc does not exist yet (MINOR-1 missing-file
// contract): comment header + $schema (MINOR-b, matches the real ~/.omo/omo.jsonc)
// + empty [opencode] block, so writeOmoBlock can always edit a well-formed doc.
const OMO_SKELETON_JSONC = `// OMO configuration
{
  "$schema": "${OMO_SCHEMA_URL}",
  "[opencode]": {}
}
`;

// Matches the plugin's FORMATTING_OPTIONS so newly inserted omo.jsonc nodes use
// the same 2-space style as the real ~/.omo/omo.jsonc.
const OMO_JSONC_FORMATTING_OPTIONS = Object.freeze({
    eol: '\n',
    insertSpaces: true,
    tabSize: 2
});

const profileName = (value) => (value === '' ? undefined : value);

// Mirrors plugin profileNameFromOpenCodeConfigDir: extract profile name from the
// "/profiles/<name>" suffix of OPENCODE_CONFIG_DIR (not the bare basename).
const profileNameFromOpenCodeConfigDir = (configDirPath) => {
    if (typeof configDirPath !== 'string') return undefined;
    const match = configDirPath.match(OMO_PROFILE_DIR_SUFFIX_RE);
    return profileName(match ? match[1] : undefined);
};

// Mirrors plugin resolveOmoProfileName: OMO_PROFILE > OCX_PROFILE > OPENCODE_CONFIG_DIR profile suffix.
const getResolvedActiveProfile = (options = {}) => {
    const env = options.env ?? process.env;
    return (
        profileName(options.profile) ??
        profileName(env.OMO_PROFILE) ??
        profileName(env.OCX_PROFILE) ??
        profileNameFromOpenCodeConfigDir(env.OPENCODE_CONFIG_DIR)
    );
};

const assertOmoPath = (filePath) => {
    const targetPath = normalizePath(filePath);
    if (!targetPath) throw new Error('omo config path is required');
    return targetPath;
};

// Parses a block key into a jsonc-parser path: '[opencode]' -> ['[opencode]'],
// 'profiles.<name>.[opencode]' -> ['profiles', sanitizedName, '[opencode]'].
// Null for anything else. Names go through sanitizeConfigProfileName, so dots
// inside a name never collide with the '.' path separators of the key string.
const parseOmoBlockKeyPath = (key) => {
    if (typeof key !== 'string' || key.trim() === '') return null;
    const trimmed = key.trim();
    if (trimmed === '[opencode]') return ['[opencode]'];
    const match = trimmed.match(/^profiles\.(.+)\.\[opencode\]$/);
    if (!match) return null;
    const safeName = sanitizeOmoKey(match[1]);
    if (!safeName) return null;
    return ['profiles', safeName, '[opencode]'];
};

// Surgically writes `block` into an omo.jsonc via jsonc-parser modify/applyEdits:
// only the targeted node changes, so the comment header, $schema, _migrations and
// every other block survive (C2 data protection — never whole-file rewrites).
// Missing file -> skeleton created first (MINOR-1); write is atomic through
// atomicWriteTextSync (MINOR-c: temp file + rename, a crash cannot corrupt omo.jsonc).
const writeOmoBlock = (filePath, block, key = '[opencode]') => {
    const targetPath = assertOmoPath(filePath);
    if (!isPlainObject(block)) {
        throw new Error(`omo block must be a plain object, got ${typeof block}`);
    }
    const blockPath = parseOmoBlockKeyPath(key);
    if (!blockPath) {
        throw new Error(`Invalid omo block key: ${JSON.stringify(key)} (expected "[opencode]" or "profiles.<name>.[opencode]")`);
    }

    const existed = pathExistsSync(targetPath);
    if (existed && !isFileSync(targetPath)) {
        throw new Error(`omo config path is not a file: ${targetPath}`);
    }

    let text;
    if (existed) {
        text = fs.readFileSync(targetPath, 'utf8');
        if (!isPlainObject(parseJsonText(text))) {
            throw new Error(`omo config root must be a JSONC object: ${targetPath}`);
        }
    } else {
        text = OMO_SKELETON_JSONC;
    }

    const edits = jsoncParser.modify(text, blockPath, block, {
        formattingOptions: OMO_JSONC_FORMATTING_OPTIONS
    });
    atomicWriteTextSync(targetPath, jsoncParser.applyEdits(text, edits), 'utf8');
    return { path: targetPath, created: !existed };
};

// Keys of config.profiles (missing/malformed file -> []).
const listOmoProfiles = (filePath) => {
    if (typeof filePath !== 'string' || !isFileSync(filePath)) return [];
    try {
        const parsed = parseJsonText(fs.readFileSync(filePath, 'utf8'));
        if (!isPlainObject(parsed) || !isPlainObject(parsed.profiles)) return [];
        return Object.keys(parsed.profiles);
    } catch {
        return [];
    }
};

// Whole profiles.<name> object, or null (missing/malformed file, invalid name,
// absent profile). Read-side never throws, matching getOmoConfigBlock.
const getOmoProfile = (filePath, name) => {
    if (typeof filePath !== 'string' || !isFileSync(filePath)) return null;
    const safeName = sanitizeOmoKey(name);
    if (!safeName) return null;
    try {
        const parsed = parseJsonText(fs.readFileSync(filePath, 'utf8'));
        if (!isPlainObject(parsed) || !isPlainObject(parsed.profiles)) return null;
        const profile = parsed.profiles[safeName];
        return isPlainObject(profile) ? profile : null;
    } catch {
        return null;
    }
};

// Writes profiles.<name>.[opencode] as one surgical jsonc edit, preserving any
// sibling keys of the profile. Invalid profile name -> throws (m-3 decision,
// aligned with getOpenAgentProfilePath's null -> 400 path in server/index.js).
const setOmoProfile = (filePath, name, block) => {
    const safeName = sanitizeOmoKey(name);
    if (!safeName) {
        throw new Error(`Invalid omo profile name: ${JSON.stringify(name)}`);
    }
    return writeOmoBlock(filePath, block, `profiles.${safeName}.[opencode]`);
};

// Removes profiles.<name> via jsonc modify with an undefined value (jsonc-parser
// deletion semantics, verified empirically). Missing file or absent profile is a
// no-op; invalid profile name -> throws.
const deleteOmoProfile = (filePath, name) => {
    const safeName = sanitizeOmoKey(name);
    if (!safeName) {
        throw new Error(`Invalid omo profile name: ${JSON.stringify(name)}`);
    }
    const targetPath = assertOmoPath(filePath);
    if (!isFileSync(targetPath)) {
        return { path: targetPath, removed: false };
    }
    const text = fs.readFileSync(targetPath, 'utf8');
    const parsed = parseJsonText(text);
    if (!isPlainObject(parsed)) {
        throw new Error(`omo config root must be a JSONC object: ${targetPath}`);
    }
    const removed = isPlainObject(parsed.profiles) && Object.prototype.hasOwnProperty.call(parsed.profiles, safeName);
    const edits = jsoncParser.modify(text, ['profiles', safeName], undefined, {
        formattingOptions: OMO_JSONC_FORMATTING_OPTIONS
    });
    if (edits.length > 0) {
        atomicWriteTextSync(targetPath, jsoncParser.applyEdits(text, edits), 'utf8');
    }
    return { path: targetPath, removed };
};

const detectSingleProvider = (rule, options = {}) => {
    const roots = resolveRoots({ roots: options.roots, customPaths: options.customPaths });
    const candidates = buildCandidatesForRule(rule, roots);
    let existing = findExistingPaths(candidates);
    const diagnostics = [];
    let activePath = existing[0] || null;

    if (rule.id === PROVIDER_IDS.OH_MY_OPENAGENT) {
        const omoRoots = resolveOmoCandidateRoots({ roots, customPaths: options.customPaths });
        const omoRootSet = new Set(omoRoots.map((root) => normalizePath(root)));

        const omoExisting = findExistingPaths(buildOmoRootCandidates(omoRoots));

        const omoOutsideRoots = [];
        const legacyExisting = [];
        for (const p of existing) {
            if (isOmoBasename(getPathBasenameAnySeparator(p))) {
                if (!omoRootSet.has(normalizePath(path.dirname(p)))) omoOutsideRoots.push(p);
            } else {
                legacyExisting.push(p);
            }
        }

        if (omoOutsideRoots.length > 0) {
            diagnostics.push(createDiagnostic({
                severity: 'warning',
                code: 'OPENAGENT_OMO_OUTSIDE_ROOT',
                message: 'Detected omo.jsonc outside an omo search root; ignoring it',
                details: { paths: omoOutsideRoots, omoRoots }
            }));
        }

        if (legacyExisting.length > 1) {
            diagnostics.push(createDiagnostic({
                severity: 'warning',
                code: 'DUPLICATE_PROVIDER_CONFIG',
                message: `Multiple config files detected for ${rule.displayName}`,
                details: { paths: legacyExisting }
            }));
        }

        const hasPrimary = legacyExisting.some((p) => {
            const basename = getPathBasenameAnySeparator(p);
            return basename === 'oh-my-openagent.json' || basename === 'oh-my-openagent.jsonc';
        });
        const hasLegacy = legacyExisting.some((p) => {
            const basename = getPathBasenameAnySeparator(p);
            return basename === 'oh-my-opencode.json' || basename === 'oh-my-opencode.jsonc';
        });
        if (hasPrimary && hasLegacy) {
            diagnostics.push(createDiagnostic({
                severity: 'warning',
                code: 'OPENAGENT_ALIAS_DUPLICATE',
                message: 'Detected both oh-my-openagent and legacy oh-my-opencode config aliases',
                details: { paths: legacyExisting }
            }));
        }

        activePath = omoExisting[0] || legacyExisting[0] || null;
        if (activePath && OPENAGENT_LEGACY_BASENAMES.includes(getPathBasenameAnySeparator(activePath))) {
            diagnostics.push(createDiagnostic({
                severity: 'warning',
                code: 'OPENAGENT_LEGACY_CONFIG',
                message: 'Using legacy oh-my-openagent/oh-my-opencode config; prefer omo.jsonc in an omo root',
                details: { path: activePath }
            }));
        }

        existing = uniqNormalizedPaths([...omoExisting, ...legacyExisting]);
    } else if (existing.length > 1) {
        diagnostics.push(createDiagnostic({
            severity: 'warning',
            code: 'DUPLICATE_PROVIDER_CONFIG',
            message: `Multiple config files detected for ${rule.displayName}`,
            details: { paths: existing }
        }));
    }
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
    sanitizeOmoKey,
    getOpenAgentProfileDir,
    getOpenAgentDefaultActivePath,
    getOpenAgentProfilePath,
    isOpenAgentProfilePath,
    listOpenAgentProfilePaths,
    getOmoSearchRoots,
    getOmoConfigBlock,
    getResolvedActiveProfile,
    writeOmoBlock,
    listOmoProfiles,
    getOmoProfile,
    setOmoProfile,
    deleteOmoProfile,
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
