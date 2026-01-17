const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME_DIR = os.homedir();
const OPENCODE_DIR = path.join(HOME_DIR, '.config', 'opencode');
const PROFILES_DIR = path.join(HOME_DIR, '.config', 'opencode-profiles');

if (!fs.existsSync(PROFILES_DIR)) {
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
    const defaultProfilePath = path.join(PROFILES_DIR, 'default');
    
    if (fs.existsSync(OPENCODE_DIR) && !isSymlink(OPENCODE_DIR)) {
        if (!fs.existsSync(defaultProfilePath)) {
            console.log('[Profiles] Migrating existing config to "default" profile');
            fs.renameSync(OPENCODE_DIR, defaultProfilePath);
            fs.symlinkSync(defaultProfilePath, OPENCODE_DIR, 'junction');
        }
    } else if (!fs.existsSync(OPENCODE_DIR) && !isSymlink(OPENCODE_DIR)) {
        fs.mkdirSync(defaultProfilePath, { recursive: true });
        fs.symlinkSync(defaultProfilePath, OPENCODE_DIR, 'junction');
    }
}

function listProfiles() {
    init();
    const profiles = fs.readdirSync(PROFILES_DIR).filter(f => {
        return fs.statSync(path.join(PROFILES_DIR, f)).isDirectory();
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
    const dir = path.join(PROFILES_DIR, name);
    if (fs.existsSync(dir)) throw new Error('Profile already exists');
    fs.mkdirSync(dir, { recursive: true });
    return { success: true };
}

function deleteProfile(name) {
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
    const target = path.join(PROFILES_DIR, name);
    if (!fs.existsSync(target)) throw new Error('Profile not found');
    
    if (fs.existsSync(OPENCODE_DIR)) {
        fs.rmSync(OPENCODE_DIR, { recursive: true, force: true });
    }
    
    fs.symlinkSync(target, OPENCODE_DIR, 'junction');
    return { success: true };
}

module.exports = {
    listProfiles,
    createProfile,
    deleteProfile,
    activateProfile
};