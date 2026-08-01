const MAX_RESOURCE_NAME_LENGTH = 128;

const SAFE_BASIC_NAME_RE = /^[A-Za-z0-9_-]+$/;
const SAFE_SPACED_NAME_RE = /^[A-Za-z0-9 _-]+$/;
const SAFE_DOTTED_NAME_RE = /^[A-Za-z0-9_. -]+$/;
const SAFE_AUTH_PROFILE_NAME_RE = /^[A-Za-z0-9_.@+ -]+$/;

function hasUnsafePathSegment(name) {
    return (
        name === '.' ||
        name === '..' ||
        name.includes('/') ||
        name.includes('\\') ||
        name.includes('\0')
    );
}

function isSafeResourceName(name, { allowSpaces = false, allowDots = false } = {}) {
    if (typeof name !== 'string') return false;
    if (!name || name.length > MAX_RESOURCE_NAME_LENGTH) return false;
    if (name.trim() !== name) return false;
    if (hasUnsafePathSegment(name)) return false;

    const pattern = allowDots
        ? SAFE_DOTTED_NAME_RE
        : allowSpaces
            ? SAFE_SPACED_NAME_RE
            : SAFE_BASIC_NAME_RE;

    return pattern.test(name);
}

function isSafeSkillName(name) {
    return isSafeResourceName(name);
}

function isSafePluginName(name) {
    return isSafeResourceName(name, { allowSpaces: true, allowDots: true });
}

function isSafeAgentName(name) {
    return isSafeResourceName(name, { allowSpaces: true });
}

function isSafeAuthProfileName(name) {
    if (typeof name !== 'string') return false;
    if (!name || name.length > MAX_RESOURCE_NAME_LENGTH) return false;
    if (name.trim() !== name) return false;
    if (hasUnsafePathSegment(name)) return false;
    return SAFE_AUTH_PROFILE_NAME_RE.test(name);
}

function findInvalidNamedEntry(entries, isSafeName) {
    if (!Array.isArray(entries)) return null;
    return entries.find((entry) => !entry || !isSafeName(entry.name)) || null;
}

function createInvalidResourceNameError(type, name) {
    const error = new Error(`Invalid ${type} name: ${typeof name === 'string' ? name : String(name)}`);
    error.statusCode = 400;
    error.code = `INVALID_${type.toUpperCase()}_NAME`;
    return error;
}

function createInvalidResourceListError(type) {
    const error = new Error(`Invalid ${type} list`);
    error.statusCode = 400;
    error.code = `INVALID_${type.toUpperCase()}_LIST`;
    return error;
}

function getNamedEntries(entries, type) {
    if (entries === undefined) return [];
    if (!Array.isArray(entries)) throw createInvalidResourceListError(type);
    return entries;
}

function assertSafeBackupResourceNames(backup = {}) {
    const skills = getNamedEntries(backup.skills, 'skills');
    const invalidSkill = findInvalidNamedEntry(skills, isSafeSkillName);
    if (invalidSkill) {
        throw createInvalidResourceNameError('skill', invalidSkill.name);
    }

    const plugins = getNamedEntries(backup.plugins, 'plugins');
    const invalidPlugin = findInvalidNamedEntry(plugins, isSafePluginName);
    if (invalidPlugin) {
        throw createInvalidResourceNameError('plugin', invalidPlugin.name);
    }
}

module.exports = {
    MAX_RESOURCE_NAME_LENGTH,
    isSafeResourceName,
    isSafeSkillName,
    isSafePluginName,
    isSafeAgentName,
    isSafeAuthProfileName,
    findInvalidNamedEntry,
    createInvalidResourceNameError,
    assertSafeBackupResourceNames,
};
