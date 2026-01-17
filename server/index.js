const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');

const pkg = require('./package.json');
const proxyManager = require('./proxy-manager');
const profileManager = require('./profile-manager');
const SERVER_VERSION = pkg.version;

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
const PORT = 3001;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; 

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
    'http://localhost:3000',
    'http://127.0.0.1:3000',
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
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const HOME_DIR = os.homedir();
const STUDIO_CONFIG_PATH = path.join(HOME_DIR, '.config', 'opencode-studio', 'studio.json');
const PENDING_ACTION_PATH = path.join(HOME_DIR, '.config', 'opencode-studio', 'pending-action.json');
const ANTIGRAVITY_ACCOUNTS_PATH = path.join(HOME_DIR, '.config', 'opencode', 'antigravity-accounts.json');
const LOG_DIR = path.join(HOME_DIR, '.local', 'share', 'opencode', 'log');

let logWatcher = null;
let currentLogFile = null;
let logReadStream = null;

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
    // Detect LLM usage: service=llm providerID=... modelID=...
    // Example: service=llm providerID=openai modelID=gpt-5.2-codex sessionID=...
    const isUsage = line.includes('service=llm') && line.includes('stream');
    const isError = line.includes('service=llm') && (line.includes('error=') || line.includes('status=429'));
    
    if (!isUsage && !isError) return;

    const providerMatch = line.match(/providerID=([^\s]+)/);
    const modelMatch = line.match(/modelID=([^\s]+)/);
    
    if (providerMatch) {
        const provider = providerMatch[1];
        const model = modelMatch ? modelMatch[1] : 'unknown';
        
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
        activeProfiles: {},
        activeGooglePlugin: 'gemini',
        availableGooglePlugins: [],
        presets: [],
        cooldownRules: [
            { name: "Antigravity Claude Opus (4h)", duration: 4 * 60 * 60 * 1000 },
            { name: "Antigravity Gemini 3 Pro (24h)", duration: 24 * 60 * 60 * 1000 }
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
                        "high": { "options": { "thinkingConfig": { "thinkingLevel": "high", "includeThoughts": true } } }
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
                        "high": { "options": { "thinkingConfig": { "thinkingLevel": "high", "includeThoughts": true } } }
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
                        "high": { "options": { "thinkingConfig": { "thinkingLevel": "high", "includeThoughts": true } } }
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
                        "high": { "options": { "thinkingConfig": { "thinkingBudget": 32000, "includeThoughts": true } } }
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
                        "high": { "options": { "thinkingConfig": { "thinkingBudget": 32000, "includeThoughts": true } } }
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

    const studioConfig = loadStudioConfig();
    const manualPath = studioConfig.configPath;

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

const getConfigPath = () => getPaths().current;

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
    studioConfig.configPath = configPath;
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
        saveConfig(req.body);
        res.json({ success: true });
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
        
        const sd = getSkillDir();
        if (sd && fs.existsSync(sd)) {
            fs.readdirSync(sd, { withFileTypes: true })
                .filter(e => e.isDirectory() && fs.existsSync(path.join(sd, e.name, 'SKILL.md')))
                .forEach(e => {
                    const content = fs.readFileSync(path.join(sd, e.name, 'SKILL.md'), 'utf8');
                    skills.push({ name: e.name, content });
                });
        }
        
        const pd = getPluginDir();
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
        
        const sd = getSkillDir();
        if (sd && skills && Array.isArray(skills)) {
            if (!fs.existsSync(sd)) fs.mkdirSync(sd, { recursive: true });
            skills.forEach(s => {
                const skillDir = path.join(sd, s.name);
                if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
                atomicWriteFileSync(path.join(skillDir, 'SKILL.md'), s.content);
            });
        }
        
        const pd = getPluginDir();
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
const GDRIVE_CLIENT_ID = 'your-google-client-id';

function buildBackupData() {
    const studio = loadStudioConfig();
    const opencodeConfig = loadConfig();
    const skills = [];
    const plugins = [];
    
    const sd = getSkillDir();
    if (sd && fs.existsSync(sd)) {
        fs.readdirSync(sd, { withFileTypes: true })
            .filter(e => e.isDirectory() && fs.existsSync(path.join(sd, e.name, 'SKILL.md')))
            .forEach(e => {
                skills.push({ name: e.name, content: fs.readFileSync(path.join(sd, e.name, 'SKILL.md'), 'utf8') });
            });
    }
    
    const pd = getPluginDir();
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
    
    const sd = getSkillDir();
    if (sd && backup.skills && Array.isArray(backup.skills)) {
        if (!fs.existsSync(sd)) fs.mkdirSync(sd, { recursive: true });
        backup.skills.forEach(s => {
            const skillDir = path.join(sd, s.name);
            if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
            atomicWriteFileSync(path.join(skillDir, 'SKILL.md'), s.content);
        });
    }
    
    const pd = getPluginDir();
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

app.get('/api/sync/gdrive/auth-url', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    const studio = loadStudioConfig();
    studio.oauthState = state;
    
    const redirectUri = req.query.redirect_uri || 'http://localhost:3000/settings';
    studio.oauthRedirectUri = redirectUri;
    saveStudioConfig(studio);
    
    const params = new URLSearchParams({
        client_id: GDRIVE_CLIENT_ID,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/drive.file',
        access_type: 'offline',
        prompt: 'consent',
        redirect_uri: redirectUri,
        state: state
    });
    res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
});

app.post('/api/sync/gdrive/callback', async (req, res) => {
    try {
        const { code, state } = req.body;
        const studio = loadStudioConfig();
        
        if (state !== studio.oauthState) {
            return res.status(400).json({ error: 'Invalid state' });
        }
        const redirectUri = studio.oauthRedirectUri || 'http://localhost:3000/settings';
        delete studio.oauthState;
        delete studio.oauthRedirectUri;
        
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: GDRIVE_CLIENT_ID,
                // client_secret: 'GDRIVE_CLIENT_SECRET', // NOTE: OAuth flow for installed apps usually requires client secret.
                // For simplicity in this demo, we assume PKCE or a public client flow if supported, 
                // OR the user will need to provide the secret in environment variables.
                // Since this is a local server, we might need the secret.
                // Let's assume for now we'll put a placeholder or rely on env vars.
                // Google "Installed App" flow doesn't always need secret if type is "Desktop".
                // However, for web flow it does. 
                // Let's assume we need a client secret env var for now.
                client_secret: process.env.GDRIVE_CLIENT_SECRET || 'your-google-client-secret',
                redirect_uri: redirectUri,
                grant_type: 'authorization_code'
            })
        });
        
        if (!response.ok) {
            const err = await response.text();
            return res.status(400).json({ error: `Google auth failed: ${err}` });
        }
        
        const tokens = await response.json();
        studio.cloudProvider = 'gdrive';
        studio.cloudToken = tokens.access_token;
        if (tokens.refresh_token) studio.cloudRefreshToken = tokens.refresh_token;
        saveStudioConfig(studio);
        
        res.json({ success: true, provider: 'gdrive' });
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
        } else if (studio.cloudProvider === 'gdrive') {
            // Find existing file
            const listRes = await fetch('https://www.googleapis.com/drive/v3/files?q=name=\'opencode-studio-sync.json\' and trashed=false', {
                headers: { 'Authorization': `Bearer ${studio.cloudToken}` }
            });
            const listData = await listRes.json();
            const existingFile = listData.files?.[0];

            if (existingFile) {
                // Update content
                const updateRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${studio.cloudToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: content
                });
                if (!updateRes.ok) {
                    const err = await updateRes.text();
                    return res.status(400).json({ error: `Google Drive update failed: ${err}` });
                }
            } else {
                // Create new file (multipart)
                const metadata = { name: 'opencode-studio-sync.json', mimeType: 'application/json' };
                const boundary = '-------314159265358979323846';
                const delimiter = "\r\n--" + boundary + "\r\n";
                const close_delim = "\r\n--" + boundary + "--";
                
                const multipartBody = 
                    delimiter + 
                    'Content-Type: application/json\r\n\r\n' + 
                    JSON.stringify(metadata) + 
                    delimiter + 
                    'Content-Type: application/json\r\n\r\n' + 
                    content + 
                    close_delim;

                const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${studio.cloudToken}`,
                        'Content-Type': `multipart/related; boundary="${boundary}"`
                    },
                    body: multipartBody
                });
                if (!createRes.ok) {
                    const err = await createRes.text();
                    return res.status(400).json({ error: `Google Drive create failed: ${err}` });
                }
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
        } else if (studio.cloudProvider === 'gdrive') {
            const listRes = await fetch('https://www.googleapis.com/drive/v3/files?q=name=\'opencode-studio-sync.json\' and trashed=false', {
                headers: { 'Authorization': `Bearer ${studio.cloudToken}` }
            });
            const listData = await listRes.json();
            const existingFile = listData.files?.[0];
            
            if (!existingFile) return res.status(404).json({ error: 'No sync file found in cloud' });
            
            const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
                headers: { 'Authorization': `Bearer ${studio.cloudToken}` }
            });
            if (!downloadRes.ok) {
                const err = await downloadRes.text();
                return res.status(400).json({ error: `Google Drive download failed: ${err}` });
            }
            content = await downloadRes.text();
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

const getSkillDir = () => {
    const cp = getConfigPath();
    return cp ? path.join(path.dirname(cp), 'skill') : null;
};

app.get('/api/skills', (req, res) => {
    const sd = getSkillDir();
    if (!sd || !fs.existsSync(sd)) return res.json([]);
    const studio = loadStudioConfig();
    const disabledSkills = studio.disabledSkills || [];
    const skills = fs.readdirSync(sd, { withFileTypes: true })
        .filter(e => e.isDirectory() && fs.existsSync(path.join(sd, e.name, 'SKILL.md')))
        .map(e => ({ name: e.name, path: path.join(sd, e.name, 'SKILL.md'), enabled: !disabledSkills.includes(e.name) }));
    res.json(skills);
});

app.get('/api/skills/:name', (req, res) => {
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(req.params.name)) {
        return res.status(400).json({ error: 'Invalid skill name' });
    }
    const sd = getSkillDir();
    const p = sd ? path.join(sd, req.params.name, 'SKILL.md') : null;
    if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
    res.json({ name: req.params.name, content: fs.readFileSync(p, 'utf8') });
});

app.post('/api/skills/:name', (req, res) => {
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(req.params.name)) {
        return res.status(400).json({ error: 'Invalid skill name' });
    }
    const sd = getSkillDir();
    if (!sd) return res.status(404).json({ error: 'No config' });
    const dp = path.join(sd, req.params.name);
    if (!fs.existsSync(dp)) fs.mkdirSync(dp, { recursive: true });
    fs.writeFileSync(path.join(dp, 'SKILL.md'), req.body.content, 'utf8');
    res.json({ success: true });
});

app.delete('/api/skills/:name', (req, res) => {
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(req.params.name)) {
        return res.status(400).json({ error: 'Invalid skill name' });
    }
    const sd = getSkillDir();
    const dp = sd ? path.join(sd, req.params.name) : null;
    if (dp && fs.existsSync(dp)) fs.rmSync(dp, { recursive: true, force: true });
    res.json({ success: true });
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
    res.json({ success: true, enabled: !studio.disabledSkills.includes(name) });
});

const getPluginDir = () => {
    const cp = getConfigPath();
    return cp ? path.join(path.dirname(cp), 'plugin') : null;
};

app.get('/api/plugins', (req, res) => {
    const pd = getPluginDir();
    const cp = getConfigPath();
    const cr = cp ? path.dirname(cp) : null;
    const studio = loadStudioConfig();
    const disabledPlugins = studio.disabledPlugins || [];
    const plugins = [];
    const add = (name, p, type = 'file') => {
        if (!plugins.some(pl => pl.name === name)) {
            plugins.push({ name, path: p, type, enabled: !disabledPlugins.includes(name) });
        }
    };

    if (pd && fs.existsSync(pd)) {
        fs.readdirSync(pd, { withFileTypes: true }).forEach(e => {
            const fp = path.join(pd, e.name);
            const st = fs.lstatSync(fp);
            if (st.isDirectory()) {
                const j = path.join(fp, 'index.js'), t = path.join(fp, 'index.ts');
                if (fs.existsSync(j) || fs.existsSync(t)) add(e.name, fs.existsSync(j) ? j : t, 'file');
            } else if ((st.isFile() || st.isSymbolicLink()) && /\.(js|ts)$/.test(e.name)) {
                add(e.name.replace(/\.(js|ts)$/, ''), fp, 'file');
            }
        });
    }

    if (cr && fs.existsSync(cr)) {
        ['oh-my-opencode', 'superpowers', 'opencode-gemini-auth'].forEach(n => {
            const fp = path.join(cr, n);
            if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) add(n, fp, 'file');
        });
    }

    const cfg = loadConfig();
    if (cfg && Array.isArray(cfg.plugin)) {
        cfg.plugin.forEach(n => {
            if (!n.includes('/') && !n.includes('\\') && !/\.(js|ts)$/.test(n)) add(n, 'npm', 'npm');
        });
    }
    res.json(plugins);
});

app.get('/api/plugins/:name', (req, res) => {
    const { name } = req.params;
    const pd = getPluginDir();
    
    const possiblePaths = [
        path.join(pd, name + '.js'),
        path.join(pd, name + '.ts'),
        path.join(pd, name, 'index.js'),
        path.join(pd, name, 'index.ts')
    ];
    
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf8');
            return res.json({ name, content });
        }
    }
    res.status(404).json({ error: 'Plugin not found' });
});

app.post('/api/plugins/:name', (req, res) => {
    const { name } = req.params;
    const { content } = req.body;
    const pd = getPluginDir();
    if (!fs.existsSync(pd)) fs.mkdirSync(pd, { recursive: true });
    
    // Default to .js if new
    const filePath = path.join(pd, name.endsWith('.js') || name.endsWith('.ts') ? name : name + '.js');
    atomicWriteFileSync(filePath, content);
    res.json({ success: true });
});

app.delete('/api/plugins/:name', (req, res) => {
    const { name } = req.params;
    const pd = getPluginDir();
    
    const possiblePaths = [
        path.join(pd, name),
        path.join(pd, name + '.js'),
        path.join(pd, name + '.ts')
    ];
    
    let deleted = false;
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            if (fs.statSync(p).isDirectory()) {
                fs.rmSync(p, { recursive: true, force: true });
            } else {
                fs.unlinkSync(p);
            }
            deleted = true;
        }
    }
    
    if (deleted) res.json({ success: true });
    else res.status(404).json({ error: 'Plugin not found' });
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
    res.json({ success: true, enabled: !studio.disabledPlugins.includes(name) });
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
        delete authCfg[provider];
        if (provider === 'google') {
             const key = 'google.antigravity';
             delete authCfg.google;
             delete authCfg[key];
        }
        const cp = getConfigPath();
        const ap = path.join(path.dirname(cp), 'auth.json');
        atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));
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
    } else if (wasActive && authCfg[provider]) {
        delete authCfg[provider];
        changed = true;
    }

    if (changed) {
        const cp = getConfigPath();
        const ap = path.join(path.dirname(cp), 'auth.json');
        atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));
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

        // Do NOT delete the profile directory on logout. Users want to keep saved profiles.
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

    res.json({ success: true });
});

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

    const name = email || creds.accountId || creds.id || `profile-${Date.now()}`;
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
    }
}

function syncAntigravityPool() {
    const accounts = listAntigravityAccounts();
    const namespace = 'google.antigravity';
    const profileDir = path.join(AUTH_PROFILES_DIR, namespace);

    if (!accounts.length) {
        return;
    }

    if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

    const metadata = loadPoolMetadata();
    if (!metadata[namespace]) metadata[namespace] = {};

    const seen = new Set();
    accounts.forEach((account, idx) => {
        const name = account.email || `account-${idx + 1}`;
        seen.add(name);
        const profilePath = path.join(profileDir, `${name}.json`);
        if (!fs.existsSync(profilePath)) {
            atomicWriteFileSync(profilePath, JSON.stringify({ email: account.email }, null, 2));
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

    const profileFiles = fs.existsSync(profileDir) ? fs.readdirSync(profileDir).filter(f => f.endsWith('.json')) : [];
    profileFiles.forEach(file => {
        const name = file.replace('.json', '');
        if (!seen.has(name)) {
            fs.unlinkSync(path.join(profileDir, file));
            if (metadata[namespace]?.[name]) delete metadata[namespace][name];
        }
    });

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
    syncAntigravityPool();
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

app.get('/api/proxy/status', async (req, res) => {
    const status = await proxyManager.getStatus();
    res.json(status);
});

app.post('/api/proxy/start', async (req, res) => {
    const result = await proxyManager.startProxy();
    res.json(result);
});

app.post('/api/proxy/stop', async (req, res) => {
    const result = proxyManager.stopProxy();
    res.json(result);
});

app.post('/api/proxy/login', async (req, res) => {
    const { provider } = req.body;
    const result = await proxyManager.runLogin(provider);
    if (!result.success) return res.status(400).json(result);
    
    const cmd = result.command;
    const cp = getConfigPath();
    const configDir = cp ? path.dirname(cp) : process.cwd();
    const safeDir = configDir.replace(/"/g, '\\"');
    const platform = process.platform;
    
    if (platform === 'win32') {
        const terminalCmd = `start "" /d "${safeDir}" cmd /c "call ${cmd} || pause"`;
        exec(terminalCmd, (err) => {
            if (err) return res.status(500).json({ error: 'Failed to open terminal', details: err.message });
            res.json({ success: true, message: 'Terminal opened' });
        });
    } else if (platform === 'darwin') {
        const terminalCmd = `osascript -e 'tell application "Terminal" to do script "cd ${safeDir} && ${cmd}"'`;
        exec(terminalCmd, (err) => {
            if (err) return res.status(500).json({ error: 'Failed to open terminal', details: err.message });
            res.json({ success: true, message: 'Terminal opened' });
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
                return res.json({ 
                    success: false, 
                    message: 'No terminal emulator found', 
                    note: 'Run this command manually:',
                    command: cmd
                });
            }
            const terminal = linuxTerminals[index];
            exec(terminal.cmd, (err) => {
                if (err) {
                    tryTerminal(index + 1);
                } else {
                    res.json({ success: true, message: 'Terminal opened' });
                }
            });
        };
        tryTerminal(0);
    }
});

app.get('/api/proxy/accounts', (req, res) => {
    res.json(proxyManager.listAccounts());
});

app.get('/api/proxy/config', (req, res) => {
    res.json(proxyManager.loadProxyConfig());
});

app.post('/api/proxy/config', (req, res) => {
    proxyManager.saveProxyConfig(req.body);
    res.json({ success: true });
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
function startServer() {
    ['google', 'anthropic', 'openai', 'xai', 'openrouter', 'together', 'mistral', 'deepseek', 'amazon-bedrock', 'azure', 'github-copilot'].forEach(p => importCurrentAuthToPool(p));
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
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
