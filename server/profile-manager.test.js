const { test } = require('node:test');
const assert = require('node:assert');
const { safeName } = require('./profile-manager');

test('safeName rejects traversal and dot names', () => {
    for (const bad of ['.', '..', '../evil', 'a/b', '..\\..', '/etc/passwd', '', null]) {
        assert.throws(() => safeName(bad), /Invalid profile name/, `should reject ${JSON.stringify(bad)}`);
    }
});

test('safeName accepts direct-child names', () => {
    for (const ok of ['work', 'personal', 'my.profile', 'p_1-2']) {
        assert.strictEqual(safeName(ok), ok);
    }
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function isolated(script) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-profile-test-'));
    try {
        execFileSync(process.execPath, ['-e', `
          const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
          const home=process.env.HOME, config=path.join(home,'.config/opencode'), profiles=path.join(home,'.config/opencode-profiles');
          const manager=require(${JSON.stringify(require.resolve('./profile-manager'))});
          ${script}
        `], { env: { ...process.env, HOME: home, USERPROFILE: home }, stdio: 'pipe' });
    } finally { fs.rmSync(home, { recursive: true, force: true }); }
}

test('import does not modify the home directory', () => isolated(`
  assert.equal(fs.existsSync(path.join(home,'.config')),false);
`));

test('activation preserves an unmanaged config when default already exists', () => isolated(`
  fs.mkdirSync(config,{recursive:true});fs.writeFileSync(path.join(config,'opencode.json'),'keep me');
  manager.createProfile('default');manager.createProfile('work');
  assert.throws(()=>manager.activateProfile('work'),/unmanaged config/);
  assert.equal(fs.readFileSync(path.join(config,'opencode.json'),'utf8'),'keep me');
  assert.equal(fs.lstatSync(config).isDirectory(),true);
`));

test('first activation safely migrates and preserves an existing config', () => isolated(`
  fs.mkdirSync(config,{recursive:true});fs.writeFileSync(path.join(config,'opencode.json'),'keep me');
  manager.createProfile('work');manager.activateProfile('work');
  assert.equal(fs.readFileSync(path.join(profiles,'default/opencode.json'),'utf8'),'keep me');
  assert.equal(manager.listProfiles().active,'work');
  manager.activateProfile('default');assert.equal(fs.readFileSync(path.join(config,'opencode.json'),'utf8'),'keep me');
`));

test('failed activation rolls back the old link and preserves both profiles', () => isolated(`
  manager.listProfiles();manager.createProfile('work');
  fs.writeFileSync(path.join(profiles,'default/keep'),'original');
  const rename=fs.renameSync;
  fs.renameSync=(from,to)=>{if(from.includes('.next-'))throw new Error('simulated rename failure');return rename(from,to);};
  assert.throws(()=>manager.activateProfile('work'),/simulated/);fs.renameSync=rename;
  assert.equal(manager.listProfiles().active,'default');
  assert.equal(fs.readFileSync(path.join(config,'keep'),'utf8'),'original');
  assert.equal(fs.existsSync(path.join(profiles,'work')),true);
`));

test('activation rejects files and external symlink targets', () => isolated(`
  manager.listProfiles();fs.writeFileSync(path.join(profiles,'file'),'not a directory');
  assert.throws(()=>manager.activateProfile('file'),/local directory/);
  const outside=path.join(home,'outside');fs.mkdirSync(outside);fs.symlinkSync(outside,path.join(profiles,'external'),'junction');
  assert.throws(()=>manager.activateProfile('external'),/local directory/);
  assert.equal(manager.listProfiles().active,'default');
`));

test('migration restores unmanaged config if creating its link fails', () => isolated(`
  fs.mkdirSync(config,{recursive:true});fs.writeFileSync(path.join(config,'opencode.json'),'keep me');
  const link=fs.symlinkSync;fs.symlinkSync=()=>{throw new Error('simulated link failure');};
  assert.throws(()=>manager.listProfiles(),/simulated/);fs.symlinkSync=link;
  assert.equal(fs.readFileSync(path.join(config,'opencode.json'),'utf8'),'keep me');
  assert.equal(fs.lstatSync(config).isDirectory(),true);
`));
