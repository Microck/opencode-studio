const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME_DIR = os.homedir();
const OPENCODE_DIR = path.join(HOME_DIR, '.config', 'opencode');
const PROFILES_DIR = path.join(HOME_DIR, '.config', 'opencode-profiles');

function safeName(name) {
    if (!name || typeof name !== 'string' || name.includes('/') || name.includes('\\') || /[\x00-\x1f]/.test(name)) {
        throw new Error('Invalid profile name');
    }
    const target = path.resolve(PROFILES_DIR, name);
    if (path.dirname(target) !== path.resolve(PROFILES_DIR)) {
        throw new Error('Invalid profile name');
    }
    return name;
}

function ensureProfilesDirectory() {
    fs.mkdirSync(PROFILES_DIR, { recursive: true });
}

function isSymlink(filepath) {
    try {
        return fs.lstatSync(filepath).isSymbolicLink();
    } catch {
        return false;
    }
}

function init() {
    ensureProfilesDirectory();
    const defaultProfilePath = path.join(PROFILES_DIR, 'default');
    
    if (fs.existsSync(OPENCODE_DIR) && !isSymlink(OPENCODE_DIR)) {
        if (!fs.existsSync(defaultProfilePath)) {
            console.log('[Profiles] Migrating existing config to "default" profile');
            fs.renameSync(OPENCODE_DIR, defaultProfilePath);
            try {
                fs.symlinkSync(defaultProfilePath, OPENCODE_DIR, 'junction');
            } catch (error) {
                fs.renameSync(defaultProfilePath, OPENCODE_DIR);
                throw error;
            }
        }
    } else if (!fs.existsSync(OPENCODE_DIR) && !isSymlink(OPENCODE_DIR)) {
        fs.mkdirSync(defaultProfilePath, { recursive: true });
        fs.symlinkSync(defaultProfilePath, OPENCODE_DIR, 'junction');
    }
}

function listProfiles() {
    init();
    const profiles = fs.readdirSync(PROFILES_DIR).filter(f => {
        return fs.lstatSync(path.join(PROFILES_DIR, f)).isDirectory();
    });
    
    let active = null;
    if (isSymlink(OPENCODE_DIR)) {
        const target = fs.readlinkSync(OPENCODE_DIR);
        active = path.basename(target);
    } else {
        active = 'default (unmanaged)';
    }
    
    return { profiles, active };
}

function createProfile(name) {
    safeName(name);
    ensureProfilesDirectory();
    const dir = path.join(PROFILES_DIR, name);
    if (fs.existsSync(dir)) throw new Error('Profile already exists');
    fs.mkdirSync(dir, { recursive: true });
    return { success: true };
}

function deleteProfile(name) {
    safeName(name);
    const { active } = listProfiles();
    if (name === active) throw new Error('Cannot delete active profile');
    if (name === 'default') throw new Error('Cannot delete default profile');
    
    const dir = path.join(PROFILES_DIR, name);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    return { success: true };
}

function activateProfile(name) {
    safeName(name);
    init();
    const target = path.join(PROFILES_DIR, name);
    let targetInfo;
    try { targetInfo = fs.lstatSync(target); } catch { throw new Error('Profile not found'); }
    if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink()) {
        throw new Error('Profile must be a local directory');
    }
    // Never remove a real config directory, even when a default profile already
    // exists and automatic migration cannot safely choose which copy to keep.
    if (!isSymlink(OPENCODE_DIR)) {
        throw new Error('Existing unmanaged config must be backed up or migrated before switching profiles');
    }
    const nonce = require('crypto').randomBytes(8).toString('hex');
    const pending = OPENCODE_DIR + '.next-' + nonce;
    const previous = OPENCODE_DIR + '.previous-' + nonce;
    fs.symlinkSync(target, pending, 'junction');
    let moved = false;
    try {
        fs.renameSync(OPENCODE_DIR, previous);
        moved = true;
        fs.renameSync(pending, OPENCODE_DIR);
    } catch (error) {
        if (moved) fs.renameSync(previous, OPENCODE_DIR);
        throw error;
    } finally {
        if (isSymlink(pending)) fs.unlinkSync(pending);
    }
    // Only unlink our old link; never recursively delete its target directory.
    fs.unlinkSync(previous);
    return { success: true };
}

module.exports = {
    safeName,
    listProfiles,
    createProfile,
    deleteProfile,
    activateProfile
};