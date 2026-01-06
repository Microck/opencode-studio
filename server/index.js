const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

const app = express();
const PORT = 3001;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; 

let lastActivityTime = Date.now();
let idleTimer = null;

function resetIdleTimer() {
    lastActivityTime = Date.now();
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

let pendingActionMemory = null;

function loadStudioConfig() {
    if (!fs.existsSync(STUDIO_CONFIG_PATH)) {
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(STUDIO_CONFIG_PATH, 'utf8'));
    } catch {
        return {};
    }
}

function saveStudioConfig(config) {
    try {
        const dir = path.dirname(STUDIO_CONFIG_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(STUDIO_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error('Failed to save studio config:', err);
        return false;
    }
}

function loadPendingAction() {
    if (pendingActionMemory) return pendingActionMemory;
    
    if (fs.existsSync(PENDING_ACTION_PATH)) {
        try {
            const action = JSON.parse(fs.readFileSync(PENDING_ACTION_PATH, 'utf8'));
            if (action.timestamp && Date.now() - action.timestamp < 60000) {
                pendingActionMemory = action;
                fs.unlinkSync(PENDING_ACTION_PATH);
                return action;
            }
            fs.unlinkSync(PENDING_ACTION_PATH);
        } catch {
            try { fs.unlinkSync(PENDING_ACTION_PATH); } catch {}
        }
    }
    return null;
}

app.get('/api/pending-action', (req, res) => {
    const action = loadPendingAction();
    res.json({ action });
});

app.delete('/api/pending-action', (req, res) => {
    pendingActionMemory = null;
    if (fs.existsSync(PENDING_ACTION_PATH)) {
        try { fs.unlinkSync(PENDING_ACTION_PATH); } catch {}
    }
    res.json({ success: true });
});

const getPaths = () => {
    const platform = process.platform;
    const home = os.homedir();
    
    let candidates = [];
    if (platform === 'win32') {
        candidates = [
            path.join(process.env.APPDATA, 'opencode', 'opencode.json'),
            path.join(home, '.config', 'opencode', 'opencode.json'),
            path.join(home, '.local', 'share', 'opencode', 'opencode.json'),
        ];
    } else {
        candidates = [
            path.join(home, '.config', 'opencode', 'opencode.json'),
            path.join(home, '.opencode', 'opencode.json'),
            path.join(home, '.local', 'share', 'opencode', 'opencode.json'),
        ];
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
        candidates
    };
};

const getConfigPath = () => {
    const paths = getPaths();
    return paths.current;
};

const loadConfig = () => {
    const configPath = getConfigPath();
    if (!configPath || !fs.existsSync(configPath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        return null;
    }
};

const saveConfig = (config) => {
    const configPath = getConfigPath();
    if (!configPath) {
        throw new Error('No config path found');
    }
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
};

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/shutdown', (req, res) => {
    res.json({ success: true });
    setTimeout(() => process.exit(0), 100);
});

app.get('/api/paths', (req, res) => {
    res.json(getPaths());
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
    if (!config) {
        return res.status(404).json({ error: 'Config not found' });
    }
    res.json(config);
});

app.post('/api/config', (req, res) => {
    const config = req.body;
    try {
        saveConfig(config);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const getSkillDir = () => {
    const configPath = getConfigPath();
    if (!configPath) return null;
    return path.join(path.dirname(configPath), 'skill');
};

app.get('/api/skills', (req, res) => {
    const skillDir = getSkillDir();
    if (!skillDir || !fs.existsSync(skillDir)) {
        return res.json([]);
    }
    
    const skills = [];
    const entries = fs.readdirSync(skillDir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const skillPath = path.join(skillDir, entry.name, 'SKILL.md');
            if (fs.existsSync(skillPath)) {
                skills.push({
                    name: entry.name,
                    path: skillPath,
                    enabled: !entry.name.endsWith('.disabled')
                });
            }
        }
    }
    res.json(skills);
});

app.get('/api/skills/:name', (req, res) => {
    const skillDir = getSkillDir();
    if (!skillDir) return res.status(404).json({ error: 'No config' });
    
    const name = req.params.name;
    const skillPath = path.join(skillDir, name, 'SKILL.md');
    
    if (!fs.existsSync(skillPath)) {
        return res.status(404).json({ error: 'Skill not found' });
    }
    
    const content = fs.readFileSync(skillPath, 'utf8');
    res.json({ name, content });
});

app.post('/api/skills/:name', (req, res) => {
    const skillDir = getSkillDir();
    if (!skillDir) return res.status(404).json({ error: 'No config' });
    
    const name = req.params.name;
    const { content } = req.body;
    const dirPath = path.join(skillDir, name);
    
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
    fs.writeFileSync(path.join(dirPath, 'SKILL.md'), content, 'utf8');
    res.json({ success: true });
});

app.delete('/api/skills/:name', (req, res) => {
    const skillDir = getSkillDir();
    if (!skillDir) return res.status(404).json({ error: 'No config' });
    
    const name = req.params.name;
    const dirPath = path.join(skillDir, name);
    
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
    res.json({ success: true });
});

app.post('/api/skills/:name/toggle', (req, res) => {
    res.json({ success: true, enabled: true }); 
});

const getPluginDir = () => {
    const configPath = getConfigPath();
    if (!configPath) return null;
    return path.join(path.dirname(configPath), 'plugin');
};

app.get('/api/plugins', (req, res) => {
    const pluginDir = getPluginDir();
    if (!pluginDir || !fs.existsSync(pluginDir)) {
        return res.json([]);
    }
    
    const plugins = [];
    const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
    
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const jsPath = path.join(pluginDir, entry.name, 'index.js');
            const tsPath = path.join(pluginDir, entry.name, 'index.ts');
            
            if (fs.existsSync(jsPath) || fs.existsSync(tsPath)) {
                plugins.push({
                    name: entry.name,
                    path: fs.existsSync(jsPath) ? jsPath : tsPath,
                    enabled: true 
                });
            }
        } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
            plugins.push({
                name: entry.name.replace(/\.(js|ts)$/, ''),
                path: path.join(pluginDir, entry.name),
                enabled: true
            });
        }
    }
    res.json(plugins);
});

app.get('/api/plugins/:name', (req, res) => {
    const pluginDir = getPluginDir();
    if (!pluginDir) return res.status(404).json({ error: 'No config' });
    
    const name = req.params.name;
    const dirPath = path.join(pluginDir, name);
    
    let content = '';
    let filename = '';
    
    if (fs.existsSync(path.join(dirPath, 'index.js'))) {
        content = fs.readFileSync(path.join(dirPath, 'index.js'), 'utf8');
        filename = 'index.js';
    } else if (fs.existsSync(path.join(dirPath, 'index.ts'))) {
        content = fs.readFileSync(path.join(dirPath, 'index.ts'), 'utf8');
        filename = 'index.ts';
    } else if (fs.existsSync(path.join(pluginDir, name + '.js'))) {
        content = fs.readFileSync(path.join(pluginDir, name + '.js'), 'utf8');
        filename = name + '.js';
    } else if (fs.existsSync(path.join(pluginDir, name + '.ts'))) {
        content = fs.readFileSync(path.join(pluginDir, name + '.ts'), 'utf8');
        filename = name + '.ts';
    } else {
        return res.status(404).json({ error: 'Plugin not found' });
    }
    
    res.json({ name, content, filename });
});

app.post('/api/plugins/:name', (req, res) => {
    const pluginDir = getPluginDir();
    if (!pluginDir) return res.status(404).json({ error: 'No config' });
    
    const name = req.params.name;
    const { content } = req.body;
    const dirPath = path.join(pluginDir, name);
    
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    
    const filePath = path.join(dirPath, 'index.js');
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ success: true });
});

app.delete('/api/plugins/:name', (req, res) => {
    const pluginDir = getPluginDir();
    if (!pluginDir) return res.status(404).json({ error: 'No config' });
    
    const name = req.params.name;
    const dirPath = path.join(pluginDir, name);
    
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    } else if (fs.existsSync(path.join(pluginDir, name + '.js'))) {
        fs.unlinkSync(path.join(pluginDir, name + '.js'));
    } else if (fs.existsSync(path.join(pluginDir, name + '.ts'))) {
        fs.unlinkSync(path.join(pluginDir, name + '.ts'));
    }
    res.json({ success: true });
});

app.post('/api/plugins/:name/toggle', (req, res) => {
    res.json({ success: true, enabled: true });
});

app.post('/api/fetch-url', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL required' });
    
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
        const content = await response.text();
        const filename = path.basename(new URL(url).pathname) || 'file.txt';
        
        res.json({ content, filename, url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/bulk-fetch', async (req, res) => {
    const { urls } = req.body;
    if (!Array.isArray(urls)) return res.status(400).json({ error: 'URLs array required' });
    
    const fetch = (await import('node-fetch')).default;
    const results = [];
    
    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
            const content = await response.text();
            const filename = path.basename(new URL(url).pathname) || 'file.txt';
            
            results.push({
                url,
                success: true,
                content,
                filename,
                name: filename.replace(/\.(md|js|ts)$/, ''),
            });
        } catch (err) {
            results.push({
                url,
                success: false,
                error: err.message
            });
        }
    }
    
    res.json({ results });
});

app.get('/api/backup', (req, res) => {
    const studioConfig = loadStudioConfig();
    const opencodeConfig = loadConfig();
    
    const skills = [];
    const skillDir = getSkillDir();
    if (skillDir && fs.existsSync(skillDir)) {
        const entries = fs.readdirSync(skillDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const p = path.join(skillDir, entry.name, 'SKILL.md');
                if (fs.existsSync(p)) {
                    skills.push({ name: entry.name, content: fs.readFileSync(p, 'utf8') });
                }
            }
        }
    }
    
    const plugins = [];
    const pluginDir = getPluginDir();
    if (pluginDir && fs.existsSync(pluginDir)) {
        const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const p = path.join(pluginDir, entry.name, 'index.js');
                if (fs.existsSync(p)) {
                    plugins.push({ name: entry.name, content: fs.readFileSync(p, 'utf8') });
                }
            }
        }
    }
    
    res.json({
        version: 1,
        timestamp: new Date().toISOString(),
        studioConfig,
        opencodeConfig,
        skills,
        plugins
    });
});

app.post('/api/restore', (req, res) => {
    const backup = req.body;
    
    if (backup.studioConfig) {
        saveStudioConfig(backup.studioConfig);
    }
    
    if (backup.opencodeConfig) {
        saveConfig(backup.opencodeConfig);
    }
    
    if (Array.isArray(backup.skills)) {
        const skillDir = getSkillDir();
        if (skillDir) {
            if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
            for (const skill of backup.skills) {
                const dir = path.join(skillDir, skill.name);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, 'SKILL.md'), skill.content, 'utf8');
            }
        }
    }
    
    if (Array.isArray(backup.plugins)) {
        const pluginDir = getPluginDir();
        if (pluginDir) {
            if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir, { recursive: true });
            for (const plugin of backup.plugins) {
                const dir = path.join(pluginDir, plugin.name);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(path.join(dir, 'index.js'), plugin.content, 'utf8');
            }
        }
    }
    
    res.json({ success: true });
});

function loadAuthConfig() {
    const configPath = getConfigPath();
    if (!configPath) return null;
    
    const authPath = path.join(path.dirname(configPath), 'auth.json');
    if (!fs.existsSync(authPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(authPath, 'utf8'));
    } catch {
        return null;
    }
}

app.get('/api/auth', (req, res) => {
    const authConfig = loadAuthConfig();
    res.json(authConfig || {});
});

app.post('/api/auth/login', (req, res) => {
    const { provider } = req.body;
    const cmd = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
    
    const child = spawn(cmd, ['auth', 'login', provider], {
        stdio: 'inherit',
        shell: true
    });
    
    res.json({ success: true, message: 'Launched auth flow', note: 'Please check the terminal window where the server is running' });
});

app.delete('/api/auth/:provider', (req, res) => {
    const { provider } = req.params;
    const cmd = process.platform === 'win32' ? 'opencode.cmd' : 'opencode';
    
    spawn(cmd, ['auth', 'logout', provider], {
        stdio: 'inherit',
        shell: true
    });
    
    res.json({ success: true });
});

app.get('/api/auth/providers', (req, res) => {
    const providers = [
        { id: 'google', name: 'Google AI', type: 'oauth', description: 'Use Google Gemini models' },
        { id: 'anthropic', name: 'Anthropic', type: 'api', description: 'Use Claude models' },
        { id: 'openai', name: 'OpenAI', type: 'api', description: 'Use GPT models' },
        { id: 'xai', name: 'xAI', type: 'api', description: 'Use Grok models' },
        { id: 'groq', name: 'Groq', type: 'api', description: 'Fast inference' },
        { id: 'together', name: 'Together AI', type: 'api', description: 'Open source models' },
        { id: 'mistral', name: 'Mistral', type: 'api', description: 'Mistral models' },
        { id: 'deepseek', name: 'DeepSeek', type: 'api', description: 'DeepSeek models' },
        { id: 'openrouter', name: 'OpenRouter', type: 'api', description: 'Multiple providers' },
        { id: 'amazon-bedrock', name: 'Amazon Bedrock', type: 'api', description: 'AWS models' },
        { id: 'azure', name: 'Azure OpenAI', type: 'api', description: 'Azure GPT models' },
    ];
    res.json(providers);
});

const AUTH_PROFILES_DIR = path.join(HOME_DIR, '.config', 'opencode-studio', 'auth-profiles');

function ensureAuthProfilesDir() {
    if (!fs.existsSync(AUTH_PROFILES_DIR)) {
        fs.mkdirSync(AUTH_PROFILES_DIR, { recursive: true });
    }
}

function getProviderProfilesDir(provider) {
    return path.join(AUTH_PROFILES_DIR, provider);
}

function listAuthProfiles(provider) {
    const dir = getProviderProfilesDir(provider);
    if (!fs.existsSync(dir)) return [];
    
    try {
        return fs.readdirSync(dir)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''));
    } catch {
        return [];
    }
}

function getNextProfileName(provider) {
    const existing = listAuthProfiles(provider);
    let num = 1;
    while (existing.includes(`account-${num}`)) {
        num++;
    }
    return `account-${num}`;
}

function saveAuthProfile(provider, profileName, data) {
    ensureAuthProfilesDir();
    const dir = getProviderProfilesDir(provider);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const filePath = path.join(dir, `${profileName}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
}

function loadAuthProfile(provider, profileName) {
    const filePath = path.join(getProviderProfilesDir(provider), `${profileName}.json`);
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function deleteAuthProfile(provider, profileName) {
    const filePath = path.join(getProviderProfilesDir(provider), `${profileName}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
    }
    return false;
}

function getActiveProfiles() {
    const studioConfig = loadStudioConfig();
    return studioConfig.activeProfiles || {};
}

function setActiveProfile(provider, profileName) {
    const studioConfig = loadStudioConfig();
    studioConfig.activeProfiles = studioConfig.activeProfiles || {};
    studioConfig.activeProfiles[provider] = profileName;
    saveStudioConfig(studioConfig);
}

function verifyActiveProfile(p, n, c) { console.log("Verifying:", p, n); if (!n || !c) return false; const d = loadAuthProfile(p, n); if (d && c) { console.log("Profile refresh:", d.refresh); console.log("Current refresh:", c.refresh); } if (!d) return false; return JSON.stringify(d) === JSON.stringify(c); }

app.get('/api/auth/profiles', (req, res) => {
    ensureAuthProfilesDir();
    const activeProfiles = getActiveProfiles();
    const authConfig = loadAuthConfig() || {};
    
    const profiles = {};
    const providers = [
        'google', 'anthropic', 'openai', 'xai', 'groq', 
        'together', 'mistral', 'deepseek', 'openrouter', 
        'amazon-bedrock', 'azure'
    ];

    providers.forEach(p => {
        const saved = listAuthProfiles(p);
        const active = activeProfiles[p];
        const current = authConfig[p];

        if (saved.length > 0 || current) {
            profiles[p] = {
                active: active,
                saved: saved,
                hasCurrent: !!current
            };
        }
    });
    
    res.json(profiles);
});

app.get('/api/debug/paths', (req, res) => {
    const home = os.homedir();
    const candidatePaths = [
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'opencode', 'storage', 'message') : null,
        path.join(home, '.local', 'share', 'opencode', 'storage', 'message'),
        path.join(home, '.opencode', 'storage', 'message')
    ].filter(p => p);

    const results = candidatePaths.map(p => ({
        path: p,
        exists: fs.existsSync(p),
        isDirectory: fs.existsSync(p) && fs.statSync(p).isDirectory(),
        fileCount: (fs.existsSync(p) && fs.statSync(p).isDirectory()) ? fs.readdirSync(p).length : 0
    }));

    res.json({
        home,
        platform: process.platform,
        candidates: results
    });
});

app.get('/api/usage', async (req, res) => {
    try {
        const { projectId: filterProjectId, granularity = 'daily', range = '30d' } = req.query;
        const home = os.homedir();
        const candidatePaths = [
            process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'opencode', 'storage', 'message') : null,
            path.join(home, '.local', 'share', 'opencode', 'storage', 'message'),
            path.join(home, '.opencode', 'storage', 'message')
        ].filter(p => p && fs.existsSync(p));

        const getSessionDir = (messageDir) => {
            return path.join(path.dirname(messageDir), 'session');
        };

        const sessionProjectMap = new Map();

        const loadProjects = (messageDir) => {
            const sessionDir = getSessionDir(messageDir);
            if (!fs.existsSync(sessionDir)) return;

            try {
                const projectDirs = fs.readdirSync(sessionDir);
                
                for (const projDir of projectDirs) {
                    const fullProjPath = path.join(sessionDir, projDir);
                    if (!fs.statSync(fullProjPath).isDirectory()) continue;

                    const files = fs.readdirSync(fullProjPath);
                    for (const file of files) {
                        if (file.startsWith('ses_') && file.endsWith('.json')) {
                            const sessionId = file.replace('.json', '');
                            try {
                                const meta = JSON.parse(fs.readFileSync(path.join(fullProjPath, file), 'utf8'));
                                let projectName = 'Unknown Project';
                                if (meta.directory) {
                                    projectName = path.basename(meta.directory);
                                } else if (meta.projectID) {
                                    projectName = meta.projectID.substring(0, 8);
                                }
                                sessionProjectMap.set(sessionId, { name: projectName, id: meta.projectID || projDir });
                            } catch (e) {}
                        }
                    }
                }
            } catch (e) {
                console.error('Error loading projects:', e);
            }
        };

        for (const logDir of candidatePaths) {
            loadProjects(logDir);
        }

        const stats = {
            totalCost: 0,
            totalTokens: 0,
            byModel: {},
            byTime: {}, 
            byProject: {} 
        };

        const processedFiles = new Set();
        const now = Date.now();
        let minTimestamp = 0;
        
        if (range === '24h') minTimestamp = now - 24 * 60 * 60 * 1000;
        else if (range === '7d') minTimestamp = now - 7 * 24 * 60 * 60 * 1000;
        else if (range === '30d') minTimestamp = now - 30 * 24 * 60 * 60 * 1000;

        const processMessage = (filePath, sessionId) => {
            if (processedFiles.has(filePath)) return;
            processedFiles.add(filePath);

            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const msg = JSON.parse(content);
                
                const model = msg.modelID || (msg.model && (msg.model.modelID || msg.model.id)) || 'unknown';
                const projectInfo = sessionProjectMap.get(sessionId) || { name: 'Unassigned', id: 'unknown' };
                const projectId = projectInfo.id || 'unknown';

                if (filterProjectId && filterProjectId !== 'all' && projectId !== filterProjectId) {
                    return;
                }

                if (minTimestamp > 0 && msg.time.created < minTimestamp) {
                    return;
                }
                
                if (msg.role === 'assistant' && msg.tokens) {
                    const cost = msg.cost || 0;
                    const inputTokens = msg.tokens.input || 0;
                    const outputTokens = msg.tokens.output || 0;
                    const tokens = inputTokens + outputTokens;
                    
                    const timestamp = msg.time.created;
                    const dateObj = new Date(timestamp);
                    let timeKey;
                    
                    if (granularity === 'hourly') {
                        timeKey = dateObj.toISOString().substring(0, 13) + ':00:00Z';
                    } else if (granularity === 'weekly') {
                        const day = dateObj.getDay();
                        const diff = dateObj.getDate() - day + (day === 0 ? -6 : 1);
                        const monday = new Date(dateObj.setDate(diff));
                        timeKey = monday.toISOString().split('T')[0];
                    } else if (granularity === 'monthly') {
                        timeKey = dateObj.toISOString().substring(0, 7) + '-01';
                    } else {
                        timeKey = dateObj.toISOString().split('T')[0];
                    }

                    if (tokens > 0) {
                        stats.totalCost += cost;
                        stats.totalTokens += tokens;

                        if (!stats.byModel[model]) {
                            stats.byModel[model] = { name: model, cost: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
                        }
                        stats.byModel[model].cost += cost;
                        stats.byModel[model].tokens += tokens;
                        stats.byModel[model].inputTokens += inputTokens;
                        stats.byModel[model].outputTokens += outputTokens;

                        if (!stats.byTime[timeKey]) {
                            stats.byTime[timeKey] = { date: timeKey, cost: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
                        }
                        stats.byTime[timeKey].cost += cost;
                        stats.byTime[timeKey].tokens += tokens;
                        stats.byTime[timeKey].inputTokens += inputTokens;
                        stats.byTime[timeKey].outputTokens += outputTokens;

                        const projectName = projectInfo.name;
                        if (!stats.byProject[projectId]) {
                            stats.byProject[projectId] = { id: projectId, name: projectName, cost: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
                        }
                        stats.byProject[projectId].cost += cost;
                        stats.byProject[projectId].tokens += tokens;
                        stats.byProject[projectId].inputTokens += inputTokens;
                        stats.byProject[projectId].outputTokens += outputTokens;
                    }
                }
            } catch (err) {
            }
        };

        for (const logDir of candidatePaths) {
            try {
                const sessions = fs.readdirSync(logDir);
                for (const session of sessions) {
                    if (!session.startsWith('ses_')) continue;
                    
                    const sessionDir = path.join(logDir, session);
                    if (fs.statSync(sessionDir).isDirectory()) {
                        const messages = fs.readdirSync(sessionDir);
                        for (const msgFile of messages) {
                            if (msgFile.endsWith('.json')) {
                                processMessage(path.join(sessionDir, msgFile), session);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error(`Error reading log dir ${logDir}:`, err);
            }
        }

        const response = {
            totalCost: stats.totalCost,
            totalTokens: stats.totalTokens,
            byModel: Object.values(stats.byModel).sort((a, b) => b.cost - a.cost),
            byDay: Object.values(stats.byTime).sort((a, b) => a.date.localeCompare(b.date)),
            byProject: Object.values(stats.byProject).sort((a, b) => b.cost - a.cost)
        };

        res.json(response);
    } catch (error) {
        console.error('Error fetching usage stats:', error);
        res.status(500).json({ error: 'Failed to fetch usage stats' });
    }
});

app.get('/api/auth/profiles/:provider', (req, res) => {
    const { provider } = req.params;
    const providerProfiles = listAuthProfiles(provider);
    const activeProfiles = getActiveProfiles();
    const authConfig = loadAuthConfig() || {};
    
    res.json({
        profiles: providerProfiles,
        active: (activeProfiles[provider] && verifyActiveProfile(provider, activeProfiles[provider], authConfig[provider])) ? activeProfiles[provider] : null,
        hasCurrentAuth: !!authConfig[provider],
    });
});

app.post('/api/auth/profiles/:provider', (req, res) => {
    const { provider } = req.params;
    const { name } = req.body;
    
    const authConfig = loadAuthConfig();
    if (!authConfig || !authConfig[provider]) {
        return res.status(400).json({ error: `No active auth for ${provider} to save` });
    }
    
    const profileName = name || getNextProfileName(provider);
    const data = authConfig[provider];
    
    try {
        saveAuthProfile(provider, profileName, data);
        setActiveProfile(provider, profileName);
        res.json({ success: true, name: profileName });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save profile', details: err.message });
    }
});

app.post('/api/auth/profiles/:provider/:name/activate', (req, res) => {
    const { provider, name } = req.params;
    
    const profileData = loadAuthProfile(provider, name);
    if (!profileData) {
        return res.status(404).json({ error: 'Profile not found' });
    }
    
    const authConfig = loadAuthConfig() || {};
    authConfig[provider] = profileData;
    
    const configPath = getConfigPath();
    if (configPath) {
        const authPath = path.join(path.dirname(configPath), 'auth.json');
        try {
            fs.writeFileSync(authPath, JSON.stringify(authConfig, null, 2), 'utf8');
            setActiveProfile(provider, name);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Failed to write auth config', details: err.message });
        }
    } else {
        res.status(500).json({ error: 'Config path not found' });
    }
});

app.delete('/api/auth/profiles/:provider/:name', (req, res) => {
    const { provider, name } = req.params;
    const success = deleteAuthProfile(provider, name);
    if (success) {
        const activeProfiles = getActiveProfiles();
        if (activeProfiles[provider] === name) {
            const studioConfig = loadStudioConfig();
            if (studioConfig.activeProfiles) {
                delete studioConfig.activeProfiles[provider];
                saveStudioConfig(studioConfig);
            }
        }
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Profile not found' });
    }
});

app.put('/api/auth/profiles/:provider/:name', (req, res) => {
    const { provider, name } = req.params;
    const { newName } = req.body;
    
    if (!newName) return res.status(400).json({ error: 'New name required' });
    
    const profileData = loadAuthProfile(provider, name);
    if (!profileData) return res.status(404).json({ error: 'Profile not found' });
    
    const success = saveAuthProfile(provider, newName, profileData);
    if (success) {
        deleteAuthProfile(provider, name);
        
        const activeProfiles = getActiveProfiles();
        if (activeProfiles[provider] === name) {
            setActiveProfile(provider, newName);
        }
        
        res.json({ success: true, name: newName });
    } else {
        res.status(500).json({ error: 'Failed to rename profile' });
    }
});

app.post('/api/plugins/config/add', (req, res) => {
    const { plugins } = req.body;
    if (!Array.isArray(plugins) || plugins.length === 0) {
        return res.status(400).json({ error: 'Plugins array required' });
    }

    const config = loadConfig();
    if (!config) return res.status(404).json({ error: 'Config not found' });

    if (!config.plugins) config.plugins = {};

    const result = {
        added: [],
        skipped: []
    };

    for (const pluginName of plugins) {
        const pluginDir = getPluginDir();
        const dirPath = path.join(pluginDir, pluginName);
        const hasJs = fs.existsSync(path.join(dirPath, 'index.js'));
        const hasTs = fs.existsSync(path.join(dirPath, 'index.ts'));

        if (!hasJs && !hasTs) {
            result.skipped.push(`${pluginName} (not found)`);
            continue;
        }

        if (config.plugins[pluginName]) {
            result.skipped.push(`${pluginName} (already configured)`);
        } else {
            config.plugins[pluginName] = { enabled: true };
            result.added.push(pluginName);
        }
    }

    if (result.added.length > 0) {
        saveConfig(config);
    }

    res.json(result);
});

app.delete('/api/plugins/config/:name', (req, res) => {
    const pluginName = decodeURIComponent(req.params.name);
    const config = loadConfig();
    
    if (!config || !config.plugins) {
        return res.status(404).json({ error: 'Config not found or no plugins' });
    }

    if (config.plugins[pluginName]) {
        delete config.plugins[pluginName];
        saveConfig(config);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Plugin not in config' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
