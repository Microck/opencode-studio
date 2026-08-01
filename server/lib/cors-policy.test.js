const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const {
    corsOptions,
    isAllowedOrigin,
    setLocalNetworkAccessHeaders,
} = require('./cors-policy');

function runLocalNetworkMiddleware(headers) {
    const appliedHeaders = {};
    const req = { headers };
    const res = {
        setHeader(name, value) {
            appliedHeaders[name] = value;
        },
    };
    let nextCalled = false;

    setLocalNetworkAccessHeaders(req, res, () => {
        nextCalled = true;
    });

    return { appliedHeaders, nextCalled };
}

describe('cors policy', () => {
    it('allows hosted studio origins and local development origins', () => {
        assert.equal(isAllowedOrigin('https://opencode-studio.micr.dev'), true);
        assert.equal(isAllowedOrigin('https://opencode.micr.dev'), true);
        assert.equal(isAllowedOrigin('http://127.0.0.1:1080'), true);
        assert.equal(isAllowedOrigin('http://localhost:1089'), true);
    });

    it('rejects unrelated origins', () => {
        assert.equal(isAllowedOrigin('https://example.com'), false);
    });

    it('keeps cors origin checks wired through the shared origin policy', () => {
        corsOptions.origin('https://opencode-studio.micr.dev', (error, allowed) => {
            assert.equal(error, null);
            assert.equal(allowed, true);
        });

        corsOptions.origin('https://example.com', (error, allowed) => {
            assert.equal(error, null);
            assert.equal(allowed, false);
        });
    });

    it('opts allowed hosted origins into private network preflights', () => {
        const { appliedHeaders, nextCalled } = runLocalNetworkMiddleware({
            origin: 'https://opencode-studio.micr.dev',
            'access-control-request-private-network': 'true',
        });

        assert.equal(nextCalled, true);
        assert.equal(appliedHeaders['Access-Control-Allow-Private-Network'], 'true');
    });

    it('does not opt unrelated origins into private network preflights', () => {
        const { appliedHeaders, nextCalled } = runLocalNetworkMiddleware({
            origin: 'https://example.com',
            'access-control-request-private-network': 'true',
        });

        assert.equal(nextCalled, true);
        assert.deepEqual(appliedHeaders, {});
    });
});
