# GitHub Backup 500 Error - Investigation Results

**Date:** 2026-01-30
**Status:** ROOT CAUSE IDENTIFIED

## Problem
GitHub backup fails with 500 error when clicking "Push to GitHub" in Settings.

## Root Cause
Files named `nul` exist in skill directories. `nul` is a reserved Windows device name (like CON, PRN, AUX, NUL). Git cannot add files with reserved names on Windows, causing the backup to fail with:

```
error: open("opencode/skills/nul"): No such file or directory
error: unable to index file 'opencode/skills/nul'
fatal: adding files failed
```

## Affected Files
Found 25+ files named `nul` in:
- `~/.config/opencode/skill/nul`
- `~/.config/opencode/skill/*/nul` (in almost every skill subdirectory)
- `~/.config/opencode/skill/working-paper/assets/nul`
- `~/.config/opencode/skill/working-paper/references/nul`

## Fix Required

### Immediate Fix: Remove nul files
Run PowerShell command to delete all `nul` files:

```powershell
Get-ChildItem -Path ~/.config/opencode/skill -Recurse -Filter 'nul' | Remove-Item -Force
```

### Preventive Fix: Update backup code
Modify `copyDirContents()` in `server/index.js` to skip Windows reserved filenames:

```javascript
const RESERVED_WIN_NAMES = ['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'];

// In copyDirContents, skip reserved names:
if (RESERVED_WIN_NAMES.includes(name.toLowerCase())) continue;
```

## Testing
After fix, test backup:
```bash
curl -X POST http://localhost:1920/api/github/backup -H "Content-Type: application/json" -d "{}"
```

## Priority
HIGH - Blocks GitHub backup functionality on Windows

## Next Steps
1. Remove all `nul` files
2. Update server code to prevent future issues
3. Test backup endpoint
4. Update TODO file
