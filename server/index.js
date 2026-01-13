const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, exec } = require('child_process');

// Atomic file write: write to temp file then rename to prevent corruption
const atomicWriteFileSync = (filePath, data, options = 'utf8') => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tempPath = path.join(dir, `.${path.basename(filePath)}.${crypto.randomBytes(6).toString('hex')}.tmp`);
    try {
        fs.writeFileSync(tempPath, data, options);
        fs.renameSync(tempPath, filePath);
    } catch (err) {
        // Clean up temp file if rename fails
        try { fs.unlinkSync(tempPath); } catch {}
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

let pendingActionMemory = null;

function loadStudioConfig() {
    const defaultConfig = {
        disabledSkills: [],
        disabledPlugins: [],
        activeProfiles: {},
        activeGooglePlugin: 'gemini',
        availableGooglePlugins: [],
        presets: [],
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
        return { ...defaultConfig, ...config };
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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/shutdown', (req, res) => {
    res.json({ success: true });
    setTimeout(() => process.exit(0), 100);
});

app.get('/api/paths', (req, res) => res.json(getPaths()));

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

const getSkillDir = () => {
    const cp = getConfigPath();
    return cp ? path.join(path.dirname(cp), 'skill') : null;
};

app.get('/api/skills', (req, res) => {
    const sd = getSkillDir();
    if (!sd || !fs.existsSync(sd)) return res.json([]);
    const skills = fs.readdirSync(sd, { withFileTypes: true })
        .filter(e => e.isDirectory() && fs.existsSync(path.join(sd, e.name, 'SKILL.md')))
        .map(e => ({ name: e.name, path: path.join(sd, e.name, 'SKILL.md'), enabled: !e.name.endsWith('.disabled') }));
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
    const plugins = [];
    const add = (name, p, enabled = true) => {
        if (!plugins.some(pl => pl.name === name)) plugins.push({ name, path: p, enabled });
    };

    if (pd && fs.existsSync(pd)) {
        fs.readdirSync(pd, { withFileTypes: true }).forEach(e => {
            const fp = path.join(pd, e.name);
            const st = fs.lstatSync(fp);
            if (st.isDirectory()) {
                const j = path.join(fp, 'index.js'), t = path.join(fp, 'index.ts');
                if (fs.existsSync(j) || fs.existsSync(t)) add(e.name, fs.existsSync(j) ? j : t);
            } else if ((st.isFile() || st.isSymbolicLink()) && /\.(js|ts)$/.test(e.name)) {
                add(e.name.replace(/\.(js|ts)$/, ''), fp);
            }
        });
    }

    if (cr && fs.existsSync(cr)) {
        ['oh-my-opencode', 'superpowers', 'opencode-gemini-auth'].forEach(n => {
            const fp = path.join(cr, n);
            if (fs.existsSync(fp) && fs.statSync(fp).isDirectory()) add(n, fp);
        });
    }

    const cfg = loadConfig();
    if (cfg && Array.isArray(cfg.plugin)) {
        cfg.plugin.forEach(n => {
            if (!n.includes('/') && !n.includes('\\') && !/\.(js|ts)$/.test(n)) add(n, 'npm');
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
const listAuthProfiles = (p, activePlugin) => {
    let ns = p;
    if (p === 'google') {
        ns = activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini';
    }
    
    const d = path.join(AUTH_PROFILES_DIR, ns);
    if (!fs.existsSync(d)) return [];
    try { return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')); } catch { return []; }
};

app.get('/api/auth/providers', (req, res) => {
    const providers = [
        { id: 'google', name: 'Google', type: 'oauth', description: 'Google Gemini API' },
        { id: 'anthropic', name: 'Anthropic', type: 'api', description: 'Claude models' },
        { id: 'openai', name: 'OpenAI', type: 'api', description: 'GPT models' },
        { id: 'xai', name: 'xAI', type: 'api', description: 'Grok models' },
        { id: 'openrouter', name: 'OpenRouter', type: 'api', description: 'Unified LLM API' },
        { id: 'github-copilot', name: 'GitHub Copilot', type: 'api', description: 'Copilot models' }
    ];
    res.json(providers);
});

app.get('/api/auth', (req, res) => {
    const authCfg = loadAuthConfig() || {};
    const studio = loadStudioConfig();
    const ac = studio.activeProfiles || {};
    const credentials = [];
    const activePlugin = studio.activeGooglePlugin;
    
    // DEBUG LOGGING
    console.log('--- Auth Debug ---');
    console.log('Active Google Plugin:', activePlugin);
    console.log('Found keys in authCfg:', Object.keys(authCfg));
    if (authCfg.google) console.log('Google Auth found!');
    if (authCfg['google.antigravity']) console.log('google.antigravity found!');
    if (authCfg['google.gemini']) console.log('google.gemini found!');
    
    const providers = [
        { id: 'google', name: 'Google', type: 'oauth' },
        { id: 'anthropic', name: 'Anthropic', type: 'api' },
        { id: 'openai', name: 'OpenAI', type: 'api' },
        { id: 'xai', name: 'xAI', type: 'api' },
        { id: 'openrouter', name: 'OpenRouter', type: 'api' },
        { id: 'github-copilot', name: 'GitHub Copilot', type: 'api' }
    ];

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
            const key = activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini';
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
    const authCfg = loadAuthConfig() || {};
    const studio = loadStudioConfig();
    const ac = studio.activeProfiles || {};
    const activePlugin = studio.activeGooglePlugin;
    const profiles = {};
    const providers = ['google', 'anthropic', 'openai', 'xai', 'openrouter', 'together', 'mistral', 'deepseek', 'amazon-bedrock', 'azure', 'github-copilot'];
    
    providers.forEach(p => {
        const saved = listAuthProfiles(p, activePlugin);
        // Correct current auth check: handle google vs google.gemini/antigravity
        let curr = !!authCfg[p];
        if (p === 'google') {
            const key = activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini';
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
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
        : provider;
    
    const auth = loadAuthConfig() || {};
    const dir = path.join(AUTH_PROFILES_DIR, namespace);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    const profilePath = path.join(dir, `${name || Date.now()}.json`);
    atomicWriteFileSync(profilePath, JSON.stringify(auth[provider], null, 2));
    res.json({ success: true, name: path.basename(profilePath, '.json') });
});

app.post('/api/auth/profiles/:provider/:name/activate', (req, res) => {
    const { provider, name } = req.params;
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google' 
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
        : provider;
    
    const profilePath = path.join(AUTH_PROFILES_DIR, namespace, `${name}.json`);
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
        const key = activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini';
        authCfg[key] = profileData;
    }
    
    const cp = getConfigPath();
    const ap = path.join(path.dirname(cp), 'auth.json');
    atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));
    res.json({ success: true });
});

app.delete('/api/auth/profiles/:provider/:name', (req, res) => {
    const { provider, name } = req.params;
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google' 
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
        : provider;
    
    const profilePath = path.join(AUTH_PROFILES_DIR, namespace, `${name}.json`);
    if (fs.existsSync(profilePath)) fs.unlinkSync(profilePath);
    res.json({ success: true });
});

app.put('/api/auth/profiles/:provider/:name', (req, res) => {
    const { provider, name } = req.params;
    const { newName } = req.body;
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google' 
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
        : provider;
    
    const oldPath = path.join(AUTH_PROFILES_DIR, namespace, `${name}.json`);
    const newPath = path.join(AUTH_PROFILES_DIR, namespace, `${newName}.json`);
    if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);

    // Update active profile name if it was the one renamed
    const studio = loadStudioConfig();
    if (studio.activeProfiles && studio.activeProfiles[provider] === name) {
        studio.activeProfiles[provider] = newName;
        saveStudioConfig(studio);
    }

    res.json({ success: true, name: newName });
});

app.post('/api/auth/login', (req, res) => {
    let { provider } = req.body;
    
    // Security: Validate provider against allowlist to prevent command injection
    const ALLOWED_PROVIDERS = [
        "", "google", "anthropic", "openai", "xai", 
        "openrouter", "github-copilot", "gemini",
        "together", "mistral", "deepseek", "amazon-bedrock", "azure"
    ];

    if (provider && !ALLOWED_PROVIDERS.includes(provider)) {
        return res.status(400).json({ error: 'Invalid provider' });
    }

    if (typeof provider !== 'string') provider = "";
    
    let cmd = 'opencode auth login';
    if (provider) cmd += ` ${provider}`;
    
    const platform = process.platform;
    
    if (platform === 'win32') {
        const terminalCmd = `start "" cmd /c "call ${cmd} || pause"`;
        console.log('Executing terminal command:', terminalCmd);
        exec(terminalCmd, (err) => {
            if (err) {
                console.error('Failed to open terminal:', err);
                return res.status(500).json({ error: 'Failed to open terminal', details: err.message });
            }
            res.json({ success: true, message: 'Terminal opened', note: 'Complete login in the terminal window' });
        });
    } else if (platform === 'darwin') {
        const terminalCmd = `osascript -e 'tell application "Terminal" to do script "${cmd}"'`;
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
            { name: 'x-terminal-emulator', cmd: `x-terminal-emulator -e "${cmd}"` },
            { name: 'gnome-terminal', cmd: `gnome-terminal -- bash -c "${cmd}; read -p 'Press Enter to close...'"` },
            { name: 'konsole', cmd: `konsole -e bash -c "${cmd}; read -p 'Press Enter to close...'"` },
            { name: 'xfce4-terminal', cmd: `xfce4-terminal -e "bash -c \\"${cmd}; read -p 'Press Enter to close...'\\"" ` },
            { name: 'xterm', cmd: `xterm -e "bash -c '${cmd}; read -p Press_Enter_to_close...'"` }
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
    delete authCfg[provider];
    const cp = getConfigPath();
    const ap = path.join(path.dirname(cp), 'auth.json');
    atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));
    
    const studio = loadStudioConfig();
    if (studio.activeProfiles) delete studio.activeProfiles[provider];
    saveStudioConfig(studio);
    
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

function getAccountStatus(meta, now) {
    if (!meta) return 'ready';
    if (meta.cooldownUntil && meta.cooldownUntil > now) return 'cooldown';
    if (meta.expired) return 'expired';
    return 'ready';
}

function buildAccountPool(provider) {
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
        : provider;
    
    const profileDir = path.join(AUTH_PROFILES_DIR, namespace);
    const profiles = [];
    const now = Date.now();
    const metadata = loadPoolMetadata();
    const providerMeta = metadata[namespace] || {};
    
    // Get current active profile from studio config
    const studio = loadStudioConfig();
    const activeProfile = studio.activeProfiles?.[provider] || null;
    
    if (fs.existsSync(profileDir)) {
        const files = fs.readdirSync(profileDir).filter(f => f.endsWith('.json'));
        files.forEach(file => {
            const name = file.replace('.json', '');
            const meta = providerMeta[name] || {};
            const status = name === activeProfile ? 'active' : getAccountStatus(meta, now);
            
            profiles.push({
                name,
                email: meta.email || null,
                status,
                lastUsed: meta.lastUsed || 0,
                usageCount: meta.usageCount || 0,
                cooldownUntil: meta.cooldownUntil || null,
                createdAt: meta.createdAt || 0
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

// GET /api/auth/pool - Get account pool for Google (or specified provider)
app.get('/api/auth/pool', (req, res) => {
    const provider = req.query.provider || 'google';
    const pool = buildAccountPool(provider);
    
    // Also include quota estimate (local tracking)
    const metadata = loadPoolMetadata();
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
        : provider;
    
    const quotaMeta = metadata._quota?.[namespace] || {};
    const today = new Date().toISOString().split('T')[0];
    const todayUsage = quotaMeta[today] || 0;
    
    // Estimate: 1000 requests/day limit (configurable)
    const dailyLimit = quotaMeta.dailyLimit || 1000;
    const remaining = Math.max(0, dailyLimit - todayUsage);
    const percentage = Math.round((remaining / dailyLimit) * 100);
    
    const quota = {
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
    
    res.json({ pool, quota });
});

// POST /api/auth/pool/rotate - Rotate to next available account
app.post('/api/auth/pool/rotate', (req, res) => {
    const provider = req.body.provider || 'google';
    const pool = buildAccountPool(provider);
    
    if (pool.accounts.length === 0) {
        return res.status(400).json({ error: 'No accounts in pool' });
    }
    
    const now = Date.now();
    const available = pool.accounts.filter(acc => 
        acc.status === 'ready' || (acc.status === 'cooldown' && acc.cooldownUntil && acc.cooldownUntil < now)
    );
    
    if (available.length === 0) {
        return res.status(400).json({ error: 'No available accounts (all in cooldown or expired)' });
    }
    
    // Pick least recently used
    const next = available.sort((a, b) => a.lastUsed - b.lastUsed)[0];
    const previousActive = pool.activeAccount;
    
    // Activate the new account
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
        : provider;
    
    const profilePath = path.join(AUTH_PROFILES_DIR, namespace, `${next.name}.json`);
    if (!fs.existsSync(profilePath)) {
        return res.status(404).json({ error: 'Profile file not found' });
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
        lastUsed: now
    };
    savePoolMetadata(metadata);
    
    res.json({
        success: true,
        previousAccount: previousActive,
        newAccount: next.name,
        reason: 'manual_rotation'
    });
});

// PUT /api/auth/pool/:name/cooldown - Mark account as in cooldown
app.put('/api/auth/pool/:name/cooldown', (req, res) => {
    const { name } = req.params;
    const { duration = 3600000, provider = 'google' } = req.body; // default 1 hour
    
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
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
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
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
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
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
    const { provider = 'google', email, createdAt } = req.body;
    
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
        : provider;
    
    const metadata = loadPoolMetadata();
    if (!metadata[namespace]) metadata[namespace] = {};
    if (!metadata[namespace][name]) metadata[namespace][name] = {};
    
    if (email !== undefined) metadata[namespace][name].email = email;
    if (createdAt !== undefined) metadata[namespace][name].createdAt = createdAt;
    
    savePoolMetadata(metadata);
    res.json({ success: true });
});

// GET /api/auth/pool/quota - Get quota info
app.get('/api/auth/pool/quota', (req, res) => {
    const provider = req.query.provider || 'google';
    const activePlugin = getActiveGooglePlugin();
    const namespace = provider === 'google'
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
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
        ? (activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini')
        : provider;
    
    const metadata = loadPoolMetadata();
    if (!metadata._quota) metadata._quota = {};
    if (!metadata._quota[namespace]) metadata._quota[namespace] = {};
    metadata._quota[namespace].dailyLimit = limit;
    
    savePoolMetadata(metadata);
    res.json({ success: true, dailyLimit: limit });
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
        let min = 0;
        if (range === '24h') min = now - 86400000;
        else if (range === '7d') min = now - 604800000;
        else if (range === '30d') min = now - 2592000000;
        else if (range === '1y') min = now - 31536000000;

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
    
    const { verifier, challenge } = generatePKCE();
    const state = encodeOAuthState({ verifier });
    
    pendingOAuthState = { verifier, status: 'pending', startedAt: Date.now() };
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GEMINI_CLIENT_ID);
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
                    client_id: GEMINI_CLIENT_ID,
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
            
            const studio = loadStudioConfig();
            const activePlugin = studio.activeGooglePlugin || 'gemini';
            const namespace = activePlugin === 'antigravity' ? 'google.antigravity' : 'google.gemini';
            
            const credentials = {
                refresh_token: tokens.refresh_token,
                access_token: tokens.access_token,
                expiry: Date.now() + (tokens.expires_in * 1000),
                email
            };
            
            authCfg.google = credentials;
            authCfg[namespace] = credentials;
            
            atomicWriteFileSync(ap, JSON.stringify(authCfg, null, 2));
            
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
    const id = crypto.randomUUID();
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
    
    const targetSkills = new Set(preset.config.skills || []);
    const targetPlugins = new Set(preset.config.plugins || []);
    const targetMcps = new Set(preset.config.mcps || []);
    
    if (mode === 'exclusive') {
        // Skills
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
        
        // Plugins
        const allPlugins = [...(config.plugin || [])];
        if (fs.existsSync(pluginDir)) {
            const files = fs.readdirSync(pluginDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
            allPlugins.push(...files.map(f => f.replace(/\.[^/.]+$/, "")));
        }
        // Deduplicate
        const uniquePlugins = [...new Set(allPlugins)];
        studio.disabledPlugins = uniquePlugins.filter(p => !targetPlugins.has(p));
        
        // MCPs
        if (config.mcp) {
            for (const key in config.mcp) {
                config.mcp[key].enabled = targetMcps.has(key);
            }
        }
        
    } else { // additive
        studio.disabledSkills = (studio.disabledSkills || []).filter(s => !targetSkills.has(s));
        studio.disabledPlugins = (studio.disabledPlugins || []).filter(p => !targetPlugins.has(p));
        
        if (config.mcp) {
            for (const key of preset.config.mcps || []) {
                if (config.mcp[key]) config.mcp[key].enabled = true;
            }
        }
    }
    
    saveStudioConfig(studio);
    saveConfig(config);
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));