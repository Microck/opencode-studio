const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec, execSync } = require('child_process');
const yaml = require('js-yaml');

const pkg = require('./package.json');
const profileManager = require('./profile-manager');
const SERVER_VERSION = pkg.version;
const MIN_CLIENT_VERSION = '1.16.0';

function compareVersions(current, minimum) {
    const c = current.split('.').map(Number);
    const m = minimum.split('.').map(Number);
    for (let i = 0; i < Math.max(c.length, m.length); i++) {
        const cv = c[i] || 0;
        const mv = m[i] || 0;
        if (cv > mv) return 1;
        if (cv < mv) return -1;
    }
    return 0;
}

// Atomic file write: write to temp file then rename to prevent corruption
const atomicWriteFileSync = (filePath, data, options = 'utf8') => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tempPath = path.join(dir, `.${path.basename(filePath)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
        fs.writeFileSync(tempPath, data, options);
        // Retry rename for Windows file locking issues
        let retries = 5;
        while (retries > 0) {
            try {
                fs.renameSync(tempPath, filePath);
                break;
            } catch (e) {
                if (retries === 1) throw e;
                retries--;
                // Synchronous delay
                const start = Date.now();
                while (Date.now() - start < 50) {} 
            }
        }
    } catch (err) {
        if (fs.existsSync(tempPath)) {
            try { fs.unlinkSync(tempPath); } catch (e) {}
        }
        throw err;
    }
};

const app = express();
const DEFAULT_PORT = 1920;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

function findAvailablePort(startPort) {
    const net = require('net');
    return new Promise((resolve) => {
        const server = net.createServer();
        server.listen(startPort, () => {
            server.once('close', () => resolve(startPort));
            server.close();
        });
        server.on('error', () => {
            findAvailablePort(startPort + 1).then(resolve);
        });
    });
}

let idleTimer = null;

function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
        console.log('Server idle for 30 minutes, shutting down...');
        process.exit(0);
    }, IDLE_TIMEOUT_MS);
}

resetIdleTimer();

app.use((req, res, next) => {
    resetIdleTimer();
    next();
});

const ALLOWED_ORIGINS = [
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

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const allowed = ALLOWED_ORIGINS.some(o =>
            o instanceof RegExp ? o.test(origin) : o === origin
        );
        callback(null, allowed);
    },
    credentials: true,
}));

app.use((req, res, next) => {
    const clientVersion = req.headers['x-client-version'];
    if (clientVersion && compareVersions(clientVersion, MIN_CLIENT_VERSION) < 0) {
        return res.status(426).json({
            error: 'Client version outdated',
            message: `Your client version (${clientVersion}) is no longer supported. Please upgrade to ${MIN_CLIENT_VERSION} or later.`,
            minRequired: MIN_CLIENT_VERSION,
            current: SERVER_VERSION
        });
    }
    next();
});
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.text({ type: ['text/*', 'application/yaml'], limit: '50mb' }));

const HOME_DIR = os.homedir();
const STUDIO_CONFIG_PATH = path.join(HOME_DIR, '.config', 'opencode-studio', 'studio.json');
const PENDING_ACTION_PATH = path.join(HOME_DIR, '.config', 'opencode-studio', 'pending-action.json');
const ANTIGRAVITY_ACCOUNTS_PATH = path.join(HOME_DIR, '.config', 'opencode', 'antigravity-accounts.json');
const LOG_DIR = path.join(HOME_DIR, '.local', 'share', 'opencode', 'log');

const LOG_BUFFER_SIZE = 100;
const logBuffer = [];
const logSubscribers = new Set();

let logWatcher = null;
let currentLogFile = null;
let logReadStream = null;

function enqueueLogLine(line) {
    const entry = { timestamp: Date.now(), line };
    logBuffer.push(entry);
    if (logBuffer.length > LOG_BUFFER_SIZE) logBuffer.shift();

    for (const sub of logSubscribers) {
        sub.queue.push(`data: ${JSON.stringify(entry)}\n\n`);
        flushSubscriber(sub);
    }
}

function flushSubscriber(sub) {
    if (sub.draining || sub.closed) return;
    while (sub.queue.length > 0) {
        const chunk = sub.queue[0];
        const ok = sub.res.write(chunk);
        if (!ok) {
            sub.draining = true;
            sub.res.once('drain', () => {
                sub.draining = false;
                flushSubscriber(sub);
            });
            return;
        }
        sub.queue.shift();
    }
}

function setupLogWatcher() {
    if (!fs.existsSync(LOG_DIR)) return;

    // Find latest log file
    const getLatestLog = () => {
        try {
            const files = fs.readdirSync(LOG_DIR)
                .filter(f => f.endsWith('.log'))
                .map(f => ({ name: f, time: fs.statSync(path.join(LOG_DIR, f)).mtime.getTime() }))
                .sort((a, b) => b.time - a.time);
            return files[0] ? path.join(LOG_DIR, files[0].name) : null;
        } catch {
            return null;
        }
    };

    const startTailing = (filePath) => {
        if (currentLogFile === filePath) return;
        if (logReadStream) logReadStream.destroy();
        
        currentLogFile = filePath;
        console.log(`Watching log file: ${filePath}`);
        
        let fileSize = 0;
        try {
            fileSize = fs.statSync(filePath).size;
        } catch {}

        // Tail from end initially
        let start = Math.max(0, fileSize - 10000); 
        
        const checkFile = () => {
            try {
                const stat = fs.statSync(filePath);
                if (stat.size > fileSize) {
                    const stream = fs.createReadStream(filePath, { 
                        start: fileSize, 
                        end: stat.size,
                        encoding: 'utf8' 
                    });
                    
                    stream.on('data', (chunk) => {
                        const lines = chunk.split('\n');
                        lines.forEach(processLogLine);
                    });
                    
                    fileSize = stat.size;
                }
            } catch (e) {
                // File might be rotated/deleted
                if (e.code === 'ENOENT') {
                    clearInterval(tailInterval);
                    const newLog = getLatestLog();
                    if (newLog && newLog !== currentLogFile) startTailing(newLog);
                }
            }
        };

        const tailInterval = setInterval(checkFile, 2000);
        logWatcher = tailInterval;
    };

    const initialLog = getLatestLog();
    if (initialLog) startTailing(initialLog);

    // Watch dir for new logs
    fs.watch(LOG_DIR, (eventType, filename) => {
        if (filename && filename.endsWith('.log')) {
            const latest = getLatestLog();
            if (latest && latest !== currentLogFile) {
                if (logWatcher) clearInterval(logWatcher);
                startTailing(latest);
            }
        }
    });
}

function processLogLine(line) {
    enqueueLogLine(line);
    // Detect LLM usage: service=llm providerID=... modelID=...
    // Example: service=llm providerID=openai modelID=gpt-5.2-codex sessionID=...
    const isUsage = line.includes('service=llm') && line.includes('stream');
    const isError = line.includes('service=llm') && (line.includes('error=') || line.includes('status=429'));
    
    if (!isUsage && !isError) return;

    const providerMatch = line.match(/providerID=([^\s]+)/);
    const modelMatch = line.match(/modelID=([^\s]+)/);
    
    if (providerMatch) {
        let provider = providerMatch[1];
        const model = modelMatch ? modelMatch[1] : 'unknown';
        
        // Normalize providers
        if (provider === 'codex') provider = 'openai';
        if (provider === 'claude') provider = 'anthropic';
        
        // Map provider to pool namespace
        let namespace = provider;
        if (provider === 'google') {
            const activePlugin = getActiveGooglePlugin();
            namespace = 'google.antigravity';
        }

        const metadata = loadPoolMetadata();
        if (!metadata._quota) metadata._quota = {};
        if (!metadata._quota[namespace]) metadata._quota[namespace] = {};
        
        const today = new Date().toISOString().split('T')[0];

        if (isUsage) {
            // Increment usage
            metadata._quota[namespace][today] = (metadata._quota[namespace][today] || 0) + 1;
            
            // Also update active account usage if possible
            const studio = loadStudioConfig();
            const activeProfile = studio.activeProfiles?.[provider];
            if (activeProfile && metadata[namespace]?.[activeProfile]) {
                metadata[namespace][activeProfile].usageCount = (metadata[namespace][activeProfile].usageCount || 0) + 1;
                metadata[namespace][activeProfile].lastUsed = Date.now();
            }
        } else if (isError) {
            // Check for quota exhaustion patterns
            const errorMsg = line.match(/error=(.+)/)?.[1] || '';
            const isQuotaError = line.includes('status=429') || 
                               errorMsg.toLowerCase().includes('quota') || 
                               errorMsg.toLowerCase().includes('rate limit');
                               
            if (isQuotaError) {
                console.log(`[LogWatcher] Detected quota exhaustion for ${namespace}`);
                
                // Reload metadata to ensure freshness
                const currentMeta = loadPoolMetadata();
                if (!currentMeta._quota) currentMeta._quota = {};
                if (!currentMeta._quota[namespace]) currentMeta._quota[namespace] = {};

                // Debounce check
                const lastRotation = currentMeta._quota[namespace].lastRotation || 0;
                if (Date.now() - lastRotation < 10000) { 
                    console.log(`[LogWatcher] Ignoring 429 (rotation debounce active)`);
                    return;
                }

                const studio = loadStudioConfig();
                const activeAccount = studio.activeProfiles?.[provider];
                
                let rotated = false;

                if (activeAccount) {
                    console.log(`[LogWatcher] Auto-rotating due to rate limit on ${activeAccount}`);
                    
                    if (!currentMeta[namespace]) currentMeta[namespace] = {};
                    if (!currentMeta[namespace][activeAccount]) currentMeta[namespace][activeAccount] = {};
                    
                    // Mark cooldown (1 hour)
                    currentMeta[namespace][activeAccount].cooldownUntil = Date.now() + 3600000;
                    currentMeta[namespace][activeAccount].lastCooldownReason = 'auto_429';
                    
                    savePoolMetadata(currentMeta); 
                    
                    // Attempt rotation
                    const result = rotateAccount(provider, 'auto_rotation_429');
                    if (result.success) {
                        console.log(`[LogWatcher] Successfully rotated to ${result.newAccount}`);
                        rotated = true;
                    } else {
                        console.log(`[LogWatcher] Auto-rotation failed: ${result.error}`);
                    }
                }

                if (rotated) return;

                // Fallback: Mark namespace exhausted
                currentMeta._quota[namespace].exhausted = true;
                currentMeta._quota[namespace].exhaustedDate = today;
                
                const currentUsage = currentMeta._quota[namespace][today] || 0;
                if (currentUsage > 5) {
                    currentMeta._quota[namespace].dailyLimit = currentUsage;
                }
                
                savePoolMetadata(currentMeta);
                return;
            }
        }

        savePoolMetadata(metadata);
    }
}



let pendingActionMemory = null;

function loadStudioConfig() {
    const defaultConfig = {
        disabledSkills: [],
        disabledPlugins: [],
        disabledAgents: [],
        activeProfiles: {},
        activeGooglePlugin: 'gemini',
        availableGooglePlugins: [],
        presets: [],
        githubRepo: null,
        cooldownRules: [
            { name: "Antigravity Claude Opus 4 (4h)", duration: 4 * 60 * 60 * 1000 },
            { name: "Gemini 3 Pro (24h)", duration: 24 * 60 * 60 * 1000 }
        ],
        pluginModels: {
            gemini: {
                "gemini-3-pro-preview": {
                    "id": "gemini-3-pro-preview",
                    "name": "3 Pro (Gemini CLI)",
                    "reasoning": true,
                    "options": { "thinkingConfig": { "thinkingLevel": "high", "includeThoughts": true } }
                },
                "gemini-2.5-flash": {
                    "id": "gemini-2.5-flash",
                    "name": "2.5 Flash (Gemini CLI)",
                    "reasoning": true,
                    "options": { "thinkingConfig": { "thinkingBudget": 8192, "includeThoughts": true } }
                },
                "gemini-2.0-flash": {
                    "id": "gemini-2.0-flash",
                    "name": "2.0 Flash (Free)",
                    "reasoning": false
                },
                "gemini-1.5-flash": {
                    "id": "gemini-1.5-flash",
                    "name": "1.5 Flash (Free)",
                    "reasoning": false
                }
            },
            antigravity: {
                "gemini-3-pro-preview": {
                    "id": "gemini-3-pro-preview",
                    "name": "3 Pro",
                    "release_date": "2025-11-18",
                    "reasoning": true,
                    "limit": { "context": 1000000, "output": 64000 },
                    "cost": { "input": 2, "output": 12, "cache_read": 0.2 },
                    "modalities": {
                        "input": ["text", "image", "video", "audio", "pdf"],
                        "output": ["text"]
                    },
                    "variants": {
                        "low": { "options": { "thinkingConfig": { "thinkingLevel": "low", "includeThoughts": true } } },
                        "medium": { "options": { "thinkingConfig": { "thinkingLevel": "medium", "includeThoughts": true } } },
                        "high": { "options": { "thinkingConfig": { "thinkingLevel": "high", "includeThoughts": true } } },
                        "xhigh": { "options": { "thinkingConfig": { "thinkingLevel": "xhigh", "includeThoughts": true } } }
                    }
                },
                "gemini-3-flash": {
                    "id": "gemini-3-flash",
                    "name": "3 Flash",
                    "release_date": "2025-12-17",
                    "reasoning": true,
                    "limit": { "context": 1048576, "output": 65536 },
                    "cost": { "input": 0.5, "output": 3, "cache_read": 0.05 },
                    "modalities": {
                        "input": ["text", "image", "video", "audio", "pdf"],
                        "output": ["text"]
                    },
                    "variants": {
                        "minimal": { "options": { "thinkingConfig": { "thinkingLevel": "minimal", "includeThoughts": true } } },
                        "low": { "options": { "thinkingConfig": { "thinkingLevel": "low", "includeThoughts": true } } },
                        "medium": { "options": { "thinkingConfig": { "thinkingLevel": "medium", "includeThoughts": true } } },
                        "high": { "options": { "thinkingConfig": { "thinkingLevel": "high", "includeThoughts": true } } },
                        "xhigh": { "options": { "thinkingConfig": { "thinkingLevel": "xhigh", "includeThoughts": true } } }
                    }
                },
                "gemini-2.5-flash-lite": {
                    "id": "gemini-2.5-flash-lite",
                    "name": "2.5 Flash Lite",
                    "reasoning": false
                },
                "google/gemini-3-flash": {
                    "id": "google/gemini-3-flash",
                    "name": "3 Flash (Google)",
                    "reasoning": true,
                    "limit": { "context": 1048576, "output": 65536 },
                    "cost": { "input": 0.5, "output": 3, "cache_read": 0.05 },
                    "modalities": {
                        "input": ["text", "image", "video", "audio", "pdf"],
                        "output": ["text"]
                    },
                    "variants": {
                        "minimal": { "options": { "thinkingConfig": { "thinkingLevel": "minimal", "includeThoughts": true } } },
                        "low": { "options": { "thinkingConfig": { "thinkingLevel": "low", "includeThoughts": true } } },
                        "medium": { "options": { "thinkingConfig": { "thinkingLevel": "medium", "includeThoughts": true } } },
                        "high": { "options": { "thinkingConfig": { "thinkingLevel": "high", "includeThoughts": true } } },
                        "xhigh": { "options": { "thinkingConfig": { "thinkingLevel": "xhigh", "includeThoughts": true } } }
                    }
                },
                "opencode/glm-4.7-free": {
                    "id": "opencode/glm-4.7-free",
                    "name": "GLM 4.7 Free",
                    "reasoning": false,
                    "limit": { "context": 128000, "output": 4096 },
                    "cost": { "input": 0, "output": 0 },
                    "modalities": {
                        "input": ["text"],
                        "output": ["text"]
                    }
                },
                "gemini-claude-sonnet-4-5-thinking": {
                    "id": "gemini-claude-sonnet-4-5-thinking",
                    "name": "Sonnet 4.5",
                    "reasoning": true,
                    "limit": { "context": 200000, "output": 64000 },
                    "modalities": {
                        "input": ["text", "image", "pdf"],
                        "output": ["text"]
                    },
                    "variants": {
                        "none": { "reasoning": false, "options": { "thinkingConfig": { "includeThoughts": false } } },
                        "low": { "options": { "thinkingConfig": { "thinkingBudget": 4000, "includeThoughts": true } } },
                        "medium": { "options": { "thinkingConfig": { "thinkingBudget": 16000, "includeThoughts": true } } },
                        "high": { "options": { "thinkingConfig": { "thinkingBudget": 32000, "includeThoughts": true } } },
                        "xhigh": { "options": { "thinkingConfig": { "thinkingBudget": 64000, "includeThoughts": true } } }
                    }
                },
                "gemini-claude-opus-4-5-thinking": {
                    "id": "gemini-claude-opus-4-5-thinking",
                    "name": "Opus 4.5",
                    "release_date": "2025-11-24",
                    "reasoning": true,
                    "limit": { "context": 200000, "output": 64000 },
                    "modalities": {
                        "input": ["text", "image", "pdf"],
                        "output": ["text"]
                    },
                    "variants": {
                        "low": { "options": { "thinkingConfig": { "thinkingBudget": 4000, "includeThoughts": true } } },
                        "medium": { "options": { "thinkingConfig": { "thinkingBudget": 16000, "includeThoughts": true } } },
                        "high": { "options": { "thinkingConfig": { "thinkingBudget": 32000, "includeThoughts": true } } },
                        "xhigh": { "options": { "thinkingConfig": { "thinkingBudget": 64000, "includeThoughts": true } } }
                    }
                }
            }
        }
    };

    if (!fs.existsSync(STUDIO_CONFIG_PATH)) return defaultConfig;
    try {
        const config = JSON.parse(fs.readFileSync(STUDIO_CONFIG_PATH, 'utf8'));
        const merged = { ...defaultConfig, ...config };
        
        if (config.cooldownRules) {
            defaultConfig.cooldownRules.forEach(defaultRule => {
                const existing = config.cooldownRules.find(r => r.name === defaultRule.name);
                if (!existing) {
                    merged.cooldownRules.push(defaultRule);
                }
            });
        }
        
        return merged;
    } catch {
        return defaultConfig;
    }
}

function saveStudioConfig(config) {
    try {
        atomicWriteFileSync(STUDIO_CONFIG_PATH, JSON.stringify(config, null, 2));
        return true;
    } catch (err) {
        console.error('Failed to save studio config:', err);
        return false;
    }
}

const getWslDistributions = () => {
    try {
        const { execSync } = require('child_process');
        const stdout = execSync('wsl.exe -l -q', { encoding: 'utf16le', stdio: ['ignore', 'pipe', 'pipe'], timeout: 1000 });
        return stdout.trim().split('\n').filter(d => d.length > 0);
    } catch {
        return [];
    }
};

const getPaths = () => {
    const platform = process.platform;
    const home = os.homedir();
    let candidates = [
        path.join(home, '.config', 'opencode', 'opencode.json'),
        path.join(home, '.local', 'share', 'opencode', 'opencode.json'),
        path.join(home, '.opencode', 'opencode.json'),
    ];
    if (platform === 'win32') {
        candidates.push(path.join(process.env.APPDATA, 'opencode', 'opencode.json'));
    }

    if (platform === 'win32') {
        const distros = getWslDistributions();
        for (const distro of distros) {
            candidates.push(`\\\\wsl$\\${distro}\\home\\${os.userInfo().username}\\.config\\opencode\\opencode.json`);
        }
    }

    const studioConfig = loadStudioConfig();
    let manualPath = studioConfig.configPath;

    if (manualPath && fs.existsSync(manualPath) && fs.statSync(manualPath).isDirectory()) {
        const potentialFile = path.join(manualPath, 'opencode.json');
        if (fs.existsSync(potentialFile)) {
            manualPath = potentialFile;
        }
    }

    let detected = null;
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            detected = p;
            break;
        }
    }

    return {
        detected,
        manual: manualPath,
        current: manualPath || detected,
        candidates: [...new Set(candidates)]
    };
};

const getOhMyOpenCodeConfigPath = () => {
    const cp = getConfigPath();
    if (!cp) return null;
    return path.join(path.dirname(cp), 'oh-my-opencode.json');
};

const getConfigPath = () => getPaths().current;

const getSearchRoots = () => {
    const roots = [];
    
    // 1. Directory of the currently active config
    const configPath = getConfigPath();
    if (configPath) roots.push(path.dirname(configPath));

    // 2. Current Working Directory
    roots.push(process.cwd());

    // 3. XDG Config Home
    const xdg = process.env.XDG_CONFIG_HOME;
    if (xdg) roots.push(path.join(xdg, 'opencode'));

    // 4. Home config
    roots.push(path.join(HOME_DIR, '.config', 'opencode'));

    // 5. Home dotfile
    roots.push(path.join(HOME_DIR, '.opencode'));

    // 6. Local share
    roots.push(path.join(HOME_DIR, '.local', 'share', 'opencode'));

    // 7. Windows AppData
    if (process.platform === 'win32' && process.env.APPDATA) {
        roots.push(path.join(process.env.APPDATA, 'opencode'));
    }

    // Filter nulls, duplicates and normalize
    const unique = [...new Set(roots.filter(Boolean).map(p => path.resolve(p)))];
    return unique;
};

const getSkillDirs = () => {
    const roots = getSearchRoots();
    const dirs = [];

    for (const root of roots) {
        const skillDir = path.join(root, 'skill');
        if (fs.existsSync(skillDir)) {
            dirs.push({ path: skillDir, source: 'skill-dir', root });
        }

        const skillsDir = path.join(root, 'skills');
        if (fs.existsSync(skillsDir)) {
            try {
                const packages = fs.readdirSync(skillsDir, { withFileTypes: true })
                    .filter(d => d.isDirectory());
                for (const pkg of packages) {
                    const nestedSkillsDir = path.join(skillsDir, pkg.name, 'skills');
                    if (fs.existsSync(nestedSkillsDir)) {
                        dirs.push({ path: nestedSkillsDir, source: 'skills-dir', root, package: pkg.name });
                    }
                    const pkgSkillFile = path.join(skillsDir, pkg.name, 'SKILL.md');
                    if (fs.existsSync(pkgSkillFile)) {
                        dirs.push({ path: path.join(skillsDir, pkg.name), source: 'skills-dir', root, package: pkg.name, isFlat: true });
                    }
                }
            } catch (e) {
                console.warn(`Failed to read skills from ${skillsDir}:`, e.message);
            }
        }
    }

    return dirs;
};

const getCommandDirs = () => {
    const roots = getSearchRoots();
    const dirs = [];

    for (const root of roots) {
        const cmdDir = path.join(root, 'command');
        if (fs.existsSync(cmdDir)) {
            dirs.push({ path: cmdDir, source: 'command-dir', root });
        }
    }

    return dirs;
};

const getMcpDirs = () => {
    const roots = getSearchRoots();
    const dirs = [];

    for (const root of roots) {
        const mcpDir = path.join(root, 'mcp');
        if (fs.existsSync(mcpDir)) {
            dirs.push({ path: mcpDir, source: 'mcp-dir', root });
        }
    }

    return dirs;
};

const getPluginDirs = () => {
    const roots = getSearchRoots();
    const dirs = [];

    for (const root of roots) {
        const pluginDir = path.join(root, 'plugin');
        if (fs.existsSync(pluginDir)) {
            dirs.push({ path: pluginDir, source: 'plugin-dir', root });
        }

        const pluginsDir = path.join(root, 'plugins');
        if (fs.existsSync(pluginsDir)) {
            dirs.push({ path: pluginsDir, source: 'plugins-dir', root });
        }
    }

    return dirs;
};

const loadCommandsFromDir = (dirInfo) => {
    const commands = [];
    if (!fs.existsSync(dirInfo.path)) return commands;

    try {
        const files = fs.readdirSync(dirInfo.path)
            .filter(f => f.endsWith('.md'));

        for (const file of files) {
            const filePath = path.join(dirInfo.path, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const name = path.basename(file, '.md');

            let metadata = {};
            let body = content;
            const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
            if (frontmatterMatch) {
                try {
                    metadata = yaml.load(frontmatterMatch[1]) || {};
                    body = frontmatterMatch[2].trim();
                } catch {}
            }

            commands.push({
                name,
                content: body,
                description: metadata.description || metadata.prompt || body.slice(0, 100).replace(/\n/g, ' '),
                source: dirInfo.source,
                path: filePath,
                root: dirInfo.root,
                ...metadata
            });
        }
    } catch (e) {
        console.warn(`Failed to load commands from ${dirInfo.path}:`, e.message);
    }

    return commands;
};

const loadMcpsFromDir = (dirInfo) => {
    const mcps = [];
    if (!fs.existsSync(dirInfo.path)) return mcps;

    try {
        const files = fs.readdirSync(dirInfo.path)
            .filter(f => f.endsWith('.json') || f.endsWith('.yaml') || f.endsWith('.yml'));

        for (const file of files) {
            const filePath = path.join(dirInfo.path, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const name = path.basename(file, path.extname(file));

            let config;
            try {
                if (file.endsWith('.json')) {
                    config = JSON.parse(content);
                } else {
                    config = yaml.load(content);
                }

                mcps.push({
                    name,
                    config,
                    source: dirInfo.source,
                    path: filePath,
                    root: dirInfo.root
                });
            } catch (e) {
                console.error(`Failed to parse MCP config ${filePath}:`, e.message);
            }
        }
    } catch (e) {
        console.warn(`Failed to load MCPs from ${dirInfo.path}:`, e.message);
    }

    return mcps;
};

const loadPluginsFromDir = (dirInfo) => {
    const plugins = [];
    if (!fs.existsSync(dirInfo.path)) return plugins;

    try {
        const files = fs.readdirSync(dirInfo.path)
            .filter(f => f.endsWith('.js') || f.endsWith('.ts'));

        for (const file of files) {
            const filePath = path.join(dirInfo.path, file);
            const content = fs.readFileSync(filePath, 'utf8');
            const name = path.basename(file, path.extname(file));

            plugins.push({
                name,
                filename: file,
                content,
                source: dirInfo.source,
                path: filePath,
                root: dirInfo.root
            });
        }
    } catch (e) {
        console.warn(`Failed to load plugins from ${dirInfo.path}:`, e.message);
    }

    return plugins;
};

const loadSkillsFromDir = (dirInfo) => {
    const skills = [];
    if (!fs.existsSync(dirInfo.path)) return skills;

    try {
        if (dirInfo.isFlat) {
            const name = dirInfo.package || path.basename(dirInfo.path);
            const skillPath = path.join(dirInfo.path, 'SKILL.md');
            if (!fs.existsSync(skillPath)) return skills;

            const content = fs.readFileSync(skillPath, 'utf8');
            const { data: metadata, body } = parseAgentMarkdown(content);

            skills.push({
                name,
                content: body,
                description: metadata.description || body.slice(0, 100).replace(/\n/g, ' '),
                source: dirInfo.source,
                path: skillPath,
                root: dirInfo.root,
                package: dirInfo.package,
                ...metadata
            });
        } else {
            const entries = fs.readdirSync(dirInfo.path, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;

                const skillPath = path.join(dirInfo.path, entry.name, 'SKILL.md');
                if (!fs.existsSync(skillPath)) continue;

                const content = fs.readFileSync(skillPath, 'utf8');
                const { data: metadata, body } = parseAgentMarkdown(content);

                skills.push({
                    name: entry.name,
                    content: body,
                    description: metadata.description || body.slice(0, 100).replace(/\n/g, ' '),
                    source: dirInfo.source,
                    path: skillPath,
                    root: dirInfo.root,
                    package: dirInfo.package,
                    ...metadata
                });
            }
        }
    } catch (e) {
        console.warn(`Failed to load skills from ${dirInfo.path}:`, e.message);
    }

    return skills;
};

const getAgentDirs = () => {
    const roots = getSearchRoots();
    const dirs = [];

    for (const root of roots) {
        dirs.push(path.join(root, 'agents'));
        dirs.push(path.join(root, 'agent'));
        dirs.push(path.join(root, '.opencode', 'agents'));
        dirs.push(path.join(root, '.opencode', 'agent'));
    }

    return [...new Set(dirs)];
};

const parseAgentMarkdown = (content) => {
    const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/);
    if (!match) return { data: {}, body: content };
    let data = {};
    try {
        data = yaml.load(match[1]) || {};
    } catch {
        data = {};
    }
    return { data, body: match[2] || '' };
};

const buildAgentMarkdown = (frontmatter, body) => {
    const yamlText = yaml.dump(frontmatter, { lineWidth: 120, noRefs: true, quotingType: '"' });
    const content = body || '';
    return `---\n${yamlText}---\n\n${content}`;
};

const validatePermissionValue = (value) => {
    const allowed = ['ask', 'allow', 'deny'];
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return allowed.includes(value);
    if (typeof value !== 'object') return false;

    const keys = Object.keys(value);
    const isAllowDeny = keys.every((k) => k === 'allow' || k === 'deny');
    if (isAllowDeny) {
        return (!value.allow || Array.isArray(value.allow)) && (!value.deny || Array.isArray(value.deny));
    }

    for (const v of Object.values(value)) {
        if (typeof v === 'string') {
            if (!allowed.includes(v)) return false;
        } else if (typeof v === 'object') {
            if (!validatePermissionValue(v)) return false;
        } else if (v !== undefined && v !== null) {
            return false;
        }
    }
    return true;
};

const findRulesFile = () => {
    const configPath = getConfigPath();
    if (!configPath) return { path: null, source: 'none' };

    let dir = path.dirname(configPath);
    let last = null;
    while (dir && dir !== last) {
        const agentsPath = path.join(dir, 'AGENTS.md');
        if (fs.existsSync(agentsPath)) return { path: agentsPath, source: 'AGENTS.md' };
        const claudePath = path.join(dir, 'CLAUDE.md');
        if (fs.existsSync(claudePath)) return { path: claudePath, source: 'CLAUDE.md' };
        last = dir;
        dir = path.dirname(dir);
    }

    return { path: null, source: 'none' };
};

const detectTool = (tool) => {
    const command = process.platform === 'win32' ? `where ${tool}` : `which ${tool}`;
    try {
        const output = execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (!output) return { name: tool, available: false };
        const first = output.split(/\r?\n/)[0];
        return { name: tool, available: true, path: first };
    } catch {
        return { name: tool, available: false };
    }
};

const loadConfig = () => {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) return null;
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const studioConfig = loadStudioConfig();
        if (studioConfig.activeGooglePlugin === 'antigravity' && !config.small_model) {
            config.small_model = "google/gemini-3-flash";
        }
        return config;
    } catch {
        return null;
    }
};

const saveConfig = (config) => {
    const configPath = getConfigPath();
    if (!configPath) throw new Error('No config path found');
    atomicWriteFileSync(configPath, JSON.stringify(config, null, 2));
};

const aggregateModels = () => {
    const roots = getSearchRoots();
    const activeConfigPath = getConfigPath();
    const activeDir = activeConfigPath ? path.dirname(activeConfigPath) : null;
    
    const providerMap = new Map();
    
    for (const root of roots) {
        const configPath = path.join(root, 'opencode.json');
        
        if (!fs.existsSync(configPath)) continue;
        
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            let providers = null;
            
            if (config.model && config.model.providers) {
                providers = config.model.providers;
            } else if (config.providers) {
                providers = config.providers;
            }
            
            if (providers && typeof providers === 'object') {
                for (const [providerName, providerConfig] of Object.entries(providers)) {
                    if (!providerMap.has(providerName)) {
                        providerMap.set(providerName, {
                            name: providerName,
                            config: providerConfig,
                            source: 'json-config',
                            configPath: root
                        });
                    }
                }
            }
        } catch (err) {
            console.warn(`Failed to read config from ${configPath}:`, err.message);
        }
    }
    
    return Array.from(providerMap.values());
};

const loadAggregatedConfig = () => {
    const roots = getSearchRoots();
    const activeConfigPath = getConfigPath();
    const activeDir = activeConfigPath ? path.dirname(activeConfigPath) : null;

    const aggregated = {
        mcp: {},
        command: {},
        env: {},
        plugins: []
    };

    const configs = [];
    for (const root of roots) {
        const configPath = path.join(root, 'opencode.json');
        if (fs.existsSync(configPath)) {
            try {
                const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                configs.push({
                    root,
                    isHighestPriority: activeDir ? path.resolve(root) === path.resolve(activeDir) : false,
                    config: content
                });
            } catch (err) {
                console.error(`Failed to read config from ${configPath}:`, err.message);
            }
        }
    }

    configs.sort((a, b) => {
        if (a.isHighestPriority) return -1;
        if (b.isHighestPriority) return 1;
        return 0;
    });

    [...configs].reverse().forEach(({ config }) => {
        if (config.mcp && typeof config.mcp === 'object') {
            for (const [key, value] of Object.entries(config.mcp)) {
                aggregated.mcp[key] = value;
            }
        }

        if (config.command && typeof config.command === 'object') {
            Object.assign(aggregated.command, config.command);
        }

        if (config.env && typeof config.env === 'object') {
            Object.assign(aggregated.env, config.env);
        }

        if (config.plugins && Array.isArray(config.plugins)) {
            for (const plugin of config.plugins) {
                const name = typeof plugin === 'string' ? plugin : plugin.name || plugin.npm;
                if (name && !aggregated.plugins.find((p) => p.name === name)) {
                    aggregated.plugins.push({
                        name,
                        source: 'json-config',
                        type: typeof plugin === 'object' && plugin.npm ? 'npm' : 'file'
                    });
                }
            }
        }
    });

    return aggregated;
};

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: SERVER_VERSION }));

app.post('/api/shutdown', (req, res) => {
    res.json({ success: true });
    setTimeout(() => process.exit(0), 100);
});

app.get('/api/paths', (req, res) => res.json(getPaths()));

app.get('/api/debug/auth', (req, res) => {
    const paths = getPaths();
    const studio = loadStudioConfig();
    const activePlugin = studio.activeGooglePlugin;
    
    // Check auth.json in all candidate locations
    const authLocations = [];
    paths.candidates.forEach(p => {
        const ap = path.join(path.dirname(p), 'auth.json');
        authLocations.push({
            path: ap,
            exists: fs.existsSync(ap),
            keys: fs.existsSync(ap) ? Object.keys(JSON.parse(fs.readFileSync(ap, 'utf8'))) : []
        });
    });
    
    // Check current auth.json
    if (paths.current) {
        const ap = path.join(path.dirname(paths.current), 'auth.json');
        if (!authLocations.some(l => l.path === ap)) {
            authLocations.push({
                path: ap,
                exists: fs.existsSync(ap),
                keys: fs.existsSync(ap) ? Object.keys(JSON.parse(fs.readFileSync(ap, 'utf8'))) : []
            });
        }
    }
    
    // Check profile directories
    const namespaces = ['google', 'google.gemini', 'google.antigravity', 'openai', 'anthropic'];
    const profileDirs = {};
    namespaces.forEach(ns => {
        const dir = path.join(AUTH_PROFILES_DIR, ns);
        profileDirs[ns] = {
            path: dir,
            exists: fs.existsSync(dir),
            profiles: fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : []
        };
    });
    
    res.json({
        configPath: paths.current,
        activeGooglePlugin: activePlugin,
        activeProfiles: studio.activeProfiles || {},
        authLocations,
        profileDirs,
        authProfilesDir: AUTH_PROFILES_DIR
    });
});

app.post('/api/paths', (req, res) => {
    const { configPath } = req.body;
    const studioConfig = loadStudioConfig();
    
    if (configPath && fs.existsSync(configPath) && fs.statSync(configPath).isDirectory()) {
        const potentialFile = path.join(configPath, 'opencode.json');
        studioConfig.configPath = potentialFile;
    } else {
        studioConfig.configPath = configPath;
    }
    
    saveStudioConfig(studioConfig);
    res.json({ success: true, current: getConfigPath() });
});

app.get('/api/config', (req, res) => {
    const config = loadConfig();
    if (!config) return res.status(404).json({ error: 'Config not found' });
    res.json(config);
});

app.post('/api/config', (req, res) => {
    try {
        if (!validatePermissionValue(req.body?.permission)) {
            return res.status(400).json({ error: 'Invalid permission value. Must be ask, allow, or deny.' });
        }
        saveConfig(req.body);
        triggerGitHubAutoSync();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/mcp', (req, res) => {
    try {
        const mcpMap = new Map();

        for (const dirInfo of getMcpDirs()) {
            const mcps = loadMcpsFromDir(dirInfo);
            for (const mcp of mcps) {
                if (!mcpMap.has(mcp.name)) {
                    mcpMap.set(mcp.name, mcp);
                }
            }
        }

        const aggregated = loadAggregatedConfig();
        if (aggregated.mcpServers) {
            for (const [name, config] of Object.entries(aggregated.mcpServers)) {
                if (!mcpMap.has(name)) {
                    mcpMap.set(name, {
                        name,
                        config,
                        source: 'json-config'
                    });
                }
            }
        }

        const mcpObj = {};
        for (const [name, mcp] of mcpMap.entries()) {
            mcpObj[name] = mcp.config || mcp;
        }
        res.json(mcpObj);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/commands', (req, res) => {
    try {
        const commandMap = new Map();

        for (const dirInfo of getCommandDirs()) {
            const commands = loadCommandsFromDir(dirInfo);
            for (const cmd of commands) {
                if (!commandMap.has(cmd.name)) {
                    commandMap.set(cmd.name, cmd);
                }
            }
        }

        const aggregated = loadAggregatedConfig();
        if (aggregated.command) {
            for (const [name, cmdConfig] of Object.entries(aggregated.command)) {
                if (!commandMap.has(name)) {
                    commandMap.set(name, {
                        name,
                        content: cmdConfig.template || cmdConfig,
                        description: cmdConfig.description || (typeof cmdConfig === 'string' ? cmdConfig.slice(0, 100).replace(/\n/g, ' ') : ''),
                        source: 'json-config'
                    });
                }
            }
        }

        const commandsObj = {};
        for (const [name, cmd] of commandMap.entries()) {
            commandsObj[name] = {
                name,
                template: cmd.content || cmd.template,
                description: cmd.description,
                source: cmd.source,
                path: cmd.path,
                root: cmd.root
            };
        }
        res.json(commandsObj);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const aggregateAgents = () => {
    const agentMap = new Map();
    const roots = getSearchRoots();
    
    for (const root of roots) {
        const configPath = path.join(root, 'opencode.json');
        if (fs.existsSync(configPath)) {
            try {
                const content = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                const configAgents = content.agent || {};
                for (const [name, agentConfig] of Object.entries(configAgents)) {
                    if (!agentMap.has(name)) {
                        agentMap.set(name, {
                            name,
                            source: 'json-config',
                            configPath: root,
                            ...agentConfig,
                            permission: agentConfig.permission || agentConfig.permissions,
                            permissions: agentConfig.permission || agentConfig.permissions
                        });
                    }
                }
            } catch (err) {
                console.error(`Failed to read agent config from ${configPath}:`, err.message);
            }
        }
    }
    
    for (const dir of getAgentDirs()) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
        files.forEach((file) => {
            const fp = path.join(dir, file);
            const content = fs.readFileSync(fp, 'utf8');
            const { data, body } = parseAgentMarkdown(content);
            const name = path.basename(file, '.md');
            
            if (!agentMap.has(name)) {
                agentMap.set(name, {
                    name,
                    source: 'markdown',
                    path: fp,
                    disabled: false,
                    description: data.description,
                    mode: data.mode,
                    model: data.model,
                    temperature: data.temperature,
                    tools: data.tools,
                    permission: data.permission,
                    permissions: data.permission,
                    maxSteps: data.maxSteps,
                    disable: data.disable,
                    hidden: data.hidden,
                    prompt: body
                });
            }
        });
    }
    
    ['build', 'plan'].forEach((name) => {
        if (!agentMap.has(name)) {
            agentMap.set(name, { name, source: 'builtin', mode: 'primary', disabled: false });
        }
    });
    
    return Array.from(agentMap.values());
};

app.get('/api/agents', (req, res) => {
    try {
        const studio = loadStudioConfig();
        const disabledAgents = studio.disabledAgents || [];
        
        const agents = aggregateAgents();
        
        const agentsWithStatus = agents.map(agent => ({
            ...agent,
            disabled: disabledAgents.includes(agent.name)
        }));
        
        res.json({ agents: agentsWithStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/agents', (req, res) => {
    try {
        const { name, config: agentConfig, source, scope } = req.body || {};
        if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Missing agent name' });
        if (!/^[a-zA-Z0-9 _-]+$/.test(name)) return res.status(400).json({ error: 'Invalid agent name' });

        const config = loadConfig() || {};
        if (!config.agent) config.agent = {};

        const normalizedConfig = { ...(agentConfig || {}) };
        if (normalizedConfig.permissions && !normalizedConfig.permission) {
            normalizedConfig.permission = normalizedConfig.permissions;
            delete normalizedConfig.permissions;
        }

        const shouldWriteMarkdown = source === 'markdown' || !!normalizedConfig?.mode;
        if (shouldWriteMarkdown) {
            const configPath = getConfigPath();
            const baseDir = configPath ? path.dirname(configPath) : HOME_DIR;
            const projectDir = path.join(baseDir, '.opencode', 'agents');
            const globalDir = path.join(HOME_DIR, '.config', 'opencode', 'agents');
            const targetDir = scope === 'project' ? projectDir : globalDir;
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            const frontmatter = {
                description: normalizedConfig?.description,
                mode: normalizedConfig?.mode,
                model: normalizedConfig?.model,
                temperature: normalizedConfig?.temperature,
                tools: normalizedConfig?.tools,
                permission: normalizedConfig?.permission,
                maxSteps: normalizedConfig?.maxSteps,
                disable: normalizedConfig?.disable,
                hidden: normalizedConfig?.hidden
            };

            const markdown = buildAgentMarkdown(frontmatter, normalizedConfig?.prompt || '');
            atomicWriteFileSync(path.join(targetDir, `${name}.md`), markdown);

            if (config.agent[name]) {
                delete config.agent[name];
                saveConfig(config);
            }
        } else {
            config.agent[name] = normalizedConfig;
            saveConfig(config);
        }

        triggerGitHubAutoSync();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/agents/:name', (req, res) => {
    try {
        const { name } = req.params;
        const { config: agentConfig } = req.body || {};

        const normalizedConfig = { ...(agentConfig || {}) };
        if (normalizedConfig.permissions && !normalizedConfig.permission) {
            normalizedConfig.permission = normalizedConfig.permissions;
            delete normalizedConfig.permissions;
        }

        const config = loadConfig() || {};
        if (!config.agent) config.agent = {};

        const markdownDirs = getAgentDirs().filter((d) => fs.existsSync(d));
        const markdownPath = markdownDirs
            .map((d) => path.join(d, `${name}.md`))
            .find((p) => fs.existsSync(p));

        if (markdownPath) {
            const frontmatter = {
                description: normalizedConfig?.description,
                mode: normalizedConfig?.mode,
                model: normalizedConfig?.model,
                temperature: normalizedConfig?.temperature,
                tools: normalizedConfig?.tools,
                permission: normalizedConfig?.permission,
                maxSteps: normalizedConfig?.maxSteps,
                disable: normalizedConfig?.disable,
                hidden: normalizedConfig?.hidden
            };
            const markdown = buildAgentMarkdown(frontmatter, normalizedConfig?.prompt || '');
            atomicWriteFileSync(markdownPath, markdown);
        } else {
            config.agent[name] = normalizedConfig;
            saveConfig(config);
        }

        triggerGitHubAutoSync();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/agents/:name', (req, res) => {
    try {
        const { name } = req.params;
        const config = loadConfig() || {};

        if (config.agent && config.agent[name]) {
            delete config.agent[name];
            saveConfig(config);
        }

        for (const dir of getAgentDirs()) {
            const fp = path.join(dir, `${name}.md`);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }

        triggerGitHubAutoSync();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/agents/:name/toggle', (req, res) => {
    try {
        const { name } = req.params;
        const studio = loadStudioConfig();
        const disabled = new Set(studio.disabledAgents || []);
        if (disabled.has(name)) disabled.delete(name); else disabled.add(name);
        studio.disabledAgents = Array.from(disabled);
        saveStudioConfig(studio);
        res.json({ success: true, disabled: studio.disabledAgents.includes(name) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (res.flushHeaders) res.flushHeaders();

    setupLogWatcher();

    const sub = { res, queue: [], draining: false, closed: false };
    logSubscribers.add(sub);

    logBuffer.forEach((entry) => {
        sub.queue.push(`data: ${JSON.stringify(entry)}\n\n`);
    });
    flushSubscriber(sub);

    const keepalive = setInterval(() => {
        if (sub.closed) return;
        res.write(': keepalive\n\n');
    }, 20000);

    req.on('close', () => {
        sub.closed = true;
        clearInterval(keepalive);
        logSubscribers.delete(sub);
        try { res.end(); } catch {}
    });
});

app.get('/api/system/tools', (req, res) => {
    const knownTools = [
        'go', 'gofmt', 'gopls',
        'rust-analyzer', 'rustfmt',
        'prettier', 'eslint',
        'typescript-language-server', 'tsserver',
        'pyright', 'ruff', 'python',
        'clangd', 'clang-format',
        'dart', 'jdtls',
        'kotlin-language-server', 'ktlint',
        'deno', 'lua-language-server',
        'ocamllsp', 'nixd',
        'swift', 'sourcekit-lsp'
    ];

    const tools = knownTools.map((tool) => detectTool(tool));
    res.json(tools);
});

app.get('/api/project/rules', (req, res) => {
    try {
        const found = findRulesFile();
        if (!found.path) return res.json({ content: '', source: 'none', path: null });
        const content = fs.readFileSync(found.path, 'utf8');
        res.json({ content, source: found.source, path: found.path });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/project/rules', (req, res) => {
    try {
        const { content, source } = req.body || {};
        const configPath = getConfigPath();
        if (!configPath) return res.status(400).json({ error: 'No config path found' });

        const targetName = source === 'CLAUDE.md' ? 'CLAUDE.md' : 'AGENTS.md';
        const found = findRulesFile();

        let targetPath = null;
        if (found.path && path.basename(found.path) === targetName) {
            targetPath = found.path;
        }

        if (!targetPath) {
            const baseDir = path.dirname(configPath);
            targetPath = path.join(baseDir, targetName);
        }

        atomicWriteFileSync(targetPath, content || '');
        res.json({ success: true, path: targetPath, source: targetName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/backup', (req, res) => {
    try {
        const studioConfig = loadStudioConfig();
        const opencodeConfig = loadConfig();
        const skills = [];
        const plugins = [];
        
        const sd = getActiveSkillDir();
        if (sd && fs.existsSync(sd)) {
            fs.readdirSync(sd, { withFileTypes: true })
                .filter(e => e.isDirectory() && fs.existsSync(path.join(sd, e.name, 'SKILL.md')))
                .forEach(e => {
                    const content = fs.readFileSync(path.join(sd, e.name, 'SKILL.md'), 'utf8');
                    skills.push({ name: e.name, content });
                });
        }
        
        const pd = getActivePluginDir();
        if (pd && fs.existsSync(pd)) {
            fs.readdirSync(pd, { withFileTypes: true }).forEach(e => {
                const fp = path.join(pd, e.name);
                if (e.isFile() && /\.(js|ts)$/.test(e.name)) {
                    plugins.push({ name: e.name.replace(/\.(js|ts)$/, ''), content: fs.readFileSync(fp, 'utf8') });
                }
            });
        }
        
        res.json({
            version: 1,
            timestamp: new Date().toISOString(),
            studioConfig,
            opencodeConfig,
            skills,
            plugins
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/restore', (req, res) => {
    try {
        const { studioConfig, opencodeConfig, skills, plugins } = req.body;
        
        if (studioConfig) saveStudioConfig(studioConfig);
        if (opencodeConfig) saveConfig(opencodeConfig);
        
        const sd = getActiveSkillDir();
        if (sd && skills && Array.isArray(skills)) {
            if (!fs.existsSync(sd)) fs.mkdirSync(sd, { recursive: true });
            skills.forEach(s => {
                const skillDir = path.join(sd, s.name);
                if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
                atomicWriteFileSync(path.join(skillDir, 'SKILL.md'), s.content);
            });
        }
        
        const pd = getActivePluginDir();
        if (pd && plugins && Array.isArray(plugins)) {
            if (!fs.existsSync(pd)) fs.mkdirSync(pd, { recursive: true });
            plugins.forEach(p => {
                atomicWriteFileSync(path.join(pd, `${p.name}.js`), p.content);
            });
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/cooldowns', (req, res) => {
    const studio = loadStudioConfig();
    res.json(studio.cooldownRules || []);
});

app.post('/api/cooldowns', (req, res) => {
    const { name, duration } = req.body;
    if (!name || typeof duration !== 'number') return res.status(400).json({ error: 'Invalid name or duration' });
    const studio = loadStudioConfig();
    if (!studio.cooldownRules) studio.cooldownRules = [];
    
    // Update if exists, else push
    const idx = studio.cooldownRules.findIndex(r => r.name === name);
    if (idx >= 0) studio.cooldownRules[idx] = { name, duration };
    else studio.cooldownRules.push({ name, duration });
    
    saveStudioConfig(studio);
    res.json(studio.cooldownRules);
});

app.delete('/api/cooldowns/:name', (req, res) => {
    const { name } = req.params;
    const studio = loadStudioConfig();
    if (studio.cooldownRules) {
        studio.cooldownRules = studio.cooldownRules.filter(r => r.name !== name);
        saveStudioConfig(studio);
    }
    res.json(studio.cooldownRules || []);
});

const DROPBOX_CLIENT_ID = 'your-dropbox-app-key';

function buildBackupData() {
    const studio = loadStudioConfig();
    const opencodeConfig = loadConfig();
    const skills = [];
    const plugins = [];
    
    const sd = getActiveSkillDir();
    if (sd && fs.existsSync(sd)) {
        fs.readdirSync(sd, { withFileTypes: true })
            .filter(e => e.isDirectory() && fs.existsSync(path.join(sd, e.name, 'SKILL.md')))
            .forEach(e => {
                skills.push({ name: e.name, content: fs.readFileSync(path.join(sd, e.name, 'SKILL.md'), 'utf8') });
            });
    }
    
    const pd = getActivePluginDir();
    if (pd && fs.existsSync(pd)) {
        fs.readdirSync(pd, { withFileTypes: true }).forEach(e => {
            if (e.isFile() && /\.(js|ts)$/.test(e.name)) {
                plugins.push({ name: e.name.replace(/\.(js|ts)$/, ''), content: fs.readFileSync(path.join(pd, e.name), 'utf8') });
            }
        });
    }
    
    const cloudSettings = studio.cloudProvider ? { provider: studio.cloudProvider } : {};
    
    return {
        version: 1,
        timestamp: new Date().toISOString(),
        studioConfig: { ...studio, cloudToken: undefined, cloudProvider: undefined },
        opencodeConfig,
        skills,
        plugins
    };
}

function restoreFromBackup(backup, studio) {
    if (backup.studioConfig) {
        const merged = { 
            ...backup.studioConfig, 
            cloudProvider: studio.cloudProvider,
            cloudToken: studio.cloudToken,
            autoSync: studio.autoSync,
            lastSyncAt: studio.lastSyncAt 
        };
        saveStudioConfig(merged);
    }
    if (backup.opencodeConfig) saveConfig(backup.opencodeConfig);
    
    const sd = getActiveSkillDir();
    if (sd && backup.skills && Array.isArray(backup.skills)) {
        if (!fs.existsSync(sd)) fs.mkdirSync(sd, { recursive: true });
        backup.skills.forEach(s => {
            const skillDir = path.join(sd, s.name);
            if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
            atomicWriteFileSync(path.join(skillDir, 'SKILL.md'), s.content);
        });
    }
    
    const pd = getActivePluginDir();
    if (pd && backup.plugins && Array.isArray(backup.plugins)) {
        if (!fs.existsSync(pd)) fs.mkdirSync(pd, { recursive: true });
        backup.plugins.forEach(p => {
            atomicWriteFileSync(path.join(pd, `${p.name}.js`), p.content);
        });
    }
}

app.get('/api/sync/status', (req, res) => {
    const studio = loadStudioConfig();
    res.json({
        provider: studio.cloudProvider || null,
        connected: !!(studio.cloudProvider && studio.cloudToken),
        lastSync: studio.lastSyncAt || null,
        autoSync: !!studio.autoSync
    });
});

app.post('/api/sync/config', (req, res) => {
    const { autoSync } = req.body;
    const studio = loadStudioConfig();
    if (autoSync !== undefined) studio.autoSync = !!autoSync;
    saveStudioConfig(studio);
    res.json({ success: true, autoSync: !!studio.autoSync });
});

app.post('/api/sync/disconnect', (req, res) => {
    const studio = loadStudioConfig();
    delete studio.cloudProvider;
    delete studio.cloudToken;
    delete studio.cloudRefreshToken;
    saveStudioConfig(studio);
    res.json({ success: true });
});

app.get('/api/sync/dropbox/auth-url', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    const studio = loadStudioConfig();
    studio.oauthState = state;
    saveStudioConfig(studio);
    
    const redirectUri = req.query.redirect_uri || 'http://localhost:3000/settings';
    studio.oauthRedirectUri = redirectUri;
    saveStudioConfig(studio);
    
    const params = new URLSearchParams({
        client_id: DROPBOX_CLIENT_ID,
        response_type: 'code',
        token_access_type: 'offline',
        redirect_uri: redirectUri,
        state: state
    });
    res.json({ url: `https://www.dropbox.com/oauth2/authorize?${params}` });
});

app.post('/api/sync/dropbox/callback', async (req, res) => {
    try {
        const { code, state } = req.body;
        const studio = loadStudioConfig();
        
        if (state !== studio.oauthState) {
            return res.status(400).json({ error: 'Invalid state' });
        }
        const redirectUri = studio.oauthRedirectUri || 'http://localhost:3000/settings';
        delete studio.oauthState;
        delete studio.oauthRedirectUri;
        
        const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                grant_type: 'authorization_code',
                client_id: DROPBOX_CLIENT_ID,
                redirect_uri: redirectUri
            })
        });
        
        if (!response.ok) {
            const err = await response.text();
            return res.status(400).json({ error: `Dropbox auth failed: ${err}` });
        }
        
        const tokens = await response.json();
        studio.cloudProvider = 'dropbox';
        studio.cloudToken = tokens.access_token;
        if (tokens.refresh_token) studio.cloudRefreshToken = tokens.refresh_token;
        saveStudioConfig(studio);
        
        res.json({ success: true, provider: 'dropbox' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sync/push', async (req, res) => {
    try {
        const studio = loadStudioConfig();
        if (!studio.cloudProvider || !studio.cloudToken) {
            return res.status(400).json({ error: 'No cloud provider connected' });
        }
        
        const backup = buildBackupData();
        const content = JSON.stringify(backup, null, 2);
        
        if (studio.cloudProvider === 'dropbox') {
            const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${studio.cloudToken}`,
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': JSON.stringify({
                        path: '/opencode-studio-sync.json',
                        mode: 'overwrite',
                        autorename: false
                    })
                },
                body: content
            });
            
            if (!response.ok) {
                const err = await response.text();
                return res.status(400).json({ error: `Dropbox upload failed: ${err}` });
            }
        }
        
        studio.lastSyncAt = backup.timestamp;
        saveStudioConfig(studio);
        res.json({ success: true, timestamp: backup.timestamp });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sync/pull', async (req, res) => {
    try {
        const studio = loadStudioConfig();
        if (!studio.cloudProvider || !studio.cloudToken) {
            return res.status(400).json({ error: 'No cloud provider connected' });
        }
        
        let content;
        
        if (studio.cloudProvider === 'dropbox') {
            const response = await fetch('https://content.dropboxapi.com/2/files/download', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${studio.cloudToken}`,
                    'Dropbox-API-Arg': JSON.stringify({ path: '/opencode-studio-sync.json' })
                }
            });
            
            if (!response.ok) {
                if (response.status === 409) {
                    return res.status(404).json({ error: 'No sync file found in cloud' });
                }
                const err = await response.text();
                return res.status(400).json({ error: `Dropbox download failed: ${err}` });
            }
            
            content = await response.text();
        }
        
        const backup = JSON.parse(content);
        restoreFromBackup(backup, studio);
        
        const updated = loadStudioConfig();
        updated.lastSyncAt = new Date().toISOString();
        saveStudioConfig(updated);
        
        res.json({ success: true, timestamp: backup.timestamp, skills: (backup.skills || []).length, plugins: (backup.plugins || []).length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/sync/auto', async (req, res) => {
    const studio = loadStudioConfig();
    if (!studio.cloudProvider || !studio.cloudToken || !studio.autoSync) {
        return res.json({ action: 'none', reason: 'auto-sync not configured' });
    }
    
    try {
        let content;
        
        if (studio.cloudProvider === 'dropbox') {
            const response = await fetch('https://content.dropboxapi.com/2/files/download', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${studio.cloudToken}`,
                    'Dropbox-API-Arg': JSON.stringify({ path: '/opencode-studio-sync.json' })
                }
            });
            
            if (!response.ok) {
                return res.json({ action: 'none', reason: 'no remote file' });
            }
            
            content = await response.text();
        }
        
        if (!content) {
            return res.json({ action: 'none', reason: 'no content' });
        }
        
        const remote = JSON.parse(content);
        const remoteTime = new Date(remote.timestamp).getTime();
        const localTime = studio.lastSyncAt ? new Date(studio.lastSyncAt).getTime() : 0;
        
        if (remoteTime > localTime) {
            restoreFromBackup(remote, studio);
            
            const updated = loadStudioConfig();
            updated.lastSyncAt = new Date().toISOString();
            saveStudioConfig(updated);
            
            return res.json({ action: 'pulled', timestamp: remote.timestamp });
        }
        
        res.json({ action: 'none', reason: 'local is current' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// OH-MY-OPENCODE PREFERENCES
// ============================================

function loadOhMyOpenCodeConfig() {
    const configPath = getOhMyOpenCodeConfigPath();
    if (!configPath || !fs.existsSync(configPath)) return {};
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        return {};
    }
}

function saveOhMyOpenCodeConfig(config) {
    const configPath = getOhMyOpenCodeConfigPath();
    if (!configPath) throw new Error('No opencode config path found');
    atomicWriteFileSync(configPath, JSON.stringify(config, null, 2));
}

app.get('/api/ohmyopencode', (req, res) => {
    const ohMyPath = getOhMyOpenCodeConfigPath();
    const exists = ohMyPath && fs.existsSync(ohMyPath);
    const config = exists ? loadOhMyOpenCodeConfig() : null;
    const studio = loadStudioConfig();
    const preferences = studio.ohmy || { agents: {} };
    res.json({ path: ohMyPath, exists, config, preferences });
});

app.post('/api/ohmyopencode', (req, res) => {
    try {
        const { preferences } = req.body;
        if (!preferences || !preferences.agents) {
            return res.status(400).json({ error: 'Missing preferences.agents' });
        }
        
        const studio = loadStudioConfig();
        studio.ohmy = preferences;
        saveStudioConfig(studio);
        
        const currentConfig = loadOhMyOpenCodeConfig() || {};
        const warnings = [];
        
        for (const [agentName, agentPrefs] of Object.entries(preferences.agents)) {
            const choices = agentPrefs.choices || [];
            const available = choices.find(c => c.available);
            if (available) {
                if (!currentConfig.agents) currentConfig.agents = {};
                const agentConfig = { model: available.model };
                
                if (available.thinking && available.thinking.type === 'enabled') {
                    agentConfig.thinking = { type: 'enabled' };
                }
                
                if (available.reasoning && available.reasoning.effort) {
                    agentConfig.reasoning = { effort: available.reasoning.effort };
                }
                
                currentConfig.agents[agentName] = agentConfig;
            } else if (choices.length > 0) {
                warnings.push(`No available model for agent "${agentName}"`);
            }
        }
        
        saveOhMyOpenCodeConfig(currentConfig);
        
        const ohMyPath = getOhMyOpenCodeConfigPath();
        triggerGitHubAutoSync();
        res.json({ 
            success: true, 
            path: ohMyPath,
            exists: true, 
            config: currentConfig, 
            preferences, 
            warnings: warnings.length > 0 ? warnings : undefined 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// GITHUB BACKUP
// ============================================

function getGitHubToken() {
    return new Promise((resolve, reject) => {
        exec('gh auth token', (err, stdout, stderr) => {
            if (err) {
                resolve(null);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function getGitHubUser(token) {
    const response = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) return null;
    return await response.json();
}

async function ensureGitHubRepo(token, repoName) {
    const [owner, repo] = repoName.split('/');
    
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.ok) {
        return await response.json();
    }
    
    if (response.status === 404) {
        const createRes = await fetch(`https://api.github.com/user/repos`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: repo,
                private: true,
                description: 'OpenCode Studio backup',
                auto_init: true
            })
        });
        
        if (createRes.ok) {
            await new Promise(r => setTimeout(r, 2000));
            return await createRes.json();
        }
        
        const err = await createRes.text();
        throw new Error(`Failed to create repo: ${err}`);
    }
    
    const err = await response.text();
    throw new Error(`Failed to check repo: ${err}`);
}

const RESERVED_WIN_NAMES = ['con', 'prn', 'aux', 'nul', 'com0', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt0', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];

function copyDirContents(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    const SKIP_DIRS = ['node_modules', '.git', '.next', 'cache'];
    const SKIP_EXT = ['.log', '.tmp', '.db', '.sqlite', '.cache', '.pack', '.idx'];
    
    for (const name of fs.readdirSync(src)) {
        if (RESERVED_WIN_NAMES.includes(name.toLowerCase())) {
            console.warn(`Skipping reserved Windows filename: ${name}`);
            continue;
        }
        
        const srcPath = path.join(src, name);
        const destPath = path.join(dest, name);
        const stat = fs.statSync(srcPath);
        
        if (stat.isDirectory()) {
            if (SKIP_DIRS.includes(name)) continue;
            copyDirContents(srcPath, destPath);
        } else {
            if (SKIP_EXT.some(ext => name.endsWith(ext))) continue;
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function execPromise(cmd, opts = {}) {
    return new Promise((resolve, reject) => {
        exec(cmd, opts, (err, stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve(stdout.trim());
        });
    });
}


let autoSyncTimer = null;

async function performGitHubBackup(options = {}) {
    const { owner, repo, branch } = options;
    let tempDir = null;
    try {
        const token = await getGitHubToken();
        if (!token) throw new Error('Not logged in to gh CLI. Run: gh auth login');
        
        const user = await getGitHubUser(token);
        if (!user) throw new Error('Failed to get GitHub user');
        
        const studio = loadStudioConfig();
        
        const finalOwner = owner || studio.githubBackup?.owner || user.login;
        const finalRepo = repo || studio.githubBackup?.repo;
        const finalBranch = branch || studio.githubBackup?.branch || 'main';
        
        if (!finalRepo) throw new Error('No repo name provided');
        
        const repoName = `${finalOwner}/${finalRepo}`;
        
        await ensureGitHubRepo(token, repoName);
        
        const opencodeConfig = getConfigPath();
        if (!opencodeConfig) throw new Error('No opencode config path found');
        
        const opencodeDir = path.dirname(opencodeConfig);
        const studioDir = path.join(HOME_DIR, '.config', 'opencode-studio');
        
        tempDir = path.join(os.tmpdir(), `opencode-backup-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        
        // Clone or init
        try {
            await execPromise(`git clone --depth 1 https://x-access-token:${token}@github.com/${repoName}.git .`, { cwd: tempDir });
        } catch (e) {
            // If clone fails (empty repo?), try init
            await execPromise('git init', { cwd: tempDir });
            await execPromise(`git remote add origin https://x-access-token:${token}@github.com/${repoName}.git`, { cwd: tempDir });
            await execPromise(`git checkout -b ${finalBranch}`, { cwd: tempDir });
        }

        // Configure git to suppress warnings
        try {
            await execPromise('git config core.autocrlf false', { cwd: tempDir });
            await execPromise('git config core.safecrlf false', { cwd: tempDir });
        } catch (e) {
            console.warn('Failed to set git config:', e.message);
        }
        
        const gitignoreContent = RESERVED_WIN_NAMES.map(n => `**/${n}`).join('\n') + '\n';
        fs.writeFileSync(path.join(tempDir, '.gitignore'), gitignoreContent);
        
        const backupOpencodeDir = path.join(tempDir, 'opencode');
        const backupStudioDir = path.join(tempDir, 'opencode-studio');
        
        if (fs.existsSync(backupOpencodeDir)) fs.rmSync(backupOpencodeDir, { recursive: true });
        if (fs.existsSync(backupStudioDir)) fs.rmSync(backupStudioDir, { recursive: true });
        
        copyDirContents(opencodeDir, backupOpencodeDir);
        copyDirContents(studioDir, backupStudioDir);
        
        await execPromise('git add opencode/ opencode-studio/ .gitignore', { cwd: tempDir });
        
        const timestamp = new Date().toISOString();
        const commitMessage = `OpenCode Studio backup ${timestamp}`;
        
        let result = { success: true, timestamp, url: `https://github.com/${repoName}` };
        
        try {
            await execPromise(`git commit -m "${commitMessage}"`, { cwd: tempDir });
            await execPromise(`git push origin ${finalBranch}`, { cwd: tempDir });
        } catch (e) {
            if (e.message.includes('nothing to commit')) {
                result.message = 'No changes to backup';
            } else {
                throw e;
            }
        }
        
        studio.githubBackup = { owner: finalOwner, repo: finalRepo, branch: finalBranch };
        studio.lastGithubBackup = timestamp;
        saveStudioConfig(studio);
        
        return result;
    } finally {
        if (tempDir && fs.existsSync(tempDir)) {
            try { fs.rmSync(tempDir, { recursive: true }); } catch (e) {}
        }
    }
}

function triggerGitHubAutoSync() {
    const studio = loadStudioConfig();
    if (!studio.githubAutoSync) return;

    if (autoSyncTimer) clearTimeout(autoSyncTimer);
    
    console.log('[AutoSync] Change detected, scheduling GitHub backup in 15s...');
    autoSyncTimer = setTimeout(async () => {
        console.log('[AutoSync] Starting GitHub backup...');
        try {
            const result = await performGitHubBackup();
            console.log(`[AutoSync] Backup completed: ${result.message || 'Pushed to GitHub'}`);
        } catch (err) {
            console.error('[AutoSync] Backup failed:', err.message);
        }
    }, 15000); // 15s debounce
}

app.get('/api/github/backup/status', async (req, res) => {
    try {
        const token = await getGitHubToken();
        const studio = loadStudioConfig();
        const backupConfig = studio.githubBackup || {};
        
        if (!token) return res.json({ connected: false, config: backupConfig, error: 'Not logged in to gh CLI. Run: gh auth login' });
        
        const user = await getGitHubUser(token);
        if (!user) return res.json({ connected: false, config: backupConfig, error: 'Failed to get GitHub user' });
        
        if (!backupConfig.repo) {
            return res.json({ connected: true, user: user.login, config: backupConfig, autoSync: studio.githubAutoSync || false });
        }
        
        const owner = backupConfig.owner || user.login;
        const response = await fetch(`https://api.github.com/repos/${owner}/${backupConfig.repo}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            return res.json({ connected: true, user: user.login, config: backupConfig, repoExists: false, autoSync: studio.githubAutoSync || false });
        }
        
        const data = await response.json();
        res.json({ connected: true, user: user.login, config: backupConfig, repoExists: true, lastUpdated: data.pushed_at, autoSync: studio.githubAutoSync || false });
    } catch (err) {
        res.json({ connected: false, error: err.message });
    }
});

app.post('/api/github/backup', async (req, res) => {
    try {
        const result = await performGitHubBackup(req.body);
        res.json(result);
    } catch (err) {
        console.error('GitHub backup error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/github/restore', async (req, res) => {
    let tempDir = null;
    try {
        const token = await getGitHubToken();
        if (!token) return res.status(400).json({ error: 'Not logged in to gh CLI. Run: gh auth login' });
        
        const user = await getGitHubUser(token);
        if (!user) return res.status(400).json({ error: 'Failed to get GitHub user' });
        
        const { owner, repo, branch } = req.body;
        const studio = loadStudioConfig();
        
        const finalOwner = owner || studio.githubBackup?.owner || user.login;
        const finalRepo = repo || studio.githubBackup?.repo;
        const finalBranch = branch || studio.githubBackup?.branch || 'main';
        
        if (!finalRepo) return res.status(400).json({ error: 'No repo configured' });
        
        const repoName = `${finalOwner}/${finalRepo}`;
        
        const opencodeConfig = getConfigPath();
        if (!opencodeConfig) return res.status(400).json({ error: 'No opencode config path found' });
        
        const opencodeDir = path.dirname(opencodeConfig);
        const studioDir = path.join(HOME_DIR, '.config', 'opencode-studio');
        
        tempDir = path.join(os.tmpdir(), `opencode-restore-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });
        
        await execPromise(`git clone --depth 1 -b ${finalBranch} https://x-access-token:${token}@github.com/${repoName}.git .`, { cwd: tempDir });
        
        const backupOpencodeDir = path.join(tempDir, 'opencode');
        const backupStudioDir = path.join(tempDir, 'opencode-studio');
        
        if (!fs.existsSync(backupOpencodeDir)) {
            fs.rmSync(tempDir, { recursive: true });
            return res.status(400).json({ error: 'No opencode backup found in repository' });
        }
        
        copyDirContents(backupOpencodeDir, opencodeDir);
        if (fs.existsSync(backupStudioDir)) {
            copyDirContents(backupStudioDir, studioDir);
        }
        
        fs.rmSync(tempDir, { recursive: true });
        
        res.json({ success: true, message: 'Config restored from GitHub' });
    } catch (err) {
        if (tempDir && fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true });
        console.error('GitHub restore error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/github/autosync', async (req, res) => {
    const studio = loadStudioConfig();
    const enabled = req.body.enabled;
    studio.githubAutoSync = enabled;
    saveStudioConfig(studio);
    if (enabled) triggerGitHubAutoSync();
    res.json({ success: true, enabled });
});

const getActiveSkillDir = () => {
    const cp = getConfigPath();
    return cp ? path.join(path.dirname(cp), 'skill') : null;
};

app.get('/api/skills', (req, res) => {
    const studio = loadStudioConfig();
    const disabledSkills = studio.disabledSkills || [];
    const skillMap = new Map();

    for (const dirInfo of getSkillDirs()) {
        if (!fs.existsSync(dirInfo.path)) continue;
        try {
            if (dirInfo.isFlat) {
                const name = dirInfo.package || path.basename(dirInfo.path);
                const skillPath = path.join(dirInfo.path, 'SKILL.md');
                if (!skillMap.has(name)) {
                    skillMap.set(name, {
                        name,
                        path: skillPath,
                        source: dirInfo.source,
                        package: dirInfo.package,
                        enabled: !disabledSkills.includes(name)
                    });
                }
            } else {
                fs.readdirSync(dirInfo.path, { withFileTypes: true }).forEach(e => {
                    if (e.isDirectory() && fs.existsSync(path.join(dirInfo.path, e.name, 'SKILL.md'))) {
                        if (!skillMap.has(e.name)) {
                            skillMap.set(e.name, {
                                name: e.name,
                                path: path.join(dirInfo.path, e.name, 'SKILL.md'),
                                source: dirInfo.source,
                                package: dirInfo.package,
                                enabled: !disabledSkills.includes(e.name)
                            });
                        }
                    }
                });
            }
        } catch (e) {
            console.warn(`Failed to read skills from ${dirInfo.path}: ${e.message}`);
        }
    }

    res.json(Array.from(skillMap.values()));
});

app.get('/api/skills/:name', (req, res) => {
    const { name } = req.params;
    if (!/^[a-zA-Z0-9_-s]+$/.test(name)) {
        return res.status(400).json({ error: 'Invalid skill name' });
    }

    for (const dirInfo of getSkillDirs()) {
        const nestedPath = path.join(dirInfo.path, name, 'SKILL.md');
        if (fs.existsSync(nestedPath)) {
            return res.json({ name, content: fs.readFileSync(nestedPath, 'utf8'), source: dirInfo.source });
        }
        if (dirInfo.isFlat && (dirInfo.package === name || path.basename(dirInfo.path) === name)) {
            const flatPath = path.join(dirInfo.path, 'SKILL.md');
            if (fs.existsSync(flatPath)) {
                return res.json({ name, content: fs.readFileSync(flatPath, 'utf8'), source: dirInfo.source });
            }
        }
    }
    res.status(404).json({ error: 'Not found' });
});

app.post('/api/skills/:name', (req, res) => {
    const { name } = req.params;
    if (!/^[a-zA-Z0-9_-s]+$/.test(name)) {
        return res.status(400).json({ error: 'Invalid skill name' });
    }

    let targetDir = null;

    // Check if editing existing
    for (const dirInfo of getSkillDirs()) {
        if (fs.existsSync(path.join(dirInfo.path, name, 'SKILL.md'))) {
            targetDir = path.join(dirInfo.path, name);
            break;
        }
    }

    // If not found, create in active dir
    if (!targetDir) {
        const activeDir = getActiveSkillDir();
        if (!activeDir) {
             // Fallback to first available global dir if no active config
             const roots = getSearchRoots();
             const globalRoot = roots.find(r => r.includes('.config') || r.includes('opencode'));
             if (globalRoot) targetDir = path.join(globalRoot, 'skill', name);
             else return res.status(404).json({ error: 'No active config or global location to create skill' });
        } else {
            targetDir = path.join(activeDir, name);
        }
    }

    try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, 'SKILL.md'), req.body.content, 'utf8');
        triggerGitHubAutoSync();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/skills/:name', (req, res) => {
    const { name } = req.params;
    if (!/^[a-zA-Z0-9_-s]+$/.test(name)) {
        return res.status(400).json({ error: 'Invalid skill name' });
    }

    let deleted = false;
    for (const dirInfo of getSkillDirs()) {
        const skillDir = path.join(dirInfo.path, name);
        if (fs.existsSync(path.join(skillDir, 'SKILL.md'))) {
            try {
                fs.rmSync(skillDir, { recursive: true, force: true });
                deleted = true;
                break;
            } catch (e) {
                return res.status(500).json({ error: e.message });
            }
        }
    }

    if (deleted) {
        triggerGitHubAutoSync();
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Skill not found' });
    }
});

app.post('/api/skills/:name/toggle', (req, res) => {
    const { name } = req.params;
    const studio = loadStudioConfig();
    studio.disabledSkills = studio.disabledSkills || [];
    
    if (studio.disabledSkills.includes(name)) {
        studio.disabledSkills = studio.disabledSkills.filter(s => s !== name);
    } else {
        studio.disabledSkills.push(name);
    }
    
    saveStudioConfig(studio);
    triggerGitHubAutoSync();
    res.json({ success: true, enabled: !studio.disabledSkills.includes(name) });
});

const getActivePluginDir = () => {
    const cp = getConfigPath();
    return cp ? path.join(path.dirname(cp), 'plugin') : null;
};

const aggregatePlugins = () => {
    const pluginMap = new Map();
    const priority = { 'plugins-dir': 3, 'plugin-dir': 2, 'json-config': 1 };

    for (const dirInfo of getPluginDirs()) {
        const plugins = loadPluginsFromDir(dirInfo);
        for (const plugin of plugins) {
            if (!pluginMap.has(plugin.name)) {
                pluginMap.set(plugin.name, plugin);
            } else {
                const existing = pluginMap.get(plugin.name);
                if (priority[plugin.source] > priority[existing.source]) {
                    pluginMap.set(plugin.name, plugin);
                }
            }
        }
    }

    const aggregated = loadAggregatedConfig();
    if (aggregated.plugins) {
        for (const plugin of aggregated.plugins) {
            if (!pluginMap.has(plugin.name)) {
                pluginMap.set(plugin.name, {
                    ...plugin,
                    source: 'json-config'
                });
            }
        }
    }

    return Array.from(pluginMap.values());
};

app.get('/api/plugins', (req, res) => {
    try {
        const plugins = aggregatePlugins();
        const studio = loadStudioConfig();
        const disabledPlugins = studio.disabledPlugins || [];

        const pluginsWithStatus = plugins.map(p => ({
            ...p,
            enabled: !disabledPlugins.includes(p.name),
            type: p.source === 'json-config' && p.type === 'npm' ? 'npm' : 'file'
        }));

        res.json(pluginsWithStatus);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/plugins/:name', (req, res) => {
    const { name } = req.params;

    for (const dirInfo of getPluginDirs()) {
        const possiblePaths = [
            path.join(dirInfo.path, name + '.js'),
            path.join(dirInfo.path, name + '.ts'),
            path.join(dirInfo.path, name, 'index.js'),
            path.join(dirInfo.path, name, 'index.ts')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                const content = fs.readFileSync(p, 'utf8');
                return res.json({ name, content });
            }
        }
    }
    res.status(404).json({ error: 'Plugin not found' });
});

app.post('/api/plugins/:name', (req, res) => {
    const { name } = req.params;
    const { content } = req.body;

    for (const dirInfo of getPluginDirs()) {
        const possiblePaths = [
            path.join(dirInfo.path, name + '.js'),
            path.join(dirInfo.path, name + '.ts'),
            path.join(dirInfo.path, name, 'index.js'),
            path.join(dirInfo.path, name, 'index.ts')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                atomicWriteFileSync(p, content);
                triggerGitHubAutoSync();
                return res.json({ success: true });
            }
        }
    }

    let pd = getActivePluginDir();
    if (!pd) {
        const roots = getSearchRoots();
        const globalRoot = roots.find(r => r.includes('.config') || r.includes('opencode'));
        if (globalRoot) pd = path.join(globalRoot, 'plugin');
    }

    if (!pd) return res.status(404).json({ error: 'No active config to create plugin' });
    
    if (!fs.existsSync(pd)) fs.mkdirSync(pd, { recursive: true });
    const filePath = path.join(pd, name.endsWith('.js') || name.endsWith('.ts') ? name : name + '.js');
    atomicWriteFileSync(filePath, content);
    triggerGitHubAutoSync();
    res.json({ success: true });
});

app.delete('/api/plugins/:name', (req, res) => {
    const { name } = req.params;

    let deleted = false;
    for (const dirInfo of getPluginDirs()) {
        const possiblePaths = [
            path.join(dirInfo.path, name),
            path.join(dirInfo.path, name + '.js'),
            path.join(dirInfo.path, name + '.ts')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                if (fs.statSync(p).isDirectory()) {
                    fs.rmSync(p, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(p);
                }
                deleted = true;
                break;
            }
        }
        if (deleted) break;
    }

    if (deleted) {
        triggerGitHubAutoSync();
        res.json({ success: true });
    } else res.status(404).json({ error: 'Plugin not found' });
});

app.post('/api/plugins/:name/toggle', (req, res) => {
    const { name } = req.params;
    const studio = loadStudioConfig();
    studio.disabledPlugins = studio.disabledPlugins || [];
    
    if (studio.disabledPlugins.includes(name)) {
        studio.disabledPlugins = studio.disabledPlugins.filter(p => p !== name);
    } else {
        studio.disabledPlugins.push(name);
    }
    
    saveStudioConfig(studio);
    triggerGitHubAutoSync();
    res.json({ success: true, enabled: !studio.disabledPlugins.includes(name) });
});

app.get('/api/models', (req, res) => {
    try {
        const providers = aggregateModels();
        
        const allModels = [];
        for (const provider of providers) {
            if (provider.config.models && Array.isArray(provider.config.models)) {
                for (const model of provider.config.models) {
                    allModels.push({
                        id: typeof model === 'string' ? model : model.id,
                        provider: provider.name,
                        providerConfig: provider.config,
                        ...((typeof model === 'object' ? model : {}))
                    });
                }
            } else {
                allModels.push({
                    id: `${provider.name}/default`,
                    provider: provider.name,
                    providerConfig: provider.config
                });
            }
        }
        
        res.json({ 
            providers,
            models: allModels 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const getActiveGooglePlugin = () => {
    const studio = loadStudioConfig();
    return studio.activeGooglePlugin || null;
};

function loadAuthConfig() {
    const paths = getPaths();
    const allAuthConfigs = [];
    
    // Check all candidate directories for auth.json
    paths.candidates.forEach(p => {
        const ap = path.join(path.dirname(p), 'auth.json');
        if (fs.existsSync(ap)) {
            try {
                allAuthConfigs.push(JSON.parse(fs.readFileSync(ap, 'utf8')));
            } catch {}
        }
    });

    // Also check current active directory if not in candidates
    if (paths.current) {
        const ap = path.join(path.dirname(paths.current), 'auth.json');
        if (fs.existsSync(ap)) {
            try {
                allAuthConfigs.push(JSON.parse(fs.readFileSync(ap, 'utf8')));
            } catch {}
        }
    }

    if (allAuthConfigs.length === 0) return null;

    // Merge all configs, later ones (priority) overwrite earlier ones
    const cfg = Object.assign({}, ...allAuthConfigs);
    
    try { 
        const activePlugin = getActiveGooglePlugin();
        
        // Find if any google auth exists in any merged config
        const anyGoogleAuth = cfg.google || cfg['google.gemini'] || cfg['google.antigravity'];
        
        if (anyGoogleAuth) {
            // Ensure all 3 keys have at least some valid google auth data
            const baseAuth = cfg.google || cfg['google.antigravity'] || cfg['google.gemini'];
            if (!cfg.google) cfg.google = { ...baseAuth };
            if (!cfg['google.antigravity']) cfg['google.antigravity'] = { ...baseAuth };
            if (!cfg['google.gemini']) cfg['google.gemini'] = { ...baseAuth };
        }

        // Always ensure the main 'google' key reflects the active plugin if it exists
        if (activePlugin === 'antigravity' && cfg['google.antigravity']) {
            cfg.google = { ...cfg['google.antigravity'] };
        } else if (activePlugin === 'gemini' && cfg['google.gemini']) {
            cfg.google = { ...cfg['google.gemini'] };
        }
        
        return cfg;
    } catch { return cfg; }
}

const AUTH_PROFILES_DIR = path.join(HOME_DIR, '.config', 'opencode-studio', 'auth-profiles');

const getProfileDir = (provider, activePlugin) => {
    let ns = provider;
    if (provider === 'google') {
        ns = 'google.antigravity';
        const nsDir = path.join(AUTH_PROFILES_DIR, ns);
        const plainDir = path.join(AUTH_PROFILES_DIR, 'google');
        const nsHas = fs.existsSync(nsDir) && fs.readdirSync(nsDir).filter(f => f.endsWith('.json')).length > 0;
        const plainHas = fs.existsSync(plainDir) && fs.readdirSync(plainDir).filter(f => f.endsWith('.json')).length > 0;
        
        // Debug
        console.log(`[Auth] getProfileDir: ns=${ns}, nsHas=${nsHas}, plainHas=${plainHas}`);
        
        if (!nsHas && plainHas) return plainDir;
    }
    return path.join(AUTH_PROFILES_DIR, ns);
};

const listAuthProfiles = (p, activePlugin) => {
    const d = getProfileDir(p, activePlugin);
    if (!fs.existsSync(d)) return [];
    try { 
        const files = fs.readdirSync(d).filter(f => f.endsWith('.json'));
        console.log(`[Auth] listAuthProfiles(${p}): dir=${d}, count=${files.length}`);
        return files.map(f => f.replace('.json', '')); 
    } catch { return []; }
};

app.get('/api/auth/providers', (req, res) => {
    const providers = [
        { id: 'google', name: 'Google', type: 'oauth', description: 'Google Gemini API' },
        { id: 'anthropic', name: 'Anthropic', type: 'api', description: 'Claude models' },
        { id: 'openai', name: 'OpenAI', type: 'api', description: 'GPT models' },
        { id: 'xai', name: 'xAI', type: 'api', description: 'Grok models' },
        { id: 'openrouter', name: 'OpenRouter', type: 'api', description: 'Unified LLM API' },
        { id: 'github-copilot', name: 'GitHub Copilot', type: 'api', description: 'Copilot models' },
        { id: 'mistral', name: 'Mistral AI', type: 'api', description: 'Mistral models' },
        { id: 'deepseek', name: 'DeepSeek', type: 'api', description: 'DeepSeek models' },
        { id: 'groq', name: 'Groq', type: 'api', description: 'LPU Inference' },
        { id: 'amazon-bedrock', name: 'AWS Bedrock', type: 'api', description: 'Amazon Bedrock' },
        { id: 'azure', name: 'Azure OpenAI', type: 'api', description: 'Azure OpenAI' }
    ];
    res.json(providers);
});

app.get('/api/auth', (req, res) => {
    const providers = [
        { id: 'google', name: 'Google', type: 'oauth' },
        { id: 'anthropic', name: 'Anthropic', type: 'api' },
        { id: 'openai', name: 'OpenAI', type: 'api' },
        { id: 'xai', name: 'xAI', type: 'api' },
        { id: 'openrouter', name: 'OpenRouter', type: 'api' },
        { id: 'github-copilot', name: 'GitHub Copilot', type: 'api' },
        { id: 'mistral', name: 'Mistral AI', type: 'api' },
        { id: 'deepseek', name: 'DeepSeek', type: 'api' },
        { id: 'groq', name: 'Groq', type: 'api' },
        { id: 'amazon-bedrock', name: 'AWS Bedrock', type: 'api' },
        { id: 'azure', name: 'Azure OpenAI', type: 'api' }
    ];

    providers.forEach(p => importCurrentAuthToPool(p.id));
    syncAntigravityPool();

    const authCfg = loadAuthConfig() || {};
    const studio = loadStudioConfig();
    const ac = studio.activeProfiles || {};
    const credentials = [];
    const activePlugin = studio.activeGooglePlugin;

    const opencodeCfg = loadConfig();
    const currentPlugins = opencodeCfg?.plugin || [];
    
    let studioChanged = false;
    if (!studio.availableGooglePlugins) studio.availableGooglePlugins = [];
    
    if (currentPlugins.some(p => p.includes('gemini-auth')) && !studio.availableGooglePlugins.includes('gemini')) {
        studio.availableGooglePlugins.push('gemini');
        studioChanged = true;
    }
    if (currentPlugins.some(p => p.includes('antigravity-auth')) && !studio.availableGooglePlugins.includes('antigravity')) {
        studio.availableGooglePlugins.push('antigravity');
        studioChanged = true;
    }

    const geminiProfiles = path.join(AUTH_PROFILES_DIR, 'google.gemini');
    const antiProfiles = path.join(AUTH_PROFILES_DIR, 'google.antigravity');
    
    if (fs.existsSync(geminiProfiles) && !studio.availableGooglePlugins.includes('gemini')) {
        studio.availableGooglePlugins.push('gemini');
        studioChanged = true;
    }
    if (fs.existsSync(antiProfiles) && !studio.availableGooglePlugins.includes('antigravity')) {
        studio.availableGooglePlugins.push('antigravity');
        studioChanged = true;
    }
    
    if (studioChanged) saveStudioConfig(studio);

    providers.forEach(p => {
        const saved = listAuthProfiles(p.id, activePlugin);
        let curr = !!authCfg[p.id];
        if (p.id === 'google') {
            const key = 'google.antigravity';
            curr = !!authCfg[key] || !!authCfg.google;
        }
        credentials.push({ ...p, active: ac[p.id] || (curr ? 'current' : null), profiles: saved, hasCurrentAuth: curr });
    });
    res.json({ 
        ...authCfg, 
        credentials, 
        installedGooglePlugins: studio.availableGooglePlugins || [], 
        activeGooglePlugin: activePlugin 
    });
});

app.get('/api/auth/profiles', (req, res) => {
    const providers = ['google', 'anthropic', 'openai', 'xai', 'openrouter', 'together', 'mistral', 'deepseek', 'amazon-bedrock', 'azure', 'github-copilot'];
    providers.forEach(p => importCurrentAuthToPool(p));
    syncAntigravityPool();
    
    const authCfg = loadAuthConfig() || {};
    const studio = loadStudioConfig();
    const ac = studio.activeProfiles || {};
    const activePlugin = studio.activeGooglePlugin;
    const profiles = {};
    
    providers.forEach(p => {
        const saved = listAuthProfiles(p, activePlugin);
        // Correct current auth check: handle google vs google.gemini/antigravity
        let curr = !!authCfg[p];
        if (p === 'google') {
            const key = 'google.antigravity';
            curr = !!authCfg[key] || !!authCfg.google;
        }
        
        if (saved.length > 0 || curr) {
            profiles[p] = { active: ac[p], profiles: saved, hasCurrentAuth: !!curr };
        }
    });
    res.json(profiles);
});

app.post('/api/auth/profiles/:provider', (req, res) => {
    const { provider } = req.params;
    const { name } = req.body;
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google' 
        ? ('google.antigravity')
        : provider;
    
    const auth = loadAuthConfig() || {};
    const dir = path.join(AUTH_PROFILES_DIR, namespace);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    if (!auth[provider]) {
        return res.status(400).json({ error: 'No current auth for provider' });
    }

    const profileName = name || auth[provider].email || `profile-${Date.now()}`;
    const profilePath = path.join(dir, `${profileName}.json`);
    atomicWriteFileSync(profilePath, JSON.stringify(auth[provider], null, 2));

    const metadata = loadPoolMetadata();
    if (!metadata[namespace]) metadata[namespace] = {};
    metadata[namespace][profileName] = {
        ...(metadata[namespace][profileName] || {}),
        email: auth[provider].email || metadata[namespace][profileName]?.email || null,
        createdAt: metadata[namespace][profileName]?.createdAt || Date.now(),
        lastUsed: Date.now(),
        usageCount: metadata[namespace][profileName]?.usageCount || 0
    };
    savePoolMetadata(metadata);

    res.json({ success: true, name: path.basename(profilePath, '.json') });
});

app.post('/api/auth/profiles/:provider/:name/activate', (req, res) => {
    const { provider, name } = req.params;
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google' 
        ? ('google.antigravity')
        : provider;
    
    const dir = getProfileDir(provider, activePlugin);
    const profilePath = path.join(dir, `${name}.json`);
    if (!fs.existsSync(profilePath)) return res.status(404).json({ error: 'Profile not found' });
    
    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
    const studio = loadStudioConfig();
    if (!studio.activeProfiles) studio.activeProfiles = {};
    studio.activeProfiles[provider] = name;
    saveStudioConfig(studio);
    
    const authCfg = loadAuthConfig() || {};
    authCfg[provider] = profileData;
    
    // Save both to persistent namespaced key and the shared 'google' key
    if (provider === 'google') {
        const key = 'google.antigravity';
        authCfg[key] = profileData;
    }
    
    const cp = getConfigPath();
    const ap = path.join(path.dirname(cp), 'auth.json');
    atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));

    const metadata = loadPoolMetadata();
    if (!metadata[namespace]) metadata[namespace] = {};
    metadata[namespace][name] = {
        ...(metadata[namespace][name] || {}),
        email: profileData.email || metadata[namespace][name]?.email || null,
        createdAt: metadata[namespace][name]?.createdAt || Date.now(),
        lastUsed: Date.now(),
        usageCount: (metadata[namespace][name]?.usageCount || 0) + 1
    };
    if (!metadata._quota) metadata._quota = {};
    if (!metadata._quota[namespace]) metadata._quota[namespace] = {};
    const today = new Date().toISOString().split('T')[0];
    metadata._quota[namespace][today] = (metadata._quota[namespace][today] || 0) + 1;
    savePoolMetadata(metadata);

    res.json({ success: true });
});

// IMPORTANT: This route must be BEFORE /:provider/:name to avoid 'all' being captured as :name
app.delete('/api/auth/profiles/:provider/all', (req, res) => {
    const { provider } = req.params;
    console.log(`[Auth] Deleting ALL profiles for: ${provider}`);
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google' 
        ? ('google.antigravity')
        : provider;
    
    const dir = getProfileDir(provider, activePlugin);
    
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        files.forEach(f => fs.unlinkSync(path.join(dir, f)));
        console.log(`[Auth] Deleted ${files.length} profiles from ${dir}`);
    }

    const studio = loadStudioConfig();
    if (studio.activeProfiles && studio.activeProfiles[provider]) {
        delete studio.activeProfiles[provider];
        saveStudioConfig(studio);
    }
    
    const authCfg = loadAuthConfig() || {};
    if (authCfg[provider]) {
        const paths = getPaths();
        const allPaths = paths.candidates;
        if (paths.current && !allPaths.includes(paths.current)) {
            allPaths.push(paths.current);
        }

        allPaths.forEach(p => {
            const ap = path.join(path.dirname(p), 'auth.json');
            if (fs.existsSync(ap)) {
                try {
                    const cfg = JSON.parse(fs.readFileSync(ap, 'utf8'));
                    let modified = false;
                    
                    if (provider === 'google') {
                        if (cfg.google) { delete cfg.google; modified = true; }
                        if (cfg['google.antigravity']) { delete cfg['google.antigravity']; modified = true; }
                        if (cfg['google.gemini']) { delete cfg['google.gemini']; modified = true; }
                    } else if (cfg[provider]) {
                        delete cfg[provider];
                        modified = true;
                    }
                    
                    if (modified) {
                        console.log(`[Auth] Removing ${provider} (all) from ${ap}`);
                        atomicWriteFileSync(ap, JSON.stringify(cfg, null, 2));
                    }
                } catch (e) {
                    console.error(`[Auth] Failed to update ${ap}:`, e.message);
                }
            }
        });
    }
    
    const metadata = loadPoolMetadata();
    if (metadata[namespace]) {
        delete metadata[namespace];
        savePoolMetadata(metadata);
    }

    res.json({ success: true });
});

app.delete('/api/auth/profiles/:provider/:name', (req, res) => {
    const { provider, name } = req.params;
    console.log(`[Auth] Deleting profile: ${provider}/${name}`);
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google' 
        ? ('google.antigravity')
        : provider;
    
    const dir = getProfileDir(provider, activePlugin);
    const profilePath = path.join(dir, `${name}.json`);
    console.log(`[Auth] Target path: ${profilePath}, Exists: ${fs.existsSync(profilePath)}`);

    if (fs.existsSync(profilePath)) {
        fs.unlinkSync(profilePath);
        console.log(`[Auth] Deleted file`);
    } else {
        console.log(`[Auth] File not found`);
    }

    const studio = loadStudioConfig();
    const wasActive = studio.activeProfiles && studio.activeProfiles[provider] === name;

    if (wasActive) {
        delete studio.activeProfiles[provider];
        saveStudioConfig(studio);
    }

    const authCfg = loadAuthConfig() || {};
    let changed = false;

    if (provider === 'google') {
        if (authCfg.google?.email === name || authCfg['google.antigravity']?.email === name || authCfg['google.gemini']?.email === name) {
            delete authCfg.google;
            delete authCfg['google.antigravity'];
            delete authCfg['google.gemini'];
            changed = true;
        }
    } else if (authCfg[provider]) {
        // Check if the auth config matches the profile being deleted
        const creds = authCfg[provider];
        let matches = false;
        
        // Try to match by email if available (OpenAI/Anthropic don't store email in auth.json usually, but we can check decoded token)
        if (creds.email === name) matches = true;
        else if (creds.accountId === name) matches = true;
        else if (provider === 'openai' && creds.access) {
             const decoded = decodeJWT(creds.access);
             if (decoded && decoded['https://api.openai.com/profile']?.email === name) matches = true;
        }
        
        if (matches) {
            delete authCfg[provider];
            changed = true;
        }
    }

    if (changed) {
        const paths = getPaths();
        const allPaths = paths.candidates;
        if (paths.current && !allPaths.includes(paths.current)) {
            allPaths.push(paths.current);
        }

        allPaths.forEach(p => {
            const ap = path.join(path.dirname(p), 'auth.json');
            if (fs.existsSync(ap)) {
                try {
                    const cfg = JSON.parse(fs.readFileSync(ap, 'utf8'));
                    let modified = false;
                    
                    if (provider === 'google') {
                        if (cfg.google?.email === name || cfg['google.antigravity']?.email === name || cfg['google.gemini']?.email === name) {
                            delete cfg.google;
                            delete cfg['google.antigravity'];
                            delete cfg['google.gemini'];
                            modified = true;
                        }
                    } else if (cfg[provider]) {
                        const creds = cfg[provider];
                        let matches = false;
                        if (creds.email === name) matches = true;
                        else if (creds.accountId === name) matches = true;
                        else if (provider === 'openai' && creds.access) {
                             const decoded = decodeJWT(creds.access);
                             if (decoded && decoded['https://api.openai.com/profile']?.email === name) matches = true;
                        }
                        
                        if (matches) {
                            delete cfg[provider];
                            modified = true;
                        }
                    }
                    
                    if (modified) {
                        console.log(`[Auth] Removing credentials from ${ap}`);
                        atomicWriteFileSync(ap, JSON.stringify(cfg, null, 2));
                    }
                } catch (e) {
                    console.error(`[Auth] Failed to update ${ap}:`, e.message);
                }
            }
        });
    }

    const metadata = loadPoolMetadata();
    if (metadata[namespace]?.[name]) {
        delete metadata[namespace][name];
        savePoolMetadata(metadata);
    }

    res.json({ success: true });
});

app.put('/api/auth/profiles/:provider/:name', (req, res) => {
    const { provider, name } = req.params;
    const { newName } = req.body;
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google' 
        ? ('google.antigravity')
        : provider;
    
    const dir = getProfileDir(provider, activePlugin);
    const oldPath = path.join(dir, `${name}.json`);
    const newPath = path.join(dir, `${newName}.json`);
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);

    const metadata = loadPoolMetadata();
    if (metadata[namespace]?.[name]) {
        metadata[namespace][newName] = metadata[namespace][name];
        delete metadata[namespace][name];
        savePoolMetadata(metadata);
    }

    // Update active profile name if it was the one renamed
    const studio = loadStudioConfig();
    if (studio.activeProfiles && studio.activeProfiles[provider] === name) {
        studio.activeProfiles[provider] = newName;
        saveStudioConfig(studio);
    }

    res.json({ success: true, name: newName });
});

app.post('/api/auth/login', (req, res) => {
    // Always run generic `opencode auth login` - let CLI handle provider selection
    // This avoids bugs in CLI where specific providers (e.g. openai) fail with "fetch() URL is invalid"
    const cmd = 'opencode auth login';
    
    const cp = getConfigPath();
    const configDir = cp ? path.dirname(cp) : process.cwd();
    const safeDir = configDir.replace(/"/g, '\\"');
    const platform = process.platform;
    
    if (platform === 'win32') {
        const terminalCmd = `start "" /d "${safeDir}" cmd /c "call ${cmd} || pause"`;
        console.log('Executing terminal command:', terminalCmd);
        exec(terminalCmd, (err) => {
            if (err) {
                console.error('Failed to open terminal:', err);
                return res.status(500).json({ error: 'Failed to open terminal', details: err.message });
            }
            res.json({ success: true, message: 'Terminal opened', note: 'Complete login in the terminal window' });
        });
    } else if (platform === 'darwin') {
        const terminalCmd = `osascript -e 'tell application "Terminal" to do script "cd ${safeDir} && ${cmd}"'`;
        console.log('Executing terminal command:', terminalCmd);
        exec(terminalCmd, (err) => {
            if (err) {
                console.error('Failed to open terminal:', err);
                return res.status(500).json({ error: 'Failed to open terminal', details: err.message });
            }
            res.json({ success: true, message: 'Terminal opened', note: 'Complete login in the terminal window' });
        });
    } else {
        const linuxTerminals = [
            { name: 'x-terminal-emulator', cmd: `x-terminal-emulator -e "bash -c 'cd ${safeDir} && ${cmd}'"` },
            { name: 'gnome-terminal', cmd: `gnome-terminal -- bash -c "cd ${safeDir} && ${cmd}; read -p 'Press Enter to close...'"` },
            { name: 'konsole', cmd: `konsole -e bash -c "cd ${safeDir} && ${cmd}; read -p 'Press Enter to close...'"` },
            { name: 'xfce4-terminal', cmd: `xfce4-terminal -e "bash -c \"cd ${safeDir} && ${cmd}; read -p 'Press Enter to close...'\"" ` },
            { name: 'xterm', cmd: `xterm -e "bash -c 'cd ${safeDir} && ${cmd}; read -p Press_Enter_to_close...'"` }
        ];
        
        const tryTerminal = (index) => {
            if (index >= linuxTerminals.length) {
                const fallbackCmd = cmd;
                return res.json({ 
                    success: false, 
                    message: 'No terminal emulator found', 
                    note: 'Run this command manually in your terminal',
                    command: fallbackCmd
                });
            }
            
            const terminal = linuxTerminals[index];
            console.log(`Trying terminal: ${terminal.name}`);
            exec(terminal.cmd, (err) => {
                if (err) {
                    console.log(`${terminal.name} failed, trying next...`);
                    tryTerminal(index + 1);
                } else {
                    res.json({ success: true, message: 'Terminal opened', note: 'Complete login in the terminal window' });
                }
            });
        };
        
        tryTerminal(0);
    }
});


app.delete('/api/auth/:provider', (req, res) => {
    const { provider } = req.params;
    const authCfg = loadAuthConfig() || {};
    const studio = loadStudioConfig();
    const activePlugin = studio.activeGooglePlugin;

    if (provider === 'google') {
        delete authCfg.google;
        delete authCfg['google.gemini'];
        delete authCfg['google.antigravity'];

        if (studio.activeProfiles) delete studio.activeProfiles.google;
        saveStudioConfig(studio);

        const geminiDir = path.join(AUTH_PROFILES_DIR, 'google.gemini');
        const antiDir = path.join(AUTH_PROFILES_DIR, 'google.antigravity');
        [geminiDir, antiDir].forEach(dir => {
            if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        });

        const metadata = loadPoolMetadata();
        delete metadata['google.gemini'];
        delete metadata['google.antigravity'];
        savePoolMetadata(metadata);

        if (activePlugin === 'antigravity' && fs.existsSync(ANTIGRAVITY_ACCOUNTS_PATH)) {
            fs.rmSync(ANTIGRAVITY_ACCOUNTS_PATH, { force: true });
        }
    } else {
        delete authCfg[provider];
        if (studio.activeProfiles) delete studio.activeProfiles[provider];
        saveStudioConfig(studio);

        // Do NOT delete profile directory on logout. Users want to keep saved profiles.
        // const providerDir = path.join(AUTH_PROFILES_DIR, provider);
        // if (fs.existsSync(providerDir)) fs.rmSync(providerDir, { recursive: true, force: true });

        // Do NOT delete metadata either, as it tracks profile stats.
        // const metadata = loadPoolMetadata();
        // delete metadata[provider];
        // savePoolMetadata(metadata);
    }

    if (provider === 'google' && activePlugin) {
        const key = 'google.antigravity';
        delete authCfg[key];
    }

    const cp = getConfigPath();
    const ap = path.join(path.dirname(cp), 'auth.json');
    atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));

    const cmd = 'opencode auth logout';
    const configDir = cp ? path.dirname(cp) : process.cwd();
    const safeDir = configDir.replace(/"/g, '\\"');
    const platform = process.platform;
    
    if (platform === 'win32') {
        exec(`start "" /d "${safeDir}" cmd /c "call ${cmd} || pause"`);
    } else if (platform === 'darwin') {
        exec(`osascript -e 'tell application "Terminal" to do script "cd ${safeDir} && ${cmd}"'`);
    } else {
        exec(`bash -c "cd ${safeDir} && ${cmd}"`);
    }

    res.json({ success: true });
});

// ============================================
// ACCOUNT POOL MANAGEMENT (Antigravity-style)
// ============================================
// ACCOUNT POOL MANAGEMENT (Antigravity-style)
// ============================================

const POOL_METADATA_FILE = path.join(HOME_DIR, '.config', 'opencode-studio', 'pool-metadata.json');

function loadPoolMetadata() {
    if (!fs.existsSync(POOL_METADATA_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(POOL_METADATA_FILE, 'utf8'));
    } catch {
        return {};
    }
}

function savePoolMetadata(metadata) {
    const dir = path.dirname(POOL_METADATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    atomicWriteFileSync(POOL_METADATA_FILE, JSON.stringify(metadata, null, 2));
}

function loadAntigravityAccounts() {
    if (!fs.existsSync(ANTIGRAVITY_ACCOUNTS_PATH)) return null;
    try {
        return JSON.parse(fs.readFileSync(ANTIGRAVITY_ACCOUNTS_PATH, 'utf8'));
    } catch {
        return null;
    }
}

function listAntigravityAccounts() {
    const data = loadAntigravityAccounts();
    if (!data?.accounts || !Array.isArray(data.accounts)) return [];
    return data.accounts.map(a => ({
        email: a.email || null,
        refreshToken: a.refreshToken || null
    }));
}

function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = Buffer.from(parts[1], 'base64').toString('utf8');
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

function importCurrentAuthToPool(provider) {
    if (provider === 'google') {
        return importCurrentGoogleAuthToPool();
    }

    const authCfg = loadAuthConfig();
    if (!authCfg || !authCfg[provider]) return;

    const creds = authCfg[provider];
    let email = creds.email;

    if (!email && provider === 'openai' && creds.access) {
        const decoded = decodeJWT(creds.access);
        if (decoded && decoded['https://api.openai.com/profile']?.email) {
            email = decoded['https://api.openai.com/profile'].email;
        }
    }

    const name = email || creds.accountId || creds.id || 'primary';
    const profileDir = path.join(AUTH_PROFILES_DIR, provider);
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    const profilePath = path.join(profileDir, `${name}.json`);

    let shouldSync = true;
    if (fs.existsSync(profilePath)) {
        try {
            const current = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            if (JSON.stringify(current) === JSON.stringify(creds)) {
                shouldSync = false;
            }
        } catch {
        }
    }

    if (shouldSync) {
        console.log(`[Auth] Syncing ${provider} login for ${name} to pool.`);
        atomicWriteFileSync(profilePath, JSON.stringify(creds, null, 2));

        const metadata = loadPoolMetadata();
        if (!metadata[provider]) metadata[provider] = {};
        
        metadata[provider][name] = {
            ...(metadata[provider][name] || {}),
            email: email || null,
            createdAt: metadata[provider][name]?.createdAt || Date.now(),
            lastUsed: Date.now(),
            usageCount: metadata[provider][name]?.usageCount || 0,
            imported: true
        };
        savePoolMetadata(metadata);

        const studio = loadStudioConfig();
        if (!studio.activeProfiles) studio.activeProfiles = {};
        if (studio.activeProfiles[provider] !== name) {
            studio.activeProfiles[provider] = name;
            saveStudioConfig(studio);
        }
    }
}

function importCurrentGoogleAuthToPool() {
    const studio = loadStudioConfig();
    // Only applies if Antigravity is active
    if (studio.activeGooglePlugin !== 'antigravity') return;

    const authCfg = loadAuthConfig();
    if (!authCfg) return;

    // Check google.antigravity first, then google
    const creds = authCfg['google.antigravity'] || authCfg.google;
    if (!creds || !creds.email) return;

    const namespace = 'google.antigravity';
    const profileDir = path.join(AUTH_PROFILES_DIR, namespace);
    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    const email = creds.email;
    const profilePath = path.join(profileDir, `${email}.json`);

    // Check if we need to sync (new account or updated tokens/metadata)
    let shouldSync = true;
    if (fs.existsSync(profilePath)) {
        try {
            const current = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
            if (current.access_token === creds.access_token && 
                current.projectId === creds.projectId && 
                current.tier === creds.tier) {
                shouldSync = false;
            }
        } catch {
            // Corrupt file, overwrite
        }
    }

    if (shouldSync) {
        console.log(`[Auth] Syncing Google login for ${email} to Antigravity pool.`);
        atomicWriteFileSync(profilePath, JSON.stringify(creds, null, 2));

        const metadata = loadPoolMetadata();
        if (!metadata[namespace]) metadata[namespace] = {};
        
        // Update metadata
        // Always update to ensure projectId is captured if added later
        if (!metadata[namespace][email]) {
            metadata[namespace][email] = {
                email: email,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                usageCount: 0,
                imported: true
            };
        }
        savePoolMetadata(metadata);

        // Also update active profile to match what we just imported
        const studio = loadStudioConfig();
        if (!studio.activeProfiles) studio.activeProfiles = {};
        if (studio.activeProfiles.google !== email) {
            studio.activeProfiles.google = email;
            saveStudioConfig(studio);
        }
    }
}

function syncAntigravityPool() {
    const namespace = 'google.antigravity';
    const profileDir = path.join(AUTH_PROFILES_DIR, namespace);

    // Collect accounts from multiple sources
    const allAccounts = [];

    // Source 1: antigravity-accounts.json (antigravity plugin format)
    const antigravityAccounts = listAntigravityAccounts();
    antigravityAccounts.forEach(acc => {
        if (acc.email) allAccounts.push({ email: acc.email, source: 'antigravity' });
    });

    // Source 2: CLIProxyAPI auth directory (~/.cli-proxy-api/)
    const CLIPROXY_AUTH_DIR = path.join(HOME_DIR, '.cli-proxy-api');
    if (fs.existsSync(CLIPROXY_AUTH_DIR)) {
        try {
            const files = fs.readdirSync(CLIPROXY_AUTH_DIR).filter(f => f.endsWith('.json') && f.startsWith('antigravity-'));
            files.forEach(f => {
                // Format: antigravity-email_at_gmail_com.json
                const parts = f.replace('.json', '').split('-');
                if (parts.length > 1) {
                    const emailPart = parts.slice(1).join('-');
                    // Convert underscore notation back to email
                    const email = emailPart.replace(/_/g, '.').replace('.gmail.com', '@gmail.com').replace('.googlemail.com', '@googlemail.com');
                    if (email && !allAccounts.find(a => a.email === email)) {
                        allAccounts.push({ email, source: 'cliproxy', file: f });
                    }
                }
            });
        } catch (e) {
            console.error('[Pool] Error reading CLIProxy auth dir:', e.message);
        }
    }

    if (!allAccounts.length) {
        return;
    }

    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    const metadata = loadPoolMetadata();
    if (!metadata[namespace]) metadata[namespace] = {};

    const seen = new Set();
    allAccounts.forEach((account, idx) => {
        const name = account.email || `account-${idx + 1}`;
        seen.add(name);
        const profilePath = path.join(profileDir, `${name}.json`);
        if (!fs.existsSync(profilePath)) {
            atomicWriteFileSync(profilePath, JSON.stringify({ email: account.email, source: account.source }, null, 2));
        }
        if (!metadata[namespace][name]) {
            metadata[namespace][name] = {
                email: account.email || null,
                createdAt: Date.now(),
                lastUsed: 0,
                usageCount: 0
            };
        }
    });

    // Don't delete profiles that aren't in current sources - they might have been manually added
    // Only update metadata for accounts we found
    savePoolMetadata(metadata);
}

function getAccountStatus(meta, now) {
    if (!meta) return 'ready';
    if (meta.cooldownUntil && meta.cooldownUntil > now) return 'cooldown';
    if (meta.expired) return 'expired';
    return 'ready';
}

function buildAccountPool(provider) {
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;
    
    const profileDir = getProfileDir(provider, activePlugin);
    
    const profiles = [];
    const now = Date.now();
    const metadata = loadPoolMetadata();
    const providerMeta = metadata[namespace] || metadata[provider] || {};
    
    // Get current active profile from studio config
    const studio = loadStudioConfig();
    const activeProfile = studio.activeProfiles?.[provider] || null;
    
    if (fs.existsSync(profileDir)) {
        const files = fs.readdirSync(profileDir).filter(f => f.endsWith('.json'));
        files.forEach(file => {
            const name = file.replace('.json', '');
            const meta = providerMeta[name] || {};
            let profileEmail = null;
            let projectId = null;
            let tier = null;
            try {
                const raw = fs.readFileSync(path.join(profileDir, file), 'utf8');
                const parsed = JSON.parse(raw);
                profileEmail = parsed?.email || null;
                projectId = parsed?.projectId || null;
                tier = parsed?.tier || null;
            } catch {}
            let status = getAccountStatus(meta, now);
            if (name === activeProfile && status === 'ready') status = 'active';
            
            profiles.push({
                name,
                email: meta.email || profileEmail || null,
                status,
                lastUsed: meta.lastUsed || 0,
                usageCount: meta.usageCount || 0,
                cooldownUntil: meta.cooldownUntil || null,
                createdAt: meta.createdAt || 0,
                projectId,
                tier
            });
        });
    }
    
    // Sort: active first, then by lastUsed (LRU)
    profiles.sort((a, b) => {
        if (a.status === 'active') return -1;
        if (b.status === 'active') return 1;
        return a.lastUsed - b.lastUsed;
    });
    
    const available = profiles.filter(p => p.status === 'active' || p.status === 'ready').length;
    const cooldown = profiles.filter(p => p.status === 'cooldown').length;
    
    return {
        provider,
        namespace,
        accounts: profiles,
        activeAccount: activeProfile,
        totalAccounts: profiles.length,
        availableAccounts: available,
        cooldownAccounts: cooldown
    };
}

function getPoolQuota(provider, pool) {
    const metadata = loadPoolMetadata();
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;
    
    const quotaMeta = metadata._quota?.[namespace] || {};
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = quotaMeta[today] || 0;
    
    // Estimate: 1000 requests/day limit (configurable)
    const dailyLimit = quotaMeta.dailyLimit || 1000;
    const remaining = Math.max(0, dailyLimit - todayUsage);
    const percentage = Math.round((remaining / dailyLimit) * 100);
    
    return {
        dailyLimit,
        remaining,
        used: todayUsage,
        percentage,
        resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
        byAccount: pool.accounts.map(acc => ({
            name: acc.name,
            email: acc.email,
            used: acc.usageCount,
            limit: Math.floor(dailyLimit / Math.max(1, pool.totalAccounts))
        }))
    };
}

function rotateAccount(provider, reason = 'manual_rotation') {
    const pool = buildAccountPool(provider);

    if (pool.accounts.length === 0) {
        return { success: false, error: 'No accounts in pool' };
    }

    const now = Date.now();
    const available = pool.accounts.filter(acc => 
        acc.status === 'ready' || (acc.status === 'cooldown' && acc.cooldownUntil && acc.cooldownUntil < now)
    );

    if (available.length === 0) {
        return { success: false, error: 'No available accounts (all in cooldown or expired)' };
    }

    // Pick least recently used
    const next = available.sort((a, b) => a.lastUsed - b.lastUsed)[0];
    const previousActive = pool.activeAccount;

    // Activate the new account
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;

    const profilePath = path.join(AUTH_PROFILES_DIR, namespace, `${next.name}.json`);
    if (!fs.existsSync(profilePath)) {
        return { success: false, error: 'Profile file not found' };
    }

    const profileData = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

    // Update auth.json
    const authCfg = loadAuthConfig() || {};
    authCfg[provider] = profileData;
    if (provider === 'google') {
        authCfg[namespace] = profileData;
    }

    const cp = getConfigPath();
    const ap = path.join(path.dirname(cp), 'auth.json');
    atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));

    // Update studio config
    const studio = loadStudioConfig();
    if (!studio.activeProfiles) studio.activeProfiles = {};
    studio.activeProfiles[provider] = next.name;
    saveStudioConfig(studio);

    // Update metadata
    const metadata = loadPoolMetadata();
    if (!metadata[namespace]) metadata[namespace] = {};
    metadata[namespace][next.name] = {
        ...metadata[namespace][next.name],
        lastUsed: now,
        usageCount: (metadata[namespace][next.name]?.usageCount || 0) + 1
    };

    // Unmark exhaustion if we successfully rotated
    if (metadata._quota?.[namespace]?.exhausted) {
        delete metadata._quota[namespace].exhausted;
    }

    if (!metadata._quota) metadata._quota = {};
    if (!metadata._quota[namespace]) metadata._quota[namespace] = {};
    const today = new Date().toISOString().split('T')[0];
    metadata._quota[namespace][today] = (metadata._quota[namespace][today] || 0) + 1;
    metadata._quota[namespace].lastRotation = now;

    savePoolMetadata(metadata);

    return {
        success: true,
        previousAccount: previousActive,
        newAccount: next.name,
        reason: reason
    };
}

// GET /api/auth/pool - Get account pool for Google (or specified provider)
app.get('/api/auth/pool', (req, res) => {
    const provider = req.query.provider || 'google';
    if (provider === 'google') {
        syncAntigravityPool();
    }
    importCurrentAuthToPool(provider);
    const pool = buildAccountPool(provider);
    const quota = getPoolQuota(provider, pool);
    res.json({ pool, quota });
});

// POST /api/auth/pool/rotate - Rotate to next available account
app.post('/api/auth/pool/rotate', (req, res) => {
    const provider = req.body.provider || 'google';
    const result = rotateAccount(provider, 'manual_rotation');
    
    if (!result.success) {
        return res.status(400).json(result);
    }
    
    res.json(result);
});

// POST /api/auth/pool/limit - Set daily quota limit
app.post('/api/auth/pool/limit', (req, res) => {
    const { provider, limit } = req.body;
    
    if (!provider || typeof limit !== 'number' || limit < 0) {
        return res.status(400).json({ error: 'Invalid provider or limit' });
    }

    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;

    const metadata = loadPoolMetadata();
    if (!metadata._quota) metadata._quota = {};
    if (!metadata._quota[namespace]) metadata._quota[namespace] = {};
    
    metadata._quota[namespace].dailyLimit = limit;
    // Reset exhaustion if limit increased significantly? Maybe user wants to retry.
    // For now, simple update.
    
    savePoolMetadata(metadata);
    res.json({ success: true, limit });
});

// PUT /api/auth/pool/:name/cooldown - Mark account as in cooldown
app.put('/api/auth/pool/:name/cooldown', (req, res) => {
    const { name } = req.params;
    let { duration, provider = 'google', rule } = req.body;
    
    if (rule) {
        const studio = loadStudioConfig();
        const r = (studio.cooldownRules || []).find(cr => cr.name === rule);
        if (r) duration = r.duration;
    }

    if (!duration) duration = 3600000; // default 1 hour
    
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;
    
    const metadata = loadPoolMetadata();
    if (!metadata[namespace]) metadata[namespace] = {};
    
    metadata[namespace][name] = {
        ...metadata[namespace][name],
        cooldownUntil: Date.now() + duration,
        lastCooldownReason: req.body.reason || 'rate_limit'
    };
    
    savePoolMetadata(metadata);
    res.json({ success: true, cooldownUntil: metadata[namespace][name].cooldownUntil });
});

// DELETE /api/auth/pool/:name/cooldown - Clear cooldown for account
app.delete('/api/auth/pool/:name/cooldown', (req, res) => {
    const { name } = req.params;
    const provider = req.query.provider || 'google';
    
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;
    
    const metadata = loadPoolMetadata();
    if (metadata[namespace]?.[name]) {
        delete metadata[namespace][name].cooldownUntil;
        savePoolMetadata(metadata);
    }
    
    res.json({ success: true });
});

// POST /api/auth/pool/:name/usage - Increment usage counter (for tracking)
app.post('/api/auth/pool/:name/usage', (req, res) => {
    const { name } = req.params;
    const { provider = 'google' } = req.body;
    
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;
    
    const metadata = loadPoolMetadata();
    if (!metadata[namespace]) metadata[namespace] = {};
    if (!metadata[namespace][name]) metadata[namespace][name] = { usageCount: 0 };
    
    metadata[namespace][name].usageCount = (metadata[namespace][name].usageCount || 0) + 1;
    metadata[namespace][name].lastUsed = Date.now();
    
    // Track daily quota
    if (!metadata._quota) metadata._quota = {};
    if (!metadata._quota[namespace]) metadata._quota[namespace] = {};
    const today = new Date().toISOString().split('T')[0];
    metadata._quota[namespace][today] = (metadata._quota[namespace][today] || 0) + 1;
    
    savePoolMetadata(metadata);
    res.json({ success: true, usageCount: metadata[namespace][name].usageCount });
});

// PUT /api/auth/pool/:name/metadata - Update account metadata (email, etc.)
app.put('/api/auth/pool/:name/metadata', (req, res) => {
    const { name } = req.params;
    const { provider = 'google', email, createdAt, projectId, tier } = req.body;
    
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;
    
    const metadata = loadPoolMetadata();
    if (!metadata[namespace]) metadata[namespace] = {};
    if (!metadata[namespace][name]) metadata[namespace][name] = {};
    
    if (email !== undefined) metadata[namespace][name].email = email;
    if (createdAt !== undefined) metadata[namespace][name].createdAt = createdAt;
    
    savePoolMetadata(metadata);

    // Update physical profile file if needed
    if (projectId !== undefined || tier !== undefined) {
        const profileDir = getProfileDir(provider, activePlugin);
        const profilePath = path.join(profileDir, `${name}.json`);
        if (fs.existsSync(profilePath)) {
            try {
                const content = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
                if (projectId !== undefined) content.projectId = projectId;
                if (tier !== undefined) content.tier = tier;
                atomicWriteFileSync(profilePath, JSON.stringify(content, null, 2));
            } catch (e) {
                console.error('[Auth] Failed to update profile file:', e);
            }
        }
    }

    res.json({ success: true });
});

// GET /api/auth/pool/quota - Get quota info
app.get('/api/auth/pool/quota', (req, res) => {
    const provider = req.query.provider || 'google';
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;
    
    const metadata = loadPoolMetadata();
    const quotaMeta = metadata._quota?.[namespace] || {};
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = quotaMeta[today] || 0;
    const dailyLimit = quotaMeta.dailyLimit || 1000;
    
    res.json({
        dailyLimit,
        remaining: Math.max(0, dailyLimit - todayUsage),
        used: todayUsage,
        percentage: Math.round(((dailyLimit - todayUsage) / dailyLimit) * 100),
        resetAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString(),
        byAccount: []
    });
});

// POST /api/auth/pool/quota/limit - Set daily quota limit
app.post('/api/auth/pool/quota/limit', (req, res) => {
    const { provider = 'google', limit } = req.body;
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? ('google.antigravity')
        : provider;
    
    const metadata = loadPoolMetadata();
    if (!metadata._quota) metadata._quota = {};
    if (!metadata._quota[namespace]) metadata._quota[namespace] = {};
    metadata._quota[namespace].dailyLimit = limit;
    
    savePoolMetadata(metadata);
    res.json({ success: true, dailyLimit: limit });
});

app.get('/api/profiles', (req, res) => {
    res.json(profileManager.listProfiles());
});

app.post('/api/profiles', (req, res) => {
    try {
        res.json(profileManager.createProfile(req.body.name));
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.delete('/api/profiles/:name', (req, res) => {
    try {
        res.json(profileManager.deleteProfile(req.params.name));
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.post('/api/profiles/:name/activate', (req, res) => {
    try {
        res.json(profileManager.activateProfile(req.params.name));
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// ============================================
// END ACCOUNT POOL MANAGEMENT
// ============================================

app.get('/api/usage', async (req, res) => {
    try {
        const {projectId: fid, granularity = 'daily', range = '30d'} = req.query;
        const cp = getConfigPath();
        if (!cp) return res.json({ totalCost: 0, totalTokens: 0, byModel: [], byDay: [], byProject: [] });
        
        const home = os.homedir();
        const dataCandidates = [
            path.dirname(cp),
            path.join(home, '.local', 'share', 'opencode'),
            path.join(home, '.opencode'),
            process.env.APPDATA ? path.join(process.env.APPDATA, 'opencode') : null,
            path.join(home, 'AppData', 'Local', 'opencode')
        ].filter(Boolean);

        let md = null;
        let sd = null;

        for (const d of dataCandidates) {
            const mdp = path.join(d, 'storage', 'message');
            const sdp = path.join(d, 'storage', 'session');
            if (fs.existsSync(mdp)) {
                md = mdp;
                sd = sdp;
                break;
            }
        }

        if (!md) return res.json({ totalCost: 0, totalTokens: 0, byModel: [], byDay: [], byProject: [] });

        const pmap = new Map();
        if (fs.existsSync(sd)) {
            const sessionDirs = await fs.promises.readdir(sd);
            await Promise.all(sessionDirs.map(async d => {
                const fp = path.join(sd, d);
                try {
                    const stats = await fs.promises.stat(fp);
                    if (stats.isDirectory()) {
                        const files = await fs.promises.readdir(fp);
                        await Promise.all(files.map(async f => {
                            if (f.startsWith('ses_') && f.endsWith('.json')) {
                                try {
                                    const m = JSON.parse(await fs.promises.readFile(path.join(fp, f), 'utf8'));
                                    pmap.set(f.replace('.json', ''), { 
                                        name: m.directory ? path.basename(m.directory) : (m.projectID ? m.projectID.substring(0, 8) : 'Unknown'), 
                                        id: m.projectID || d 
                                    });
                                } catch {}
                            }
                        }));
                    }
                } catch {}
            }));
        }

        const stats = { totalCost: 0, totalTokens: 0, byModel: {}, byTime: {}, byProject: {} };
        const seen = new Set();
        const now = Date.now();
        const from = Number(req.query.from || 0);
        const to = Number(req.query.to || 0);
        let min = 0;
        let max = 0;
        if (range === '24h') min = now - 86400000;
        else if (range === '7d') min = now - 604800000;
        else if (range === '30d') min = now - 2592000000;
        else if (range === '3m') min = now - 7776000000;
        else if (range === '6m') min = now - 15552000000;
        else if (range === '1y') min = now - 31536000000;
        if (from) min = from;
        if (to) max = to;

        const sessionDirs = await fs.promises.readdir(md);
        await Promise.all(sessionDirs.map(async s => {
            if (!s.startsWith('ses_')) return;
            const sp = path.join(md, s);
            try {
                const spStats = await fs.promises.stat(sp);
                if (spStats.isDirectory()) {
                    const files = await fs.promises.readdir(sp);
                    for (const f of files) {
                        if (!f.endsWith('.json')) continue;
                        const fullPath = path.join(sp, f);
                        if (seen.has(fullPath)) continue;
                        seen.add(fullPath);
                        
                        try {
                            const msg = JSON.parse(await fs.promises.readFile(fullPath, 'utf8'));
                            const pid = pmap.get(s)?.id || 'unknown';
                            if (fid && fid !== 'all' && pid !== fid) continue;
                            if (min > 0 && msg.time.created < min) continue;
                            if (max > 0 && msg.time.created > max) continue;
                            
                            if (msg.role === 'assistant' && msg.tokens) {
                                const c = msg.cost || 0, it = msg.tokens.input || 0, ot = msg.tokens.output || 0, t = it + ot;
                                const d = new Date(msg.time.created);
                                let tk;
                                if (granularity === 'hourly') tk = d.toISOString().substring(0, 13) + ':00:00Z';
                                else if (granularity === 'weekly') {
                                    const day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1);
                                    tk = new Date(d.setDate(diff)).toISOString().split('T')[0];
                                } else if (granularity === 'monthly') tk = d.toISOString().substring(0, 7) + '-01';
                                else tk = d.toISOString().split('T')[0];

                                const mid = msg.modelID || (msg.model && (msg.model.modelID || msg.model.id)) || 'unknown';
                                stats.totalCost += c; stats.totalTokens += t;
                                
                                if (!stats.byModel[mid]) stats.byModel[mid] = { name: mid, id: mid, cost: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
                                stats.byModel[mid].cost += c; stats.byModel[mid].tokens += t; stats.byModel[mid].inputTokens += it; stats.byModel[mid].outputTokens += ot;

                                if (!stats.byProject[pid]) stats.byProject[pid] = { name: pmap.get(s)?.name || 'Unassigned', id: pid, cost: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
                                stats.byProject[pid].cost += c; stats.byProject[pid].tokens += t; stats.byProject[pid].inputTokens += it; stats.byProject[pid].outputTokens += ot;

                                if (!stats.byTime[tk]) stats.byTime[tk] = { date: tk, name: tk, id: tk, cost: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
                                const te = stats.byTime[tk];
                                te.cost += c; te.tokens += t; te.inputTokens += it; te.outputTokens += ot;
                                if (!te[mid]) te[mid] = 0;
                                te[mid] += c;
                                
                                const kIn = `${mid}_input`, kOut = `${mid}_output`;
                                te[kIn] = (te[kIn] || 0) + it;
                                te[kOut] = (te[kOut] || 0) + ot;
                            }
                        } catch {}
                    }
                }
            } catch {}
        }));

        res.json({
            totalCost: stats.totalCost,
            totalTokens: stats.totalTokens,
            byModel: Object.values(stats.byModel).sort((a, b) => b.cost - a.cost),
            byDay: Object.values(stats.byTime).sort((a, b) => a.name.localeCompare(b.name)).map(v => ({ ...v, date: v.name })),
            byProject: Object.values(stats.byProject).sort((a, b) => b.cost - a.cost)
        });
    } catch (error) {
        console.error('Usage API error:', error);
        res.status(500).json({ error: 'Failed to fetch usage statistics' });
    }
});

app.post('/api/auth/google/plugin', (req, res) => {
    const { plugin } = req.body;
    const studio = loadStudioConfig();
    studio.activeGooglePlugin = plugin;
    saveStudioConfig(studio);
    
    try {
        const opencode = loadConfig();
        if (opencode) {
            if (!opencode.provider) opencode.provider = {};
            if (!opencode.provider.google) {
                opencode.provider.google = { models: {} };
            }
            
            const models = studio.pluginModels[plugin];
            if (models) {
                opencode.provider.google.models = models;
            }

            if (!opencode.plugin) opencode.plugin = [];
            const geminiPlugin = 'opencode-gemini-auth@latest';
            const antigravityPlugin = 'opencode-google-antigravity-auth';
            
            opencode.plugin = opencode.plugin.filter(p => 
                !p.includes('gemini-auth') && 
                !p.includes('antigravity-auth')
            );
            
            if (plugin === 'gemini') {
                opencode.plugin.push(geminiPlugin);
            } else if (plugin === 'antigravity') {
                opencode.plugin.push(antigravityPlugin);
            }
            
            saveConfig(opencode);
        }

        const cp = getConfigPath();
        if (cp) {
            const ap = path.join(path.dirname(cp), 'auth.json');
            if (fs.existsSync(ap)) {
                const authCfg = JSON.parse(fs.readFileSync(ap, 'utf8'));
                if (plugin === 'antigravity' && authCfg['google.antigravity']) {
                    authCfg.google = { ...authCfg['google.antigravity'] };
                } else if (plugin === 'gemini' && authCfg['google.gemini']) {
                    authCfg.google = { ...authCfg['google.gemini'] };
                }
                atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));
            }
        }
    } catch (err) {
        console.error(err);
    }
    
    res.json({ success: true, activePlugin: plugin });
});

app.get('/api/auth/google/plugin', (req, res) => {
    const studio = loadStudioConfig();
    res.json({ activePlugin: studio.activeGooglePlugin || null });
});

const GEMINI_CLIENT_ID = process.env.GEMINI_CLIENT_ID || "";
const GEMINI_CLIENT_SECRET = process.env.GEMINI_CLIENT_SECRET || "";

function getGeminiClientId() {
    if (GEMINI_CLIENT_ID) return GEMINI_CLIENT_ID;
    const opencodeCfg = loadConfig();
    const oauth = opencodeCfg?.mcp?.google?.oauth;
    return oauth?.clientId || "";
}

const GEMINI_SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
];
const OAUTH_CALLBACK_PORT = 8085;
const GEMINI_REDIRECT_URI = `http://localhost:${OAUTH_CALLBACK_PORT}/oauth2callback`;

let pendingOAuthState = null;
let oauthCallbackServer = null;

function generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

function encodeOAuthState(payload) {
    return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

app.post('/api/auth/google/start', async (req, res) => {
    if (oauthCallbackServer) {
        return res.status(400).json({ error: 'OAuth flow already in progress' });
    }

    const clientId = getGeminiClientId();
    if (!clientId) {
        return res.status(400).json({ error: 'Missing Gemini OAuth client_id. Set GEMINI_CLIENT_ID or mcp.google.oauth.clientId.' });
    }

    const { verifier, challenge } = generatePKCE();
    const state = encodeOAuthState({ verifier });
    
    pendingOAuthState = { verifier, status: 'pending', startedAt: Date.now() };
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', GEMINI_REDIRECT_URI);
    authUrl.searchParams.set('scope', GEMINI_SCOPES.join(' '));
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    
    const callbackApp = express();
    
    callbackApp.get('/oauth2callback', async (callbackReq, callbackRes) => {
        const { code, state: returnedState, error } = callbackReq.query;
        
        if (error) {
            pendingOAuthState = { ...pendingOAuthState, status: 'error', error };
            callbackRes.send('<html><body><h2>Login Failed</h2><p>Error: ' + error + '</p><script>window.close()</script></body></html>');
            shutdownCallbackServer();
            return;
        }
        
        if (!code) {
            pendingOAuthState = { ...pendingOAuthState, status: 'error', error: 'No authorization code received' };
            callbackRes.send('<html><body><h2>Login Failed</h2><p>No code received</p><script>window.close()</script></body></html>');
            shutdownCallbackServer();
            return;
        }
        
        try {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: clientId,
                    client_secret: GEMINI_CLIENT_SECRET,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: GEMINI_REDIRECT_URI,
                    code_verifier: pendingOAuthState.verifier
                })
            });
            
            if (!tokenResponse.ok) {
                const errText = await tokenResponse.text();
                throw new Error(errText);
            }
            
            const tokens = await tokenResponse.json();
            
            let email = null;
            try {
                const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
                    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
                });
                if (userInfoRes.ok) {
                    const userInfo = await userInfoRes.json();
                    email = userInfo.email;
                }
            } catch {}
            
            const cp = getConfigPath();
            const ap = path.join(path.dirname(cp), 'auth.json');
            const authCfg = fs.existsSync(ap) ? JSON.parse(fs.readFileSync(ap, 'utf8')) : {};
            
            const studioConfig = loadStudioConfig();
            const activePlugin = studioConfig.activeGooglePlugin || 'gemini';
            const namespace = 'google.antigravity';
            
            const credentials = {
                refresh_token: tokens.refresh_token,
                access_token: tokens.access_token,
                expiry: Date.now() + (tokens.expires_in * 1000),
                email
            };
            
            authCfg.google = credentials;
            authCfg[namespace] = credentials;
            
            atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));

            const profileDir = path.join(AUTH_PROFILES_DIR, namespace);
            if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
            const profileName = email || `google-${Date.now()}`;
            const profilePath = path.join(profileDir, `${profileName}.json`);
            
            console.log(`[Auth] Saving profile to: ${profilePath}`);
            atomicWriteFileSync(profilePath, JSON.stringify(credentials, null, 2));

            const metadata = loadPoolMetadata();
            if (!metadata[namespace]) metadata[namespace] = {};
            metadata[namespace][profileName] = {
                ...(metadata[namespace][profileName] || {}),
                email: email || null,
                createdAt: metadata[namespace][profileName]?.createdAt || Date.now(),
                lastUsed: Date.now(),
                usageCount: metadata[namespace][profileName]?.usageCount || 0
            };
            savePoolMetadata(metadata);

            if (!studioConfig.activeProfiles) studioConfig.activeProfiles = {};
            studioConfig.activeProfiles.google = profileName;
            saveStudioConfig(studioConfig);
            
            pendingOAuthState = { ...pendingOAuthState, status: 'success', email };
            
            callbackRes.send(`
                <html>
                <head><style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f0fdf4}
                .card{background:white;padding:2rem;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1);text-align:center}
                h2{color:#16a34a;margin:0 0 0.5rem}</style></head>
                <body><div class="card"><h2>✓ Login Successful!</h2><p>Logged in as ${email || 'Google User'}</p><p style="color:#666;font-size:0.875rem">You can close this window.</p></div>
                <script>setTimeout(()=>window.close(),2000)</script></body></html>
            `);
        } catch (err) {
            pendingOAuthState = { ...pendingOAuthState, status: 'error', error: err.message };
            callbackRes.send('<html><body><h2>Login Failed</h2><p>' + err.message + '</p><script>window.close()</script></body></html>');
        }
        
        shutdownCallbackServer();
    });
    
    function shutdownCallbackServer() {
        if (oauthCallbackServer) {
            oauthCallbackServer.close();
            oauthCallbackServer = null;
        }
    }
    
    try {
        oauthCallbackServer = callbackApp.listen(OAUTH_CALLBACK_PORT, () => {
            console.log(`OAuth callback server listening on port ${OAUTH_CALLBACK_PORT}`);
        });
        
        oauthCallbackServer.on('error', (err) => {
            console.error('Failed to start OAuth callback server:', err);
            pendingOAuthState = { status: 'error', error: `Port ${OAUTH_CALLBACK_PORT} in use` };
            oauthCallbackServer = null;
        });
        
        setTimeout(() => {
            if (oauthCallbackServer && pendingOAuthState?.status === 'pending') {
                pendingOAuthState = { ...pendingOAuthState, status: 'error', error: 'OAuth timeout (2 minutes)' };
                shutdownCallbackServer();
            }
        }, 120000);
        
        const platform = process.platform;
        let openCmd;
        if (platform === 'win32') {
            openCmd = `start "" "${authUrl.toString()}"`;
        } else if (platform === 'darwin') {
            openCmd = `open "${authUrl.toString()}"`;
        } else {
            openCmd = `xdg-open "${authUrl.toString()}"`;
        }
        
        exec(openCmd, (err) => {
            if (err) console.error('Failed to open browser:', err);
        });
        
        res.json({ success: true, authUrl: authUrl.toString(), message: 'Browser opened for Google login' });
        
    } catch (err) {
        pendingOAuthState = null;
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/auth/google/status', (req, res) => {
    if (!pendingOAuthState) {
        return res.json({ status: 'idle' });
    }
    res.json(pendingOAuthState);
});

app.post('/api/auth/google/cancel', (req, res) => {
    if (oauthCallbackServer) {
        oauthCallbackServer.close();
        oauthCallbackServer = null;
    }
    pendingOAuthState = null;
    res.json({ success: true });
});

app.get('/api/pending-action', (req, res) => {
    if (pendingActionMemory) return res.json({ action: pendingActionMemory });
    if (fs.existsSync(PENDING_ACTION_PATH)) {
        try {
            const action = JSON.parse(fs.readFileSync(PENDING_ACTION_PATH, 'utf8'));
            return res.json({ action });
        } catch {}
    }
    res.json({ action: null });
});

app.delete('/api/pending-action', (req, res) => {
    pendingActionMemory = null;
    if (fs.existsSync(PENDING_ACTION_PATH)) fs.unlinkSync(PENDING_ACTION_PATH);
    res.json({ success: true });
});

app.post('/api/plugins/config/add', (req, res) => {
    const { plugins } = req.body;
    const opencode = loadConfig();
    if (!opencode) return res.status(404).json({ error: 'Config not found' });
    
    if (!opencode.plugin) opencode.plugin = [];
    const added = [];
    const skipped = [];
    
    plugins.forEach(p => {
        if (!opencode.plugin.includes(p)) {
            opencode.plugin.push(p);
            added.push(p);
            
            const studio = loadStudioConfig();
            if (p.includes('gemini-auth') && !studio.availableGooglePlugins.includes('gemini')) {
                studio.availableGooglePlugins.push('gemini');
                saveStudioConfig(studio);
            }
            if (p.includes('antigravity-auth') && !studio.availableGooglePlugins.includes('antigravity')) {
                studio.availableGooglePlugins.push('antigravity');
                saveStudioConfig(studio);
            }
        } else {
            skipped.push(p);
        }
    });
    
    saveConfig(opencode);
    res.json({ added, skipped });
});

// Presets
app.get('/api/presets', (req, res) => {
    const studio = loadStudioConfig();
    res.json(studio.presets || []);
});

app.post('/api/presets', (req, res) => {
    const { name, description, config } = req.body;
    const studio = loadStudioConfig();
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    const preset = { id, name, description, config };
    studio.presets = studio.presets || [];
    studio.presets.push(preset);
    saveStudioConfig(studio);
    res.json(preset);
});

app.put('/api/presets/:id', (req, res) => {
    const { id } = req.params;
    const { name, description, config } = req.body;
    const studio = loadStudioConfig();
    const index = (studio.presets || []).findIndex(p => p.id === id);
    if (index === -1) return res.status(404).json({ error: 'Preset not found' });
    
    studio.presets[index] = { ...studio.presets[index], name, description, config };
    saveStudioConfig(studio);
    res.json(studio.presets[index]);
});

app.delete('/api/presets/:id', (req, res) => {
    const { id } = req.params;
    const studio = loadStudioConfig();
    studio.presets = (studio.presets || []).filter(p => p.id !== id);
    saveStudioConfig(studio);
    res.json({ success: true });
});

app.post('/api/presets/:id/apply', (req, res) => {
    const { id } = req.params;
    const { mode } = req.body; // 'exclusive', 'additive'
    
    const studio = loadStudioConfig();
    const preset = (studio.presets || []).find(p => p.id === id);
    if (!preset) return res.status(404).json({ error: 'Preset not found' });
    
    const config = loadConfig() || {};
    const cp = getConfigPath();
    const configDir = path.dirname(cp);
    const skillDir = path.join(configDir, 'skill');
    const pluginDir = path.join(configDir, 'plugin');
    
    // Skills
    if (preset.config.skills !== undefined && preset.config.skills !== null) {
        const targetSkills = new Set(preset.config.skills);
        if (mode === 'exclusive') {
            const allSkills = [];
            if (fs.existsSync(skillDir)) {
                const dirents = fs.readdirSync(skillDir, { withFileTypes: true });
                for (const dirent of dirents) {
                    if (dirent.isDirectory()) {
                        if (fs.existsSync(path.join(skillDir, dirent.name, 'SKILL.md'))) {
                            allSkills.push(dirent.name);
                        }
                    } else if (dirent.name.endsWith('.md')) {
                        allSkills.push(dirent.name.replace('.md', ''));
                    }
                }
            }
            studio.disabledSkills = allSkills.filter(s => !targetSkills.has(s));
        } else { // additive
            studio.disabledSkills = (studio.disabledSkills || []).filter(s => !targetSkills.has(s));
        }
    }
    
    // Plugins
    if (preset.config.plugins !== undefined && preset.config.plugins !== null) {
        const targetPlugins = new Set(preset.config.plugins);
        if (mode === 'exclusive') {
            const allPlugins = [...(config.plugin || [])];
            if (fs.existsSync(pluginDir)) {
                const files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
                allPlugins.push(...files.map(f => f.replace(/\.[^/.]+$/, "")));
            }
            const uniquePlugins = [...new Set(allPlugins)];
            studio.disabledPlugins = uniquePlugins.filter(p => !targetPlugins.has(p));
        } else { // additive
            studio.disabledPlugins = (studio.disabledPlugins || []).filter(p => !targetPlugins.has(p));
        }
    }
    
    // MCPs
    if (preset.config.mcps !== undefined && preset.config.mcps !== null) {
        const targetMcps = new Set(preset.config.mcps);
        if (config.mcp) {
            for (const key in config.mcp) {
                if (mode === 'exclusive') {
                    config.mcp[key].enabled = targetMcps.has(key);
                } else { // additive
                    if (targetMcps.has(key)) config.mcp[key].enabled = true;
                }
            }
        }
    }
    
    saveStudioConfig(studio);
    saveConfig(config);
    res.json({ success: true });
});

// Start watcher on server start
async function startServer() {
    ['google', 'anthropic', 'openai', 'xai', 'openrouter', 'together', 'mistral', 'deepseek', 'amazon-bedrock', 'azure', 'github-copilot'].forEach(p => importCurrentAuthToPool(p));

    const port = await findAvailablePort(DEFAULT_PORT);
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        // Initial sync on startup if enabled
        setTimeout(() => {
            const studio = loadStudioConfig();
            if (studio.githubAutoSync) {
                console.log('[AutoSync] Triggering initial sync...');
                triggerGitHubAutoSync();
            }
        }, 5000);
    });
}

if (require.main === module) {
    startServer();
}

module.exports = {
    startServer,
    rotateAccount,
    processLogLine,
    loadPoolMetadata,
    savePoolMetadata,
    loadStudioConfig,
    saveStudioConfig,
    buildAccountPool
};
app.get('/api/prompts/global', (req, res) => {
    const cp = getConfigPath();
    const dir = cp ? path.dirname(cp) : path.join(os.homedir(), '.config', 'opencode');
    const globalPath = path.join(dir, 'OPENCODE.md');
    
    if (fs.existsSync(globalPath)) {
        res.json({ content: fs.readFileSync(globalPath, 'utf8') });
    } else {
        res.json({ content: '' }); 
    }
});

app.post('/api/prompts/global', (req, res) => {
    const { content } = req.body;
    const cp = getConfigPath();
    const dir = cp ? path.dirname(cp) : path.join(os.homedir(), '.config', 'opencode');
    const globalPath = path.join(dir, 'OPENCODE.md');
    
    console.log(`[Prompts] Saving to: ${globalPath}`);

    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        atomicWriteFileSync(globalPath, content);
        res.json({ success: true });
    } catch (err) {
        console.error('[Prompts] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
