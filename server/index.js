
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Auto-detect config path
const HOME_DIR = os.homedir();
const CONFIG_DIR = path.join(HOME_DIR, '.config', 'opencode');
const OPENCODE_JSON = path.join(CONFIG_DIR, 'opencode.json');
const SKILL_DIR = path.join(CONFIG_DIR, 'skill');
const PLUGIN_DIR = path.join(CONFIG_DIR, 'plugin');

console.log(`Looking for config at: ${CONFIG_DIR}`);

// Helper to read JSON
const readConfig = () => {
    if (!fs.existsSync(OPENCODE_JSON)) {
        return { error: "Config file not found" };
    }
    try {
        const data = fs.readFileSync(OPENCODE_JSON, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return { error: "Failed to parse config", details: err.message };
    }
};

// Helper to write JSON
const writeConfig = (data) => {
    try {
        fs.writeFileSync(OPENCODE_JSON, JSON.stringify(data, null, 2), 'utf8');
        return { success: true };
    } catch (err) {
        return { error: "Failed to write config", details: err.message };
    }
};

// GET /api/config
app.get('/api/config', (req, res) => {
    res.json(readConfig());
});

// POST /api/config
app.post('/api/config', (req, res) => {
    const result = writeConfig(req.body);
    if (result.error) return res.status(500).json(result);
    res.json(result);
});

// GET /api/skills
app.get('/api/skills', (req, res) => {
    if (!fs.existsSync(SKILL_DIR)) return res.json([]);
    const files = fs.readdirSync(SKILL_DIR).filter(f => f.endsWith('.md'));
    res.json(files);
});

// GET /api/skills/:name
app.get('/api/skills/:name', (req, res) => {
    const filePath = path.join(SKILL_DIR, req.params.name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Skill not found" });
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ name: req.params.name, content });
});

// POST /api/skills/:name
app.post('/api/skills/:name', (req, res) => {
    const filePath = path.join(SKILL_DIR, req.params.name);
    // Ensure dir exists
    if (!fs.existsSync(SKILL_DIR)) fs.mkdirSync(SKILL_DIR, { recursive: true });
    
    fs.writeFileSync(filePath, req.body.content, 'utf8');
    res.json({ success: true });
});

// DELETE /api/skills/:name
app.delete('/api/skills/:name', (req, res) => {
    const filePath = path.join(SKILL_DIR, req.params.name);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    res.json({ success: true });
});

// GET /api/plugins
app.get('/api/plugins', (req, res) => {
    if (!fs.existsSync(PLUGIN_DIR)) return res.json([]);
    const files = fs.readdirSync(PLUGIN_DIR).filter(f => f.endsWith('.js') || f.endsWith('.ts'));
    res.json(files);
});

// GET /api/plugins/:name
app.get('/api/plugins/:name', (req, res) => {
    const filePath = path.join(PLUGIN_DIR, req.params.name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Plugin not found" });
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ name: req.params.name, content });
});

// POST /api/plugins/:name
app.post('/api/plugins/:name', (req, res) => {
    const filePath = path.join(PLUGIN_DIR, req.params.name);
    // Ensure dir exists
    if (!fs.existsSync(PLUGIN_DIR)) fs.mkdirSync(PLUGIN_DIR, { recursive: true });
    
    fs.writeFileSync(filePath, req.body.content, 'utf8');
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
