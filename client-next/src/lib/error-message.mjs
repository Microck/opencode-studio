/** @param {unknown} error @param {string} fallback */
export function errorMessage(error, fallback) {
    if (error && typeof error === 'object') {
        if ('response' in error && error.response && typeof error.response === 'object'
            && 'data' in error.response && error.response.data && typeof error.response.data === 'object'
            && 'error' in error.response.data && typeof error.response.data.error === 'string'
            && error.response.data.error) return error.response.data.error;
        if ('message' in error && typeof error.message === 'string' && error.message) return error.message;
    }
    return fallback;
}
