const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

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
        const dir = path.dirname(STUDIO_CONFIG_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(STUDIO_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
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
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
        return null;
    }
};

const saveConfig = (config) => {
    const configPath = getConfigPath();
    if (!configPath) throw new Error('No config path found');
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
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
    const sd = getSkillDir();
    const p = sd ? path.join(sd, req.params.name, 'SKILL.md') : null;
    if (!p || !fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
    res.json({ name: req.params.name, content: fs.readFileSync(p, 'utf8') });
});

app.post('/api/skills/:name', (req, res) => {
    const sd = getSkillDir();
    if (!sd) return res.status(404).json({ error: 'No config' });
    const dp = path.join(sd, req.params.name);
    if (!fs.existsSync(dp)) fs.mkdirSync(dp, { recursive: true });
    fs.writeFileSync(path.join(dp, 'SKILL.md'), req.body.content, 'utf8');
    res.json({ success: true });
});

app.delete('/api/skills/:name', (req, res) => {
    const sd = getSkillDir();
    const dp = sd ? path.join(sd, req.params.name) : null;
    if (dp && fs.existsSync(dp)) fs.rmSync(dp, { recursive: true, force: true });
    res.json({ success: true });
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
    fs.writeFileSync(profilePath, JSON.stringify(auth[provider], null, 2), 'utf8');
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
    fs.writeFileSync(ap, JSON.stringify(authCfg, null, 2), 'utf8');
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
    if (typeof provider !== 'string') provider = "";
    
    let cmd = 'opencode auth login';
    if (provider) cmd += ` ${provider}`;
    
    const platform = process.platform;
    let terminalCmd;
    if (platform === 'win32') {
        terminalCmd = `start "" cmd /c "call ${cmd} || pause"`;
    } else if (platform === 'darwin') {
        terminalCmd = `osascript -e 'tell application "Terminal" to do script "${cmd}"'`;
    } else {
        terminalCmd = `x-terminal-emulator -e "${cmd}"`;
    }
    
    console.log('Executing terminal command:', terminalCmd);
    
    exec(terminalCmd, (err) => {
        if (err) {
            console.error('Failed to open terminal:', err);
            return res.status(500).json({ error: 'Failed to open terminal', details: err.message });
        }
        res.json({ success: true, message: 'Terminal opened', note: 'Complete login in the terminal window' });
    });
});

app.delete('/api/auth/:provider', (req, res) => {
    const { provider } = req.params;
    const authCfg = loadAuthConfig() || {};
    delete authCfg[provider];
    const cp = getConfigPath();
    const ap = path.join(path.dirname(cp), 'auth.json');
    fs.writeFileSync(ap, JSON.stringify(authCfg, null, 2), 'utf8');
    
    const studio = loadStudioConfig();
    if (studio.activeProfiles) delete studio.activeProfiles[provider];
    saveStudioConfig(studio);
    
    res.json({ success: true });
});

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
            fs.readdirSync(sd).forEach(d => {
                const fp = path.join(sd, d);
                if (fs.statSync(fp).isDirectory()) {
                    fs.readdirSync(fp).forEach(f => {
                        if (f.startsWith('ses_') && f.endsWith('.json')) {
                            try {
                                const m = JSON.parse(fs.readFileSync(path.join(fp, f), 'utf8'));
                                pmap.set(f.replace('.json', ''), { name: m.directory ? path.basename(m.directory) : (m.projectID ? m.projectID.substring(0, 8) : 'Unknown'), id: m.projectID || d });
                            } catch {}
                        }
                    });
                }
            });
        }

        const stats = { totalCost: 0, totalTokens: 0, byModel: {}, byTime: {}, byProject: {} };
        const seen = new Set();
        const now = Date.now();
        let min = 0;
        if (range === '24h') min = now - 86400000;
        else if (range === '7d') min = now - 604800000;
        else if (range === '30d') min = now - 2592000000;
        else if (range === '1y') min = now - 31536000000;

        fs.readdirSync(md).forEach(s => {
            if (!s.startsWith('ses_')) return;
            const sp = path.join(md, s);
            if (fs.statSync(sp).isDirectory()) {
                fs.readdirSync(sp).forEach(f => {
                    if (!f.endsWith('.json') || seen.has(path.join(sp, f))) return;
                    seen.add(path.join(sp, f));
                    try {
                        const msg = JSON.parse(fs.readFileSync(path.join(sp, f), 'utf8'));
                        const pid = pmap.get(s)?.id || 'unknown';
                        if (fid && fid !== 'all' && pid !== fid) return;
                        if (min > 0 && msg.time.created < min) return;
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
                            [stats.byModel, stats.byTime, stats.byProject].forEach((obj, i) => {
                                const key = i === 0 ? mid : (i === 1 ? tk : pid);
                                if (!obj[key]) obj[key] = { name: key, id: key, cost: 0, tokens: 0, inputTokens: 0, outputTokens: 0 };
                                if (i === 2) obj[key].name = pmap.get(s)?.name || 'Unassigned';
                                obj[key].cost += c; obj[key].tokens += t; obj[key].inputTokens += it; obj[key].outputTokens += ot;
                            });
                        }
                    } catch {}
                });
            }
        });

        res.json({
            totalCost: stats.totalCost,
            totalTokens: stats.totalTokens,
            byModel: Object.values(stats.byModel).sort((a, b) => b.cost - a.cost),
            byDay: Object.values(stats.byTime).sort((a, b) => a.name.localeCompare(b.name)).map(v => ({ ...v, date: v.name })),
            byProject: Object.values(stats.byProject).sort((a, b) => b.cost - a.cost)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed' });
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
            if (opencode.provider?.google) {
                const models = studio.pluginModels[plugin];
                if (models) {
                    opencode.provider.google.models = models;
                }
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
                fs.writeFileSync(ap, JSON.stringify(authCfg, null, 2), 'utf8');
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

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));