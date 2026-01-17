const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const HOME_DIR = os.homedir();
const CONFIG_DIR = path.join(HOME_DIR, '.config', 'opencode-studio');
const PROXY_CONFIG_FILE = path.join(CONFIG_DIR, 'cliproxy.yaml');
const PROXY_AUTH_DIR = path.join(HOME_DIR, '.cli-proxy-api');

let proxyProcess = null;
let isProxyRunning = false;

// Helper to check if binary exists
const checkBinary = (cmd) => {
    return new Promise((resolve) => {
        if (path.isAbsolute(cmd)) {
            return resolve(fs.existsSync(cmd));
        }
        const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
        exec(checkCmd, (err) => {
            resolve(!err);
        });
    });
};

const getProxyCommand = async () => {
    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA;
        if (localAppData) {
            const aliases = ['CLIProxyAPI.exe', 'cli-proxy-api.exe', 'cliproxyapi.exe'];
            for (const alias of aliases) {
                const wingetPath = path.join(localAppData, 'Microsoft', 'WinGet', 'Links', alias);
                if (fs.existsSync(wingetPath)) return wingetPath;
            }
            
            const progPath = path.join(localAppData, 'Programs', 'CLIProxyAPI', 'CLIProxyAPI.exe');
            if (fs.existsSync(progPath)) return progPath;
        }
    }

    if (await checkBinary('cli-proxy-api')) return 'cli-proxy-api';
    if (await checkBinary('cliproxyapi')) return 'cliproxyapi';
    if (await checkBinary('CLIProxyAPI')) return 'CLIProxyAPI';
    if (await checkBinary('cliproxyapi.exe')) return 'cliproxyapi.exe';
    if (await checkBinary('cliproxy')) return 'cliproxy';
    return null;
};

// Config Management
const loadProxyConfig = () => {
    if (!fs.existsSync(PROXY_CONFIG_FILE)) {
        // Default config
        const defaultConfig = {
            port: 8317,
            cors: true,
            "allow-origin": "*",
            "auth-dir": PROXY_AUTH_DIR,
            "management-key": "",
            routing: { strategy: "round-robin" },
            "quota-exceeded": {
                "switch-project": true,
                "switch-preview-model": true
            },
            "gemini-api-key": []
        };
        saveProxyConfig(defaultConfig);
        return defaultConfig;
    }
    
    try {
        const content = fs.readFileSync(PROXY_CONFIG_FILE, 'utf8');
        const config = yaml.load(content);
        if (config && config['management-key'] === undefined) {
            config['management-key'] = "";
            saveProxyConfig(config);
        }
        if (config && config.cors === undefined) {
            config.cors = true;
            config['allow-origin'] = "*";
            saveProxyConfig(config);
        }
        return config;
    } catch (e) {
        console.error("Failed to load proxy config:", e);
        return {};
    }
};

const saveProxyConfig = (config) => {
    try {
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
        const content = yaml.dump(config);
        fs.writeFileSync(PROXY_CONFIG_FILE, content);
    } catch (e) {
        console.error("Failed to save proxy config:", e);
    }
};

// Process Management
const startProxy = async () => {
    if (isProxyRunning) return { success: true, message: "Already running" };

    const cmd = await getProxyCommand();
    if (!cmd) return { success: false, error: "CLIProxyAPI binary not found. Please install it." };

    // Ensure config exists
    if (!fs.existsSync(PROXY_CONFIG_FILE)) loadProxyConfig();

    console.log(`Starting proxy with command: ${cmd} -config ${PROXY_CONFIG_FILE}`);
    
    try {
        // -no-browser flag to prevent it from trying to open browser on startup if that's a thing
        proxyProcess = spawn(cmd, ['-config', PROXY_CONFIG_FILE], {
            detached: false,
            stdio: 'pipe' 
        });

        proxyProcess.stdout.on('data', (data) => {
            console.log(`[Proxy] ${data}`);
        });

        proxyProcess.stderr.on('data', (data) => {
            console.error(`[Proxy Err] ${data}`);
        });

        proxyProcess.on('close', (code) => {
            console.log(`[Proxy] Exited with code ${code}`);
            isProxyRunning = false;
            proxyProcess = null;
        });

        isProxyRunning = true;
        return { success: true, pid: proxyProcess.pid };
    } catch (e) {
        return { success: false, error: e.message };
    }
};

const stopProxy = () => {
    if (proxyProcess) {
        proxyProcess.kill();
        proxyProcess = null;
        isProxyRunning = false;
        return { success: true };
    }
    return { success: false, error: "Not running" };
};

const getStatus = async () => {
    const cmd = await getProxyCommand();
    return { 
        running: isProxyRunning, 
        pid: proxyProcess?.pid,
        configFile: PROXY_CONFIG_FILE,
        port: 8317,
        installed: !!cmd,
        binary: cmd
    };
};

const runLogin = async (provider) => {
    const cmd = await getProxyCommand();
    if (!cmd) return { success: false, error: "Binary not found" };

    let loginFlag = '';
    switch(provider) {
        case 'google': 
        case 'antigravity': loginFlag = '-antigravity-login'; break;
        case 'openai': 
        case 'codex': loginFlag = '-codex-login'; break;
        case 'anthropic': loginFlag = '-claude-login'; break;
        default: return { success: false, error: "Unknown provider" };
    }

    // Return the command so the UI can spawn a terminal for it
    // We pass the config file so it saves the token to the right place/knows the auth-dir
    const fullCmd = `${cmd} ${loginFlag} -config "${PROXY_CONFIG_FILE}"`;
    
    return { 
        success: true, 
        command: fullCmd,
        message: "Terminal launching..."
    };
};

const listAccounts = () => {
    if (!fs.existsSync(PROXY_AUTH_DIR)) return [];
    try {
        return fs.readdirSync(PROXY_AUTH_DIR)
            .filter(f => f.endsWith('.json'))
            .map(f => {
                const parts = f.replace('.json', '').split('-');
                const provider = parts[0];
                const email = parts.slice(1).join('-').replace(/_/g, '.').replace('.gmail.com', '@gmail.com');
                return { id: f, provider, email: email || f };
            });
    } catch {
        return [];
    }
};

module.exports = {
    startProxy,
    stopProxy,
    getStatus,
    loadProxyConfig,
    saveProxyConfig,
    runLogin,
    listAccounts
};