const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readConfigMaps, agentView, mergeNativeAgentUpdate } = require('./opencode-compat');

test('preserves legacy servers named servers or timeout', () => {
    const mcp = { servers: { type: 'local', command: ['fixture'] }, timeout: { type: 'remote', url: 'https://example.invalid' } };
    assert.deepEqual(readConfigMaps({ mcp }).mcp, mcp);
});

test('reads native v2 collections without mutating or discarding legacy siblings', () => {
    const config = {
        command: { old: { template: 'old' }, both: { template: 'v1' } },
        commands: { both: { template: 'v2' } },
        agents: { reviewer: { system: 'review', permissions: [{ action: 'shell', resource: '*', effect: 'deny' }] } },
        mcp: { timeout: { connect: 1000 }, servers: { local: { type: 'local', command: ['fixture'], disabled: true } } },
        provider: { legacy: { name: 'old' } }, providers: { native: { name: 'new' } },
    };
    const before = JSON.stringify(config);
    const result = readConfigMaps(config);
    assert.equal(result.commands.both.template, 'v2');
    assert.equal(result.commands.old.template, 'old');
    assert.deepEqual(Object.keys(result.mcp), ['local']);
    assert.equal(result.mcp.local.disabled, true);
    assert.deepEqual(Object.keys(result.providers), ['legacy', 'native']);
    assert.equal(JSON.stringify(config), before);
});

test('native agent view preserves ordered permissions and native settings', () => {
    const rules = [{ action: 'shell', resource: '*', effect: 'deny' }, { action: 'shell', resource: 'git status', effect: 'allow' }];
    const view = agentView({ system: 'review', steps: 7, disabled: true, permissions: rules, custom: 'preserved' }, true);
    assert.equal(view.prompt, 'review');
    assert.equal(view.maxSteps, 7);
    assert.equal(view.disable, true);
    assert.deepEqual(view.nativePermissions, rules);
    assert.equal(view.custom, 'preserved');
});

test('native agent updates preserve unknown fields and ordered rules', () => {
    const original = { system: 'old', steps: 3, permissions: [{ action: 'shell', resource: '*', effect: 'deny' }], request: { custom: 'keep' } };
    const edited = mergeNativeAgentUpdate(original, { prompt: 'new', maxSteps: 5, permission: { '*': 'allow' }, temperature: 1 });
    assert.deepEqual(edited, { ...original, system: 'new', steps: 5 });
    assert.equal(original.system, 'old');
    assert.throws(() => mergeNativeAgentUpdate(original, { nativePermissions: { '*': 'allow' } }), { statusCode: 400 });
});


test('native explicit model selections display without losing their source representation', () => {
    const original = { model: { providerID: 'fixture', model: 'model', variant: 'high' }, system: 'old' };
    const view = agentView(original, true);
    assert.equal(view.model, 'fixture/model#high');
    assert.deepEqual(mergeNativeAgentUpdate(original, { model: view.model, prompt: 'new' }).model, original.model);
    assert.equal(mergeNativeAgentUpdate(original, { model: 'fixture/other' }).model, 'fixture/other');
});
