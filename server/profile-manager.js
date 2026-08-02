const path = require('path');
const os = require('os');
const configProviders = require('./lib/config-providers');

// Profiles live in the ~/.omo/omo.jsonc "profiles" block (Todo 7: symlink
// mechanism replaced by bake-only activation). os.homedir() respects $HOME on
// POSIX, so sandboxed QA with HOME=$(mktemp -d) works out of the box.
const OMO_CONFIG_PATH = path.join(os.homedir(), '.omo', 'omo.jsonc');

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

function listProfiles() {
    return {
        profiles: configProviders.listOmoProfiles(OMO_CONFIG_PATH),
        // Todo 1 chain: OMO_PROFILE > OCX_PROFILE > OPENCODE_CONFIG_DIR suffix;
        // null when none is resolved (undefined normalized to null).
        active: configProviders.getResolvedActiveProfile() || null
    };
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
    const profile = configProviders.getOmoProfile(OMO_CONFIG_PATH, safe);
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
    activateProfile
};
