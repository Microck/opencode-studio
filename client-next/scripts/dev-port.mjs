import net from 'node:net';

// Stay within the origins accepted by the backend. Never hide permission errors.
export async function findAvailablePort(startPort = 1080, attempts = 10, createServer = () => net.createServer()) {
    for (let offset = 0; offset < attempts; offset++) {
        const port = startPort + offset;
        try {
            await new Promise((resolve, reject) => {
                const server = createServer();
                server.once('error', reject);
                server.listen(port, '127.0.0.1', () => server.close(error => error ? reject(error) : resolve()));
            });
            return port;
        } catch (error) {
            if (error.code !== 'EADDRINUSE') throw error;
        }
    }
    throw new Error(`No frontend port available in ${startPort}-${startPort + attempts - 1}`);
}
