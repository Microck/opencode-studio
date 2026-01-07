const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

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
    if (!fs.existsSync(STUDIO_CONFIG_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(STUDIO_CONFIG_PATH, 'utf8'));
    } catch {
        return {};
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

function loadAuthConfig() {
    const cp = getConfigPath();
    if (!cp) return null;
    const ap = path.join(path.dirname(cp), 'auth.json');
    if (!fs.existsSync(ap)) return null;
    try { return JSON.parse(fs.readFileSync(ap, 'utf8')); } catch { return null; }
}

const AUTH_PROFILES_DIR = path.join(HOME_DIR, '.config', 'opencode-studio', 'auth-profiles');
const listAuthProfiles = (p) => {
    const d = path.join(AUTH_PROFILES_DIR, p);
    if (!fs.existsSync(d)) return [];
    try { return fs.readdirSync(d).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')); } catch { return []; }
};

app.get('/api/auth', (req, res) => {
    const cfg = loadAuthConfig() || {};
    const ac = loadStudioConfig().activeProfiles || {};
    const credentials = [];
    const providers = [
        { id: 'google', name: 'Google AI', type: 'oauth' },
        { id: 'anthropic', name: 'Anthropic', type: 'api' },
        { id: 'openai', name: 'OpenAI', type: 'api' },
        { id: 'xai', name: 'xAI', type: 'api' },
        { id: 'groq', name: 'Groq', type: 'api' },
        { id: 'github-copilot', name: 'GitHub Copilot', type: 'api' }
    ];

    providers.forEach(p => {
        const saved = listAuthProfiles(p.id);
        const curr = !!cfg[p.id];
        if (curr || saved.length > 0) {
            credentials.push({ ...p, active: ac[p.id] || (curr ? 'current' : null), profiles: saved, hasCurrentAuth: curr });
        }
    });
    res.json({ ...cfg, credentials });
});

app.get('/api/auth/profiles', (req, res) => {
    const cfg = loadAuthConfig() || {};
    const ac = loadStudioConfig().activeProfiles || {};
    const profiles = {};
    const providers = ['google', 'anthropic', 'openai', 'xai', 'groq', 'together', 'mistral', 'deepseek', 'openrouter', 'amazon-bedrock', 'azure', 'github-copilot'];
    
    providers.forEach(p => {
        const saved = listAuthProfiles(p);
        const curr = cfg[p];
        if (saved.length > 0 || curr) {
            profiles[p] = { active: ac[p], profiles: saved, saved, hasCurrent: !!curr, hasCurrentAuth: !!curr };
        }
    });
    res.json(profiles);
});

app.get('/api/usage', async (req, res) => {
    try {
        const { projectId: fid, granularity = 'daily', range = '30d' } = req.query;
        const cp = getConfigPath();
        if (!cp) return res.json({ totalCost: 0, totalTokens: 0, byModel: [], byDay: [], byProject: [] });
        
        const md = path.join(path.dirname(cp), 'storage', 'message');
        const sd = path.join(path.dirname(cp), 'storage', 'session');
        if (!fs.existsSync(md)) return res.json({ totalCost: 0, totalTokens: 0, byModel: [], byDay: [], byProject: [] });

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

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
