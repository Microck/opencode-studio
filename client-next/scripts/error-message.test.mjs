import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorMessage } from '../src/lib/error-message.mjs';

test('extracts backend errors and ordinary exception messages', () => {
    assert.equal(errorMessage({ response: { data: { error: 'denied' } }, message: 'transport' }, 'fallback'), 'denied');
    assert.equal(errorMessage(new Error('offline'), 'fallback'), 'offline');
});
test('never passes object error payloads to translated UI messages', () => {
    for (const error of [null, undefined, 'raw', 42, { message: {} }, { response: { data: { error: { secret: 'value' } } } }]) {
        assert.equal(errorMessage(error, 'fallback'), 'fallback');
    }
});
