// Read aliases without rewriting the source. Native v2 entries win conflicts.
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const map = value => isObject(value) ? value : {};

function hasNativeMcp(config = {}) {
    const mcp = map(config.mcp);
    return (isObject(mcp.servers) && !('type' in mcp.servers))
        || (isObject(mcp.timeout) && !('type' in mcp.timeout));
}

function readConfigMaps(config = {}) {
    const mcp = map(config.mcp);
    const nativeMcp = hasNativeMcp(config);
    const legacyMcp = nativeMcp
        ? Object.fromEntries(Object.entries(mcp).filter(([key]) => key !== 'servers' && key !== 'timeout'))
        : mcp;
    return {
        agents: { ...map(config.agent), ...map(config.agents) },
        commands: { ...map(config.command), ...map(config.commands) },
        providers: { ...map(config.provider), ...map(config.model?.providers), ...map(config.providers) },
        mcp: { ...legacyMcp, ...(nativeMcp ? map(mcp.servers) : {}) },
    };
}

function pluginName(entry) {
    if (typeof entry === 'string') return entry;
    if (Array.isArray(entry)) return typeof entry[0] === 'string' ? entry[0] : null;
    return isObject(entry) ? entry.package || entry.name || entry.npm || null : null;
}

function isNativeAgent(config) {
    return isObject(config) && (Array.isArray(config.permissions) || ['system', 'steps', 'disabled', 'request'].some(key => Object.hasOwn(config, key)));
}

function modelLabel(model) {
    return isObject(model) && typeof model.providerID === 'string' && typeof model.model === 'string'
        ? `${model.providerID}/${model.model}${model.variant ? `#${model.variant}` : ''}`
        : model;
}

function agentView(config, native = false) {
    return {
        ...config,
        model: native ? modelLabel(config.model) : config.model,
        prompt: native ? config.system ?? '' : config.prompt ?? '',
        maxSteps: native ? config.steps : config.maxSteps,
        disable: native ? config.disabled : config.disable,
        configurationFormat: native ? 'v2' : 'v1',
        // Ordered v2 rules must not be flattened into the legacy permission map.
        ...(native ? { nativePermissions: config.permissions, permission: undefined, permissions: undefined } : {}),
    };
}

function mergeNativeAgentUpdate(existing, update) {
    const result = { ...existing };
    for (const key of ['description', 'mode', 'model', 'hidden']) {
        if (Object.hasOwn(update, key) && !(key === 'model' && update.model === modelLabel(existing.model))) result[key] = update[key];
    }
    for (const [legacy, native] of [['prompt', 'system'], ['maxSteps', 'steps'], ['disable', 'disabled']]) {
        if (Object.hasOwn(update, legacy)) result[native] = update[legacy];
    }
    if (Object.hasOwn(update, 'nativePermissions')) {
        const rules = update.nativePermissions;
        if (!Array.isArray(rules) || rules.some(rule => !isObject(rule)
            || typeof rule.action !== 'string' || typeof rule.resource !== 'string'
            || !['ask', 'allow', 'deny'].includes(rule.effect))) {
            throw Object.assign(new Error('Invalid ordered v2 permission rules'), { statusCode: 400 });
        }
        result.permissions = rules.map(rule => ({ ...rule }));
    }
    return result;
}

module.exports = { pluginName, isNativeAgent, hasNativeMcp, readConfigMaps, agentView, mergeNativeAgentUpdate };
