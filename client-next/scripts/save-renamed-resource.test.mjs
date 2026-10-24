import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveRenamedResource } from '../src/lib/save-renamed-resource.mjs';

test('failed destination save preserves the original resource', async () => {
    let deleted = false;
    await assert.rejects(saveRenamedResource('old', 'new', async () => { throw new Error('offline'); }, async () => { deleted = true; }), /offline/);
    assert.equal(deleted, false);
});
test('rename saves destination before deleting source', async () => {
    const calls = [];
    await saveRenamedResource('old', ' new ', async name => { calls.push(['save', name]); }, async name => { calls.push(['delete', name]); });
    assert.deepEqual(calls, [['save', 'new'], ['delete', 'old']]);
});
test('whitespace-only name change never deletes the saved resource', async () => {
    const calls = [];
    await saveRenamedResource('same', ' same ', async name => { calls.push(name); }, async () => { assert.fail('must not delete'); });
    assert.deepEqual(calls, ['same']);
});
test('failed removal retains the destination and reports failure', async () => {
    const resources = new Map([['old', 'content']]);
    await assert.rejects(saveRenamedResource('old', 'new', async name => { resources.set(name, 'content'); }, async () => { throw new Error('denied'); }), /denied/);
    assert.deepEqual([...resources.keys()], ['old', 'new']);
});
