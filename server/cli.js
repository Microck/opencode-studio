#!/usr/bin/env node

const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');

const args = process.argv.slice(2);

// Handle --register flag
if (args.includes('--register')) {
    require('./register-protocol');
    process.exit(0);
}

// Parse protocol URL if provided
// Format: opencodestudio://action?param1=value1&param2=value2
const protocolArg = args.find(arg => arg.startsWith('opencodestudio://'));

let pendingAction = null;
let shouldOpenBrowser = false;

if (protocolArg) {
    try {
        // Parse the protocol URL
        const urlStr = protocolArg.replace('opencodestudio://', 'http://localhost/');
        const url = new URL(urlStr);
        const action = url.pathname.replace(/^\//, '');
        const params = Object.fromEntries(url.searchParams);

        console.log(`Protocol action: ${action}`);
        console.log(`Params:`, params);

        switch (action) {
            case 'launch':
                // Just launch, optionally open browser
                if (params.open === 'local') {
                    shouldOpenBrowser = true;
                }
                break;

            case 'install-mcp':
                // Queue MCP server installation
                if (params.cmd || params.name) {
                    pendingAction = {
                        type: 'install-mcp',
                        name: params.name || 'MCP Server',
                        command: params.cmd ? decodeURIComponent(params.cmd) : null,
                        env: params.env ? JSON.parse(decodeURIComponent(params.env)) : null,
                        timestamp: Date.now(),
                    };
                    console.log(`Queued MCP install: ${pendingAction.name}`);
                }
                break;

            case 'import-skill':
                // Queue skill import from URL
                if (params.url) {
                    pendingAction = {
                        type: 'import-skill',
                        url: decodeURIComponent(params.url),
                        name: params.name ? decodeURIComponent(params.name) : null,
                        timestamp: Date.now(),
                    };
                    console.log(`Queued skill import: ${params.url}`);
                }
                break;

            case 'import-plugin':
                // Queue plugin import from URL
                if (params.url) {
                    pendingAction = {
                        type: 'import-plugin',
                        url: decodeURIComponent(params.url),
                        name: params.name ? decodeURIComponent(params.name) : null,
                        timestamp: Date.now(),
                    };
                    console.log(`Queued plugin import: ${params.url}`);
                }
                break;

            default:
                console.log(`Unknown action: ${action}`);
        }
    } catch (err) {
        console.error('Failed to parse protocol URL:', err.message);
    }
}

// Store pending action for server to pick up
if (pendingAction) {
    const pendingFile = path.join(os.homedir(), '.config', 'opencode-studio', 'pending-action.json');
    const dir = path.dirname(pendingFile);
    
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(pendingFile, JSON.stringify(pendingAction, null, 2), 'utf8');
    console.log(`Pending action saved to: ${pendingFile}`);
}

// Open browser if requested (only for fully local mode)
if (shouldOpenBrowser) {
    const openUrl = 'http://localhost:3000';
    const platform = os.platform();
    
    setTimeout(() => {
        let cmd;
        if (platform === 'win32') {
            cmd = `start "" "${openUrl}"`;
        } else if (platform === 'darwin') {
            cmd = `open "${openUrl}"`;
        } else {
            cmd = `xdg-open "${openUrl}"`;
        }
        
        exec(cmd, (err) => {
            if (err) {
                console.log(`Open ${openUrl} in your browser`);
            } else {
                console.log(`Opened ${openUrl}`);
            }
        });
    }, 1500); // Give server time to start
}

// Start the server
require('./index.js');
