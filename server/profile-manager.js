const fs = require('fs');
const path = require('path');
const os = require('os');
const configProviders = require('./lib/config-providers');

// Profiles live in the ~/.omo/omo.jsonc "profiles" block (Todo 7: symlink
// mechanism replaced by bake-only activation). os.homedir() respects $HOME on
// POSIX, so sandboxed QA with HOME=$(mktemp -d) works out of the box.
const OMO_CONFIG_PATH = path.join(os.homedir(), '.omo', 'omo.jsonc');

// Legacy environment profile directories (the pre-Todo-7 symlink mechanism).
// They are NEVER deleted, renamed or migrated: activation imports their omo
// config as an omo.jsonc profile block, then bakes it (see importLegacyProfile
// / activateProfile). fs is used for READS ONLY here (grep gate: no
// rmSync/renameSync/mkdirSync/symlinkSync in this file).
const LEGACY_PROFILES_DIR = path.join(os.homedir(), '.config', 'opencode-profiles');

// Names that are NOT profiles even though they live under the legacy dir:
// the .omo plugin-state dir, .zip artifacts, and backup snapshots (e.g.
// backup-20260604-194722 holding *.opencode.json copies).
function isLegacyArtifactName(name) {
    return name.startsWith('.') || /\.zip$/i.test(name) || /^backup[-_]/i.test(name);
}

// Mirrors the OLD implementation (054c071~1): readdirSync + statSync()
// isDirectory() filter. Read-only. Missing dir / unreadable entries -> [].
function listLegacyProfileDirs() {
    let entries;
    try {
        entries = fs.readdirSync(LEGACY_PROFILES_DIR);
    } catch {
        return [];
    }
    return entries
        .filter((name) => !isLegacyArtifactName(name))
        .filter((name) => {
            try {
                return fs.statSync(path.join(LEGACY_PROFILES_DIR, name)).isDirectory();
            } catch {
                return false;
            }
        })
        .sort();
}

// Matches the legacy contract (tests assert these exact rejections): names must
// be non-empty strings without path separators or dot-navigation. Names are now
// JSON keys inside profiles (never filesystem paths), but the checks stay.
function safeName(name) {
    if (typeof name !== 'string' || name === '' || name.includes('/') || name.includes('\\')) {
        throw new Error('Invalid profile name');
    }
    if (name === '.' || name === '..') {
        throw new Error('Invalid profile name');
    }
    return name;
}

// Merged display list: omo.jsonc blocks first (operable), then legacy dirs
// that are NOT already omo blocks (read-only display). A dir that exists in
// both counts once — the omo block wins. `legacy` names are display-only.
function listProfiles() {
    const omoProfiles = configProviders.listOmoProfiles(OMO_CONFIG_PATH);
    const omoSet = new Set(omoProfiles);
    const legacyOnly = listLegacyProfileDirs().filter((name) => !omoSet.has(name));
    return {
        profiles: [...omoProfiles, ...legacyOnly],
        legacy: legacyOnly,
        // Todo 1 chain: OMO_PROFILE > OCX_PROFILE > OPENCODE_CONFIG_DIR suffix;
        // null when none is resolved (undefined normalized to null).
        active: configProviders.getResolvedActiveProfile() || null
    };
}

// Legacy dirs are never deleted: delete refuses legacy-only names, while
// activate auto-imports them first (importLegacyProfile). omo blocks sharing
// the name are unaffected (the name is then not legacy-only).
function assertNotLegacyOnly(name) {
    if (listProfiles().legacy.includes(name)) {
        throw new Error(`profile ${JSON.stringify(name)} 为 legacy 目录，只读，无法操作`);
    }
}

const isPlainObject = (value) => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
};

// Imports a legacy profile dir's omo config as profiles.<name>.[opencode] in
// the active ~/.omo/omo.jsonc. The legacy dir is READ-ONLY here (only its
// omo.jsonc — or oh-my-openagent.json as the bare-block fallback — is read).
// The block is the '[opencode]' key of omo.jsonc, or the whole doc when the
// legacy file is the bare block. Empty/missing config or an already-existing
// omo profile of the same name throws (no silent overwrite: delete first or
// switch directly). Returns { success, imported, name }.
function importLegacyProfile(name) {
    const safe = safeName(name);
    if (configProviders.getOmoProfile(OMO_CONFIG_PATH, safe)) {
        throw new Error(`profile ${JSON.stringify(safe)} 已存在，请先删除或直接切换`);
    }
    const dir = path.join(LEGACY_PROFILES_DIR, safe);

    let block = null;
    const omoFile = path.join(dir, 'omo.jsonc');
    if (fs.existsSync(omoFile) && fs.statSync(omoFile).isFile()) {
        let parsed;
        try {
            parsed = configProviders.parseJsonText(fs.readFileSync(omoFile, 'utf8'));
        } catch (e) {
            throw new Error(`legacy 目录 ${JSON.stringify(safe)} 的 omo.jsonc 解析失败: ${e.message}`);
        }
        if (!isPlainObject(parsed)) {
            throw new Error(`legacy 目录 ${JSON.stringify(safe)} 的 omo.jsonc 不是对象，无法导入`);
        }
        block = parsed['[opencode]'] || null;
    } else {
        const bareFile = path.join(dir, 'oh-my-openagent.json');
        if (fs.existsSync(bareFile) && fs.statSync(bareFile).isFile()) {
            try {
                block = configProviders.parseJsonText(fs.readFileSync(bareFile, 'utf8'));
            } catch (e) {
                throw new Error(`legacy 目录 ${JSON.stringify(safe)} 的 oh-my-openagent.json 解析失败: ${e.message}`);
            }
        }
    }

    if (!isPlainObject(block) || Object.keys(block).length === 0) {
        throw new Error(`legacy 目录 ${JSON.stringify(safe)} 没有可导入的 omo 配置（omo.jsonc / oh-my-openagent.json）或配置为空`);
    }
    configProviders.setOmoProfile(OMO_CONFIG_PATH, safe, block);
    return { success: true, imported: true, name: safe };
}

function createProfile(name) {
    const safe = safeName(name);
    // setOmoProfile writes profiles.<name>.[opencode] surgically and creates the
    // omo.jsonc skeleton first when the file does not exist yet (Todo 3).
    configProviders.setOmoProfile(OMO_CONFIG_PATH, safe, {});
    return { success: true };
}

function deleteProfile(name) {
    const safe = safeName(name);
    assertNotLegacyOnly(safe);
    const active = configProviders.getResolvedActiveProfile() || null;
    if (safe === active) {
        throw new Error('Cannot delete active profile');
    }
    // Read-side existence check first: deleting an absent profile (incl. files
    // with no "profiles" block) must no-op, not hit jsonc-parser's
    // "Can not delete in empty document" on the write-side delete.
    if (!configProviders.getOmoProfile(OMO_CONFIG_PATH, safe)) {
        return { success: true, removed: false };
    }
    configProviders.deleteOmoProfile(OMO_CONFIG_PATH, safe);
    return { success: true, removed: true };
}

function activateProfile(name) {
    const safe = safeName(name);
    let profile = configProviders.getOmoProfile(OMO_CONFIG_PATH, safe);
    if (!profile && listProfiles().legacy.includes(safe)) {
        // Legacy-only name: import its omo config as an omo profile first, then
        // bake below. The legacy dir stays untouched (import reads only).
        importLegacyProfile(safe);
        profile = configProviders.getOmoProfile(OMO_CONFIG_PATH, safe);
    }
    if (!profile) {
        throw new Error('Profile not found');
    }

    // M-C: baking merges only [opencode] back into the top-level [opencode]
    // block. A profile carrying any other top-level key (agents/categories/
    // models/[senpi]/[codex] — all allowed by OmoConfigProfileSchema) would lose
    // that content silently, so refuse the bake and leave profile + file intact.
    const foreignKeys = Object.keys(profile).filter((key) => key !== '[opencode]');
    if (foreignKeys.length > 0) {
        throw new Error(`profile 含非 [opencode] 键，无法 bake: ${foreignKeys.join(', ')}`);
    }

    const merged = configProviders.deepMergePreservingUnknown(
        configProviders.getOmoConfigBlock(OMO_CONFIG_PATH),
        profile['[opencode]'] || {}
    );
    configProviders.writeOmoBlock(OMO_CONFIG_PATH, merged, '[opencode]');
    configProviders.deleteOmoProfile(OMO_CONFIG_PATH, safe);
    return { success: true, message: `已激活 ${safe}` };
}

module.exports = {
    safeName,
    listProfiles,
    createProfile,
    deleteProfile,
    activateProfile,
    importLegacyProfile
};
