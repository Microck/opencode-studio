const ALLOWED_ORIGINS = [
    'https://opencode-studio.vercel.app',
    'https://opencode.micr.dev',
    'https://opencode-studio.micr.dev',
];

function isAllowedOrigin(origin) {
    if (origin === undefined) return true; // Native CLI requests have no Origin.
    if (typeof origin !== 'string' || origin === 'null') return false;
    let url;
    try { url = new URL(origin); } catch { return false; }
    // An Origin is exactly a serialized origin, never credentials, paths or lists.
    if (url.origin !== origin || url.username || url.password) return false;
    if (ALLOWED_ORIGINS.includes(origin)) return true;
    if (url.protocol !== 'http:' || !/^108\d$/.test(url.port)) return false;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]') return true;
    const octets = url.hostname.split('.');
    return octets.length === 4 && octets[0] === '192' && octets[1] === '168' &&
        octets.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

function isAllowedHost(host) {
    if (typeof host !== 'string') return false;
    try {
        const url = new URL('http://' + host);
        return url.host === host.toLowerCase() &&
            ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch { return false; }
}

// CORS alone only controls whether JavaScript may READ the response. Reject
// untrusted browser requests before parsing bodies or running mutating routes.
function rejectUntrustedOrigin(req, res, next) {
    if (!isAllowedHost(req.headers.host) || !isAllowedOrigin(req.headers.origin) ||
        (req.headers.origin === undefined && req.headers['sec-fetch-site'] === 'cross-site')) {
        return res.status(403).json({ error: 'Untrusted request origin', code: 'UNTRUSTED_ORIGIN' });
    }
    next();
}

function setLocalNetworkAccessHeaders(req, res, next) {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
        const asksForPrivateNetwork = req.headers['access-control-request-private-network'] === 'true';
        const asksForLocalNetwork = req.headers['access-control-request-local-network'] === 'true';
        if (asksForPrivateNetwork || asksForLocalNetwork) {
            res.setHeader('Access-Control-Allow-Private-Network', 'true');
        }
    }
    next();
}

const corsOptions = {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
};

module.exports = { ALLOWED_ORIGINS, corsOptions, isAllowedOrigin, isAllowedHost, rejectUntrustedOrigin, setLocalNetworkAccessHeaders };
