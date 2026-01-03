const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

const app = express();
const PORT = 3001;

const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    /\.vercel\.app$/,
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

function clearPendingAction() {
    pendingActionMemory = null;
    if (fs.existsSync(PENDING_ACTION_PATH)) {
        try { fs.unlinkSync(PENDING_ACTION_PATH); } catch {}
    }
}

function setPendingAction(action) {
    pendingActionMemory = { ...action, timestamp: Date.now() };
}

const AUTH_CANDIDATE_PATHS = [
    path.join(HOME_DIR, '.local', 'share', 'opencode', 'auth.json'),
    path.join(process.env.LOCALAPPDATA || '', 'opencode', 'auth.json'),
    path.join(process.env.APPDATA || '', 'opencode', 'auth.json'),
];

const CANDIDATE_PATHS = [
    path.join(HOME_DIR, '.config', 'opencode'),
    path.join(HOME_DIR, '.opencode'),
    path.join(process.env.APPDATA || '', 'opencode'),
    path.join(process.env.LOCALAPPDATA || '', 'opencode'),
    path.join(HOME_DIR, 'AppData', 'Roaming', 'opencode'),
    path.join(HOME_DIR, 'AppData', 'Local', 'opencode'),
];

function detectConfigDir() {
    for (const candidate of CANDIDATE_PATHS) {
        const configFile = path.join(candidate, 'opencode.json');
        if (fs.existsSync(configFile)) {
            return candidate;
        }
    }
    return null;
}

function loadStudioConfig() {
    if (fs.existsSync(STUDIO_CONFIG_PATH)) {
        try {
            return JSON.parse(fs.readFileSync(STUDIO_CONFIG_PATH, 'utf8'));
        } catch {
            return { disabledSkills: [], disabledPlugins: [] };
        }
    }
    return { disabledSkills: [], disabledPlugins: [] };
}

function saveStudioConfig(config) {
    const dir = path.dirname(STUDIO_CONFIG_PATH);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STUDIO_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function getConfigDir() {
    const studioConfig = loadStudioConfig();
    if (studioConfig.configPath && fs.existsSync(studioConfig.configPath)) {
        return studioConfig.configPath;
    }
    return detectConfigDir();
}

function getPaths() {
    const configDir = getConfigDir();
    if (!configDir) return null;
    return {
        configDir,
        opencodeJson: path.join(configDir, 'opencode.json'),
        skillDir: path.join(configDir, 'skill'),
        pluginDir: path.join(configDir, 'plugin'),
    };
}

function parseSkillFrontmatter(content) {
    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) {
        return { frontmatter: {}, body: content };
    }
    
    const frontmatterText = frontmatterMatch[1];
    const body = content.slice(frontmatterMatch[0].length).trim();
    const frontmatter = {};
    
    const lines = frontmatterText.split(/\r?\n/);
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            frontmatter[key] = value;
        }
    }
    
    return { frontmatter, body };
}

function createSkillContent(name, description, body) {
    return `---
name: ${name}
description: ${description}
---

${body}`;
}

console.log(`Detected config at: ${getConfigDir() || 'NOT FOUND'}`);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.get('/api/pending-action', (req, res) => {
    const action = loadPendingAction();
    res.json({ action });
});

app.delete('/api/pending-action', (req, res) => {
    clearPendingAction();
    res.json({ success: true });
});

app.post('/api/pending-action', (req, res) => {
    const { action } = req.body;
    if (action && action.type) {
        setPendingAction(action);
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid action' });
    }
});

app.get('/api/paths', (req, res) => {
    const detected = detectConfigDir();
    const studioConfig = loadStudioConfig();
    const current = getConfigDir();
    
    res.json({
        detected,
        manual: studioConfig.configPath || null,
        current,
        candidates: CANDIDATE_PATHS,
    });
});

app.post('/api/paths', (req, res) => {
    const { configPath } = req.body;
    
    if (configPath) {
        const configFile = path.join(configPath, 'opencode.json');
        if (!fs.existsSync(configFile)) {
            return res.status(400).json({ error: 'opencode.json not found at specified path' });
        }
    }
    
    const studioConfig = loadStudioConfig();
    studioConfig.configPath = configPath || null;
    saveStudioConfig(studioConfig);
    
    res.json({ success: true, current: getConfigDir() });
});

app.get('/api/config', (req, res) => {
    const paths = getPaths();
    if (!paths) {
        return res.status(404).json({ error: 'Opencode installation not found', notFound: true });
    }
    
    if (!fs.existsSync(paths.opencodeJson)) {
        return res.status(404).json({ error: 'Config file not found' });
    }
    
    try {
        const opencodeData = fs.readFileSync(paths.opencodeJson, 'utf8');
        let opencodeConfig = JSON.parse(opencodeData);
        let changed = false;

        // Migration: Move root providers to model.providers
        if (opencodeConfig.providers) {
            if (typeof opencodeConfig.model !== 'string') {
                const providers = opencodeConfig.providers;
                delete opencodeConfig.providers;

                opencodeConfig.model = {
                    ...(opencodeConfig.model || {}),
                    providers: providers
                };
                
                fs.writeFileSync(paths.opencodeJson, JSON.stringify(opencodeConfig, null, 2), 'utf8');
                changed = true;
            }
        }

        res.json(opencodeConfig);
    } catch (err) {
        res.status(500).json({ error: 'Failed to parse config', details: err.message });
    }
});

app.post('/api/config', (req, res) => {
    const paths = getPaths();
    if (!paths) {
        return res.status(404).json({ error: 'Opencode installation not found' });
    }
    
    try {
        fs.writeFileSync(paths.opencodeJson, JSON.stringify(req.body, null, 2), 'utf8');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to write config', details: err.message });
    }
});

app.get('/api/skills', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.json([]);
    if (!fs.existsSync(paths.skillDir)) return res.json([]);
    
    const studioConfig = loadStudioConfig();
    const disabledSkills = studioConfig.disabledSkills || [];
    const skills = [];
    
    const entries = fs.readdirSync(paths.skillDir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const skillFile = path.join(paths.skillDir, entry.name, 'SKILL.md');
            if (fs.existsSync(skillFile)) {
                try {
                    const content = fs.readFileSync(skillFile, 'utf8');
                    const { frontmatter } = parseSkillFrontmatter(content);
                    skills.push({
                        name: entry.name,
                        description: frontmatter.description || '',
                        enabled: !disabledSkills.includes(entry.name),
                    });
                } catch {}
            }
        }
    }
    
    res.json(skills);
});

app.post('/api/skills/:name/toggle', (req, res) => {
    const skillName = req.params.name;
    const studioConfig = loadStudioConfig();
    const disabledSkills = studioConfig.disabledSkills || [];
    
    if (disabledSkills.includes(skillName)) {
        studioConfig.disabledSkills = disabledSkills.filter(s => s !== skillName);
    } else {
        studioConfig.disabledSkills = [...disabledSkills, skillName];
    }
    
    saveStudioConfig(studioConfig);
    res.json({ success: true, enabled: !studioConfig.disabledSkills.includes(skillName) });
});

app.get('/api/skills/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    const skillName = path.basename(req.params.name);
    const skillDir = path.join(paths.skillDir, skillName);
    const skillFile = path.join(skillDir, 'SKILL.md');
    
    if (!fs.existsSync(skillFile)) {
        return res.status(404).json({ error: 'Skill not found' });
    }
    
    const content = fs.readFileSync(skillFile, 'utf8');
    const { frontmatter, body } = parseSkillFrontmatter(content);
    
    res.json({ 
        name: skillName, 
        description: frontmatter.description || '',
        content: body,
        rawContent: content,
    });
});

app.post('/api/skills/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    const skillName = path.basename(req.params.name);
    const { description, content } = req.body;
    
    const skillDir = path.join(paths.skillDir, skillName);
    if (!fs.existsSync(skillDir)) {
        fs.mkdirSync(skillDir, { recursive: true });
    }
    
    const fullContent = createSkillContent(skillName, description || '', content || '');
    const skillFile = path.join(skillDir, 'SKILL.md');
    fs.writeFileSync(skillFile, fullContent, 'utf8');
    
    res.json({ success: true });
});

app.delete('/api/skills/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    const skillName = path.basename(req.params.name);
    const skillDir = path.join(paths.skillDir, skillName);
    if (fs.existsSync(skillDir)) {
        fs.rmSync(skillDir, { recursive: true, force: true });
    }
    res.json({ success: true });
});

app.get('/api/plugins', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.json([]);
    
    const studioConfig = loadStudioConfig();
    const disabledPlugins = studioConfig.disabledPlugins || [];
    const plugins = [];
    
    if (fs.existsSync(paths.pluginDir)) {
        const files = fs.readdirSync(paths.pluginDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
        for (const f of files) {
            plugins.push({
                name: f,
                type: 'file',
                enabled: !disabledPlugins.includes(f),
            });
        }
    }
    
    if (fs.existsSync(paths.opencodeJson)) {
        try {
            const config = JSON.parse(fs.readFileSync(paths.opencodeJson, 'utf8'));
            if (Array.isArray(config.plugin)) {
                for (const p of config.plugin) {
                    if (typeof p === 'string') {
                        plugins.push({
                            name: p,
                            type: 'npm',
                            enabled: !disabledPlugins.includes(p),
                        });
                    }
                }
            }
        } catch {}
    }
    
    res.json(plugins);
});

app.post('/api/plugins/:name/toggle', (req, res) => {
    const pluginName = req.params.name;
    const studioConfig = loadStudioConfig();
    const disabledPlugins = studioConfig.disabledPlugins || [];
    
    if (disabledPlugins.includes(pluginName)) {
        studioConfig.disabledPlugins = disabledPlugins.filter(p => p !== pluginName);
    } else {
        studioConfig.disabledPlugins = [...disabledPlugins, pluginName];
    }
    
    saveStudioConfig(studioConfig);
    res.json({ success: true, enabled: !studioConfig.disabledPlugins.includes(pluginName) });
});

app.get('/api/plugins/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    const pluginName = path.basename(req.params.name);
    const filePath = path.join(paths.pluginDir, pluginName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Plugin not found' });
    
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ name: pluginName, content });
});

app.post('/api/plugins/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    if (!fs.existsSync(paths.pluginDir)) {
        fs.mkdirSync(paths.pluginDir, { recursive: true });
    }
    
    const pluginName = path.basename(req.params.name);
    const filePath = path.join(paths.pluginDir, pluginName);
    fs.writeFileSync(filePath, req.body.content, 'utf8');
    res.json({ success: true });
});

app.delete('/api/plugins/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    const pluginName = path.basename(req.params.name);
    const filePath = path.join(paths.pluginDir, pluginName);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    res.json({ success: true });
});

// Add npm-style plugins to opencode.json config
app.post('/api/plugins/config/add', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    const { plugins } = req.body;
    
    if (!plugins || !Array.isArray(plugins) || plugins.length === 0) {
        return res.status(400).json({ error: 'plugins array is required' });
    }
    
    try {
        let config = {};
        if (fs.existsSync(paths.opencodeJson)) {
            config = JSON.parse(fs.readFileSync(paths.opencodeJson, 'utf8'));
        }
        
        if (!config.plugin) {
            config.plugin = [];
        }
        
        const added = [];
        const skipped = [];
        
        for (const plugin of plugins) {
            if (typeof plugin !== 'string') continue;
            const trimmed = plugin.trim();
            if (!trimmed) continue;
            
            if (config.plugin.includes(trimmed)) {
                skipped.push(trimmed);
            } else {
                config.plugin.push(trimmed);
                added.push(trimmed);
            }
        }
        
        fs.writeFileSync(paths.opencodeJson, JSON.stringify(config, null, 2), 'utf8');
        
        res.json({ success: true, added, skipped });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update config', details: err.message });
    }
});

app.delete('/api/plugins/config/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    const pluginName = req.params.name;
    
    try {
        let config = {};
        if (fs.existsSync(paths.opencodeJson)) {
            config = JSON.parse(fs.readFileSync(paths.opencodeJson, 'utf8'));
        }
        
        if (!Array.isArray(config.plugin)) {
            return res.status(404).json({ error: 'Plugin not found in config' });
        }
        
        const index = config.plugin.indexOf(pluginName);
        if (index === -1) {
            return res.status(404).json({ error: 'Plugin not found in config' });
        }
        
        config.plugin.splice(index, 1);
        fs.writeFileSync(paths.opencodeJson, JSON.stringify(config, null, 2), 'utf8');
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove plugin', details: err.message });
    }
});

app.get('/api/backup', (req, res) => {
    const paths = getPaths();
    if (!paths) {
        return res.status(404).json({ error: 'Opencode installation not found' });
    }
    
    const backup = {
        version: 2,
        timestamp: new Date().toISOString(),
        studioConfig: loadStudioConfig(),
        opencodeConfig: null,
        skills: [],
        plugins: [],
    };
    
    if (fs.existsSync(paths.opencodeJson)) {
        try {
            backup.opencodeConfig = JSON.parse(fs.readFileSync(paths.opencodeJson, 'utf8'));
        } catch {}
    }
    
    if (fs.existsSync(paths.skillDir)) {
        const entries = fs.readdirSync(paths.skillDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const skillFile = path.join(paths.skillDir, entry.name, 'SKILL.md');
                if (fs.existsSync(skillFile)) {
                    try {
                        const content = fs.readFileSync(skillFile, 'utf8');
                        backup.skills.push({ name: entry.name, content });
                    } catch {}
                }
            }
        }
    }
    
    if (fs.existsSync(paths.pluginDir)) {
        const pluginFiles = fs.readdirSync(paths.pluginDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
        for (const file of pluginFiles) {
            try {
                const content = fs.readFileSync(path.join(paths.pluginDir, file), 'utf8');
                backup.plugins.push({ name: file, content });
            } catch {}
        }
    }
    
    res.json(backup);
});

app.post('/api/fetch-url', async (req, res) => {
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
    }
    
    try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
        }
        
        const response = await fetch(url, {
            headers: { 'User-Agent': 'OpenCode-Studio/1.0' },
        });
        
        if (!response.ok) {
            return res.status(response.status).json({ error: `Failed to fetch: ${response.statusText}` });
        }
        
        const content = await response.text();
        const filename = parsedUrl.pathname.split('/').pop() || 'file';
        
        res.json({ content, filename, url });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch URL', details: err.message });
    }
});

app.post('/api/bulk-fetch', async (req, res) => {
    const { urls } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: 'urls array is required' });
    }
    
    if (urls.length > 50) {
        return res.status(400).json({ error: 'Maximum 50 URLs allowed per request' });
    }
    
    const results = [];
    
    for (const url of urls) {
        if (!url || typeof url !== 'string') {
            results.push({ url, success: false, error: 'Invalid URL' });
            continue;
        }
        
        try {
            const parsedUrl = new URL(url.trim());
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                results.push({ url, success: false, error: 'Only HTTP/HTTPS allowed' });
                continue;
            }
            
            const response = await fetch(url.trim(), {
                headers: { 'User-Agent': 'OpenCode-Studio/1.0' },
            });
            
            if (!response.ok) {
                results.push({ url, success: false, error: `HTTP ${response.status}` });
                continue;
            }
            
            const content = await response.text();
            const filename = parsedUrl.pathname.split('/').pop() || 'file';
            const { frontmatter, body } = parseSkillFrontmatter(content);
            
            const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
            let extractedName = '';
            const filenameIdx = pathParts.length - 1;
            if (pathParts[filenameIdx]?.toLowerCase() === 'skill.md' && filenameIdx > 0) {
                extractedName = pathParts[filenameIdx - 1];
            } else {
                extractedName = filename.replace(/\.(md|js|ts)$/i, '').toLowerCase();
            }
            
            results.push({
                url,
                success: true,
                content,
                body,
                filename,
                name: frontmatter.name || extractedName,
                description: frontmatter.description || '',
            });
        } catch (err) {
            results.push({ url, success: false, error: err.message });
        }
    }
    
    res.json({ results });
});

app.post('/api/restore', (req, res) => {
    const paths = getPaths();
    if (!paths) {
        return res.status(404).json({ error: 'Opencode installation not found' });
    }
    
    const backup = req.body;
    
    if (!backup || (backup.version !== 1 && backup.version !== 2)) {
        return res.status(400).json({ error: 'Invalid backup file' });
    }
    
    try {
        if (backup.studioConfig) {
            saveStudioConfig(backup.studioConfig);
        }
        
        if (backup.opencodeConfig) {
            fs.writeFileSync(paths.opencodeJson, JSON.stringify(backup.opencodeConfig, null, 2), 'utf8');
        }
        
        if (backup.skills && backup.skills.length > 0) {
            if (!fs.existsSync(paths.skillDir)) {
                fs.mkdirSync(paths.skillDir, { recursive: true });
            }
            for (const skill of backup.skills) {
                const skillName = path.basename(skill.name.replace('.md', ''));
                const skillDir = path.join(paths.skillDir, skillName);
                if (!fs.existsSync(skillDir)) {
                    fs.mkdirSync(skillDir, { recursive: true });
                }
                fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skill.content, 'utf8');
            }
        }
        
        if (backup.plugins && backup.plugins.length > 0) {
            if (!fs.existsSync(paths.pluginDir)) {
                fs.mkdirSync(paths.pluginDir, { recursive: true });
            }
            for (const plugin of backup.plugins) {
                const pluginName = path.basename(plugin.name);
                fs.writeFileSync(path.join(paths.pluginDir, pluginName), plugin.content, 'utf8');
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to restore backup', details: err.message });
    }
});

// Auth endpoints
function getAuthFile() {
    for (const candidate of AUTH_CANDIDATE_PATHS) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

function loadAuthConfig() {
    const authFile = getAuthFile();
    if (!authFile) return null;
    
    try {
        return JSON.parse(fs.readFileSync(authFile, 'utf8'));
    } catch {
        return null;
    }
}

function saveAuthConfig(config) {
    const authFile = getAuthFile();
    if (!authFile) return false;
    
    try {
        fs.writeFileSync(authFile, JSON.stringify(config, null, 2), 'utf8');
        return true;
    } catch {
        return false;
    }
}

const PROVIDER_DISPLAY_NAMES = {
    'github-copilot': 'GitHub Copilot',
    'google': 'Google',
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'zai': 'Z.AI',
    'xai': 'xAI',
    'groq': 'Groq',
    'together': 'Together AI',
    'mistral': 'Mistral',
    'deepseek': 'DeepSeek',
    'openrouter': 'OpenRouter',
    'amazon-bedrock': 'Amazon Bedrock',
    'azure': 'Azure OpenAI',
};

app.get('/api/auth', (req, res) => {
    const authConfig = loadAuthConfig();
    const authFile = getAuthFile();
    
    if (!authConfig) {
        return res.json({ 
            credentials: [], 
            authFile: null,
            message: 'No auth file found' 
        });
    }
    
    const credentials = Object.entries(authConfig).map(([id, config]) => {
        const isExpired = config.expires ? Date.now() > config.expires : false;
        return {
            id,
            name: PROVIDER_DISPLAY_NAMES[id] || id,
            type: config.type,
            isExpired,
            expiresAt: config.expires || null,
        };
    });
    
    res.json({ credentials, authFile });
});

app.post('/api/auth/login', (req, res) => {
    const { provider } = req.body;
    
    if (!provider) {
        return res.status(400).json({ error: 'Provider is required' });
    }

    if (!PROVIDER_DISPLAY_NAMES[provider]) {
        return res.status(400).json({ error: 'Invalid provider' });
    }
    
    // Run opencode auth login - this opens browser
    const child = spawn('opencode', ['auth', 'login', provider], {
        stdio: 'inherit',
    });
    
    child.on('error', (err) => {
        console.error('Failed to start auth login:', err);
    });
    
    // Return immediately - login happens in browser
    res.json({ 
        success: true, 
        message: `Opening browser for ${provider} login...`,
        note: 'Complete authentication in your browser, then refresh this page.'
    });
});

app.delete('/api/auth/:provider', (req, res) => {
    const provider = req.params.provider;
    const authConfig = loadAuthConfig();
    
    if (!authConfig) {
        return res.status(404).json({ error: 'No auth configuration found' });
    }
    
    if (!authConfig[provider]) {
        return res.status(404).json({ error: `Provider ${provider} not found` });
    }
    
    delete authConfig[provider];
    
    if (saveAuthConfig(authConfig)) {
        res.json({ success: true });
    } else {
        res.status(500).json({ error: 'Failed to save auth configuration' });
    }
});

// Get available providers for login
app.get('/api/auth/providers', (req, res) => {
    const providers = [
        { id: 'github-copilot', name: 'GitHub Copilot', type: 'oauth', description: 'Use GitHub Copilot API' },
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
