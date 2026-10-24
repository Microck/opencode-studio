// Bind the actual application socket, not a probe socket that can be raced.
async function listenOnAvailablePort(app, startPort = 1920, attempts = 10) {
    for (let offset = 0; offset < attempts; offset++) {
        try {
            return await new Promise((resolve, reject) => {
                const server = app.listen(startPort + offset, '127.0.0.1');
                server.once('error', reject);
                server.once('listening', () => {
                    server.removeListener('error', reject);
                    resolve(server);
                });
            });
        } catch (error) {
            if (error.code !== 'EADDRINUSE') throw error;
        }
    }
    throw new Error(`No backend port available in ${startPort}-${startPort + attempts - 1}`);
}
module.exports = { listenOnAvailablePort };
