const ALLOWED_ORIGINS = [
    'http://192.168.10.100:1080',
    /^http:\/\/192\.168\..+:108\d$/,
    /^http:\/\/192\.168\.10\.\d{1,3}:108\d$/,
    'http://localhost:1080',
    'http://127.0.0.1:1080',
    /^http:\/\/localhost:108\d$/,
    /^http:\/\/127\.0\.0\.1:108\d$/,
    'https://opencode-studio.vercel.app',
    'https://opencode.micr.dev',
    'https://opencode-studio.micr.dev',
    /\.vercel\.app$/,
    /\.micr\.dev$/,
];

function isAllowedOrigin(origin) {
    if (!origin) return true;
    return ALLOWED_ORIGINS.some((allowedOrigin) =>
        allowedOrigin instanceof RegExp ? allowedOrigin.test(origin) : allowedOrigin === origin
    );
}

function setLocalNetworkAccessHeaders(req, res, next) {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
        const asksForPrivateNetwork = req.headers['access-control-request-private-network'] === 'true';
        const asksForLocalNetwork = req.headers['access-control-request-local-network'] === 'true';

        if (asksForPrivateNetwork || asksForLocalNetwork) {
            // Chrome's older Private Network Access preflight path requires this
            // explicit opt-in from local HTTP services.
            res.setHeader('Access-Control-Allow-Private-Network', 'true');
        }
    }

    next();
}

const corsOptions = {
    origin: (origin, callback) => {
        callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
};

module.exports = {
    ALLOWED_ORIGINS,
    corsOptions,
    isAllowedOrigin,
    setLocalNetworkAccessHeaders,
};
