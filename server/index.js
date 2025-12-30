const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

const HOME_DIR = os.homedir();
const STUDIO_CONFIG_PATH = path.join(HOME_DIR, '.config', 'opencode-studio', 'studio.json');

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

console.log(`Detected config at: ${getConfigDir() || 'NOT FOUND'}`);

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
        const data = fs.readFileSync(paths.opencodeJson, 'utf8');
        res.json(JSON.parse(data));
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
    
    const files = fs.readdirSync(paths.skillDir).filter(f => f.endsWith('.md'));
    const studioConfig = loadStudioConfig();
    const disabledSkills = studioConfig.disabledSkills || [];
    
    const skills = files.map(f => ({
        name: f,
        enabled: !disabledSkills.includes(f),
    }));
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
    
    const filePath = path.join(paths.skillDir, req.params.name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Skill not found' });
    
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ name: req.params.name, content });
});

app.post('/api/skills/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    if (!fs.existsSync(paths.skillDir)) {
        fs.mkdirSync(paths.skillDir, { recursive: true });
    }
    
    const filePath = path.join(paths.skillDir, req.params.name);
    fs.writeFileSync(filePath, req.body.content, 'utf8');
    res.json({ success: true });
});

app.delete('/api/skills/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    const filePath = path.join(paths.skillDir, req.params.name);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    res.json({ success: true });
});

app.get('/api/plugins', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.json([]);
    if (!fs.existsSync(paths.pluginDir)) return res.json([]);
    
    const files = fs.readdirSync(paths.pluginDir).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    const studioConfig = loadStudioConfig();
    const disabledPlugins = studioConfig.disabledPlugins || [];
    
    const plugins = files.map(f => ({
        name: f,
        enabled: !disabledPlugins.includes(f),
    }));
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
    
    const filePath = path.join(paths.pluginDir, req.params.name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Plugin not found' });
    
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ name: req.params.name, content });
});

app.post('/api/plugins/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    if (!fs.existsSync(paths.pluginDir)) {
        fs.mkdirSync(paths.pluginDir, { recursive: true });
    }
    
    const filePath = path.join(paths.pluginDir, req.params.name);
    fs.writeFileSync(filePath, req.body.content, 'utf8');
    res.json({ success: true });
});

app.delete('/api/plugins/:name', (req, res) => {
    const paths = getPaths();
    if (!paths) return res.status(404).json({ error: 'Opencode not found' });
    
    const filePath = path.join(paths.pluginDir, req.params.name);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    res.json({ success: true });
});

app.get('/api/backup', (req, res) => {
    const paths = getPaths();
    if (!paths) {
        return res.status(404).json({ error: 'Opencode installation not found' });
    }
    
    const backup = {
        version: 1,
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
        const skillFiles = fs.readdirSync(paths.skillDir).filter(f => f.endsWith('.md'));
        for (const file of skillFiles) {
            try {
                const content = fs.readFileSync(path.join(paths.skillDir, file), 'utf8');
                backup.skills.push({ name: file, content });
            } catch {}
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

app.post('/api/restore', (req, res) => {
    const paths = getPaths();
    if (!paths) {
        return res.status(404).json({ error: 'Opencode installation not found' });
    }
    
    const backup = req.body;
    
    if (!backup || backup.version !== 1) {
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
                fs.writeFileSync(path.join(paths.skillDir, skill.name), skill.content, 'utf8');
            }
        }
        
        if (backup.plugins && backup.plugins.length > 0) {
            if (!fs.existsSync(paths.pluginDir)) {
                fs.mkdirSync(paths.pluginDir, { recursive: true });
            }
            for (const plugin of backup.plugins) {
                fs.writeFileSync(path.join(paths.pluginDir, plugin.name), plugin.content, 'utf8');
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to restore backup', details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
