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

describe('request origin enforcement', () => {
    const { rejectUntrustedOrigin, isAllowedHost } = require('./cors-policy');
    function request(headers) {
        let code=200, proceeded=false;
        rejectUntrustedOrigin({headers:{host:'127.0.0.1:1920',...headers}}, {
            status(value){code=value;return this;},json(){return this;},
        },()=>{proceeded=true;});
        return {code,proceeded};
    }
    it('rejects simple cross-origin writes before any route runs', () => {
        for(const origin of ['https://untrusted.example','https://unrelated.vercel.app','http://192.168.attacker.example:1080','null','', 'https://opencode.micr.dev/']) {
            assert.deepEqual(request({origin}),{code:403,proceeded:false});
        }
    });
    it('allows exact trusted origins and originless native requests', () => {
        for(const headers of [{},{origin:'https://opencode.micr.dev'},{origin:'http://localhost:1080'},{origin:'http://192.168.1.2:1089'}]) {
            assert.deepEqual(request(headers),{code:200,proceeded:true});
        }
    });
    it('rejects originless cross-site requests and DNS-rebinding hosts', () => {
        assert.deepEqual(request({'sec-fetch-site':'cross-site'}),{code:403,proceeded:false});
        assert.deepEqual(request({host:'untrusted.example:1920'}),{code:403,proceeded:false});
        assert.equal(isAllowedHost('127.0.0.1:1920'),true);
        assert.equal(isAllowedHost('[::1]:1920'),true);
        assert.equal(isAllowedHost('evil@127.0.0.1:1920'),false);
        assert.equal(isAllowedHost('127.0.0.1:1920/path'),false);
    });
});
