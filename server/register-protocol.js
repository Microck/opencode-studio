const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const PROTOCOL = 'opencodestudio';

function registerWindows() {
    const nodePath = process.execPath;
    const scriptPath = path.join(__dirname, 'cli.js');
    
    // Create a VBScript launcher that runs node hidden
    const vbsPath = path.join(__dirname, 'launcher.vbs');
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
args = ""
If WScript.Arguments.Count > 0 Then
    args = " """ & WScript.Arguments(0) & """"
End If
WshShell.Run """${nodePath}""" & " ""${scriptPath}"" " & args, 0, False
`;
    
    try {
        fs.writeFileSync(vbsPath, vbsContent);
    } catch (err) {
        console.error('Failed to create launcher.vbs:', err.message);
    }
    
    // Register protocol to use wscript with the VBS launcher
    const command = `wscript.exe "${vbsPath}" "%1"`;
    
    const regCommands = [
        `reg add "HKCU\\Software\\Classes\\${PROTOCOL}" /ve /d "URL:OpenCode Studio Protocol" /f`,
        `reg add "HKCU\\Software\\Classes\\${PROTOCOL}" /v "URL Protocol" /d "" /f`,
        `reg add "HKCU\\Software\\Classes\\${PROTOCOL}\\shell\\open\\command" /ve /d "${command}" /f`,
    ];
    
    return new Promise((resolve, reject) => {
        let completed = 0;
        let failed = false;
        
        for (const cmd of regCommands) {
            exec(cmd, (err) => {
                if (err && !failed) {
                    failed = true;
                    reject(err);
                    return;
                }
                completed++;
                if (completed === regCommands.length && !failed) {
                    resolve();
                }
            });
        }
    });
}

function registerMac() {
    console.log('macOS: Protocol registration requires app bundle.');
    console.log('Use `npx opencode-studio-server` to start manually.');
    return Promise.resolve();
}

function registerLinux() {
    const nodePath = process.execPath;
    const scriptPath = path.join(__dirname, 'cli.js');
    const desktopEntry = `[Desktop Entry]
Name=OpenCode Studio
Exec=${nodePath} ${scriptPath} %u
Type=Application
Terminal=true
MimeType=x-scheme-handler/${PROTOCOL};
`;
    
    const desktopPath = path.join(os.homedir(), '.local', 'share', 'applications', `${PROTOCOL}.desktop`);
    const fs = require('fs');
    
    try {
        fs.mkdirSync(path.dirname(desktopPath), { recursive: true });
        fs.writeFileSync(desktopPath, desktopEntry);
        
        return new Promise((resolve) => {
            exec(`xdg-mime default ${PROTOCOL}.desktop x-scheme-handler/${PROTOCOL}`, () => {
                resolve();
            });
        });
    } catch (err) {
        return Promise.reject(err);
    }
}

async function register() {
    const platform = os.platform();
    
    try {
        if (platform === 'win32') {
            await registerWindows();
        } else if (platform === 'darwin') {
            await registerMac();
        } else {
            await registerLinux();
        }
        console.log(`Protocol ${PROTOCOL}:// registered successfully`);
    } catch (err) {
        console.error('Protocol registration failed:', err.message);
        console.log('You can still use: npx opencode-studio-server');
    }
}

if (require.main === module) {
    register();
}

module.exports = { register, PROTOCOL };
