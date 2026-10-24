const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

test('real backend rejects foreign-origin writes without changing config', {timeout:15000, skip:process.platform==='win32'?'HTTP fixture currently isolates Linux/macOS homes only':false}, async () => {
    const home=fs.mkdtempSync(path.join(os.tmpdir(),'studio-http-test-'));
    const directory=path.join(home,'.config/opencode');fs.mkdirSync(directory,{recursive:true});
    const config=path.join(directory,'opencode.json');fs.writeFileSync(config,'{}');
    const child=spawn(process.execPath,[path.join(__dirname,'../index.js')], {
        cwd:path.join(__dirname,'..'),
        env:{PATH:process.env.PATH,HOME:home,USERPROFILE:home,XDG_CONFIG_HOME:path.join(home,'.config'),XDG_DATA_HOME:path.join(home,'.local/share'),GH_CONFIG_DIR:path.join(home,'.gh'),APPDATA:path.join(home,'AppData/Roaming'),LOCALAPPDATA:path.join(home,'AppData/Local')},
        stdio:['ignore','pipe','pipe'],
    });
    const exited=once(child,'exit');let output='';
    child.stdout.on('data',chunk=>{output=(output+chunk).slice(-16000);});
    child.stderr.on('data',chunk=>{output=(output+chunk).slice(-16000);});
    try {
        let base;
        for(let i=0;i<100;i++) {
            const match=output.match(/Server running at (http:\/\/127\.0\.0\.1:\d+)/);
            if(match){base=match[1];break;}
            if(child.exitCode!==null)break;
            await new Promise(resolve=>setTimeout(resolve,50));
        }
        assert.ok(base,'backend starts in synthetic home: '+output);
        for(const origin of ['https://untrusted.example','https://unrelated.vercel.app','http://192.168.attacker.example:1080']) {
            const response=await fetch(base+'/api/config',{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded'},body:'permission=allow'});
            assert.equal(response.status,403);assert.equal(fs.readFileSync(config,'utf8'),'{}');
        }
        const preflight=await fetch(base+'/api/config',{method:'OPTIONS',headers:{Origin:'https://opencode.micr.dev','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});
        assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://opencode.micr.dev');
        const trusted=await fetch(base+'/api/config',{method:'POST',headers:{Origin:'http://localhost:1080','Content-Type':'application/json'},body:JSON.stringify({permission:'ask',mcp:{}})});
        assert.equal(trusted.status,200);assert.equal(JSON.parse(fs.readFileSync(config,'utf8')).permission,'ask');
        const read=await fetch(base+'/api/config');assert.equal(read.status,200);assert.equal((await read.json()).permission,'ask');
        const beforeInvalidConfig=fs.readFileSync(config,'utf8');
        const malformedConfig=await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:'[]'});
        assert.equal(malformedConfig.status,400);
        assert.equal(fs.readFileSync(config,'utf8'),beforeInvalidConfig);
        const pluginContent='export const value: string = "synthetic";';
        const create=await fetch(base+'/api/plugins/qa.ts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:pluginContent})});
        assert.equal(create.status,200);
        assert.equal((await (await fetch(base+'/api/plugins/qa.ts')).json()).content,pluginContent);
        const backup=await (await fetch(base+'/api/backup')).json();
        assert.equal(backup.plugins.find(p=>p.name==='qa').extension,'.ts');
        assert.equal((await fetch(base+'/api/plugins/qa.ts',{method:'DELETE'})).status,200);
        const restore=await fetch(base+'/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(backup)});
        assert.equal(restore.status,200);
        assert.equal((await (await fetch(base+'/api/plugins/qa.ts')).json()).content,pluginContent);
        const before=fs.readFileSync(config,'utf8');
        const invalid=await fetch(base+'/api/restore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({opencodeConfig:{permission:'allow'},plugins:[{name:'bad',content:42}]})});
        assert.equal(invalid.status,400);assert.equal(fs.readFileSync(config,'utf8'),before);
        const native={providers:{fixture:{models:{model:{name:'Fixture model'},hidden:{disabled:true}}}},plugins:[{package:'fixture-plugin',options:{custom:'keep'}}],mcp:{timeout:{startup:1234},servers:{fixture:{type:'local',command:['fixture'],disabled:true}}},commands:{review:{template:'native v2',description:'preserved'}},agents:{reviewer:{system:'review'}},permissions:[{action:'shell',resource:'*',effect:'deny'}]};
        assert.equal((await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(native)})).status,200);
        const nativeCommands=await (await fetch(base+'/api/commands')).json();
        assert.equal(nativeCommands.review.template,'native v2');
        const nativeMcp=await (await fetch(base+'/api/mcp')).json();
        assert.deepEqual(Object.keys(nativeMcp),['fixture']);
        assert.equal(nativeMcp.fixture.disabled,true);
        const models=await (await fetch(base+'/api/models')).json();
        assert.ok(models.models.some(m=>m.id==='fixture/model'));
        assert.ok(!models.models.some(m=>m.id==='fixture/hidden'));
        const plugins=await (await fetch(base+'/api/plugins')).json();
        assert.ok(plugins.some(p=>p.name==='fixture-plugin' && p.type==='npm'));
        assert.equal((await fetch(base+'/api/plugins/config/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({plugins:['fixture-new']})})).status,200);
        const addedConfig=JSON.parse(fs.readFileSync(config,'utf8'));
        assert.deepEqual(addedConfig.plugins[0],{package:'fixture-plugin',options:{custom:'keep'}});
        assert.equal(addedConfig.plugins[1],'fixture-new');assert.equal(addedConfig.plugin,undefined);
        assert.equal((await fetch(base+'/api/plugins/config/fixture-new',{method:'DELETE'})).status,200);
        assert.deepEqual(JSON.parse(fs.readFileSync(config,'utf8')).plugins,[{package:'fixture-plugin',options:{custom:'keep'}}]);
        assert.equal((await fetch(base+'/api/plugins/fixture-plugin/toggle',{method:'POST'})).status,409);


        assert.equal(nativeCommands.review.description,'preserved');
        const authInfo=await (await fetch(base+'/api/auth')).json();assert.equal(authInfo.readOnly,true);
        const beforeAuthAttempt=fs.readFileSync(config,'utf8');
        assert.equal((await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'fixture'})})).status,409);
        assert.equal(fs.readFileSync(config,'utf8'),beforeAuthAttempt);
        assert.equal(fs.existsSync(path.join(home,'.config/opencode-studio/auth-profiles')),false);

        const rules=[{action:'shell',resource:'*',effect:'deny'}];
        for (const method of ['POST','PUT']) {
            const route=method==='POST'?'/api/agents':'/api/agents/reviewer';
            assert.equal((await fetch(base+route,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'reviewer',config:{prompt:'changed',maxSteps:7,nativePermissions:rules}})})).status,200);
            const stored=JSON.parse(fs.readFileSync(config,'utf8'));
            assert.equal(stored.agents.reviewer.system,'changed');
            assert.equal(stored.agents.reviewer.steps,7);
            assert.deepEqual(stored.agents.reviewer.permissions,rules);
            assert.equal(stored.agent,undefined);
        }
        const nativeAgents=await (await fetch(base+'/api/agents')).json();
        assert.equal(nativeAgents.agents.find(a=>a.name==='reviewer').configurationFormat,'v2');
        assert.equal((await (await fetch(base+'/api/agents/reviewer/toggle',{method:'POST'})).json()).disabled,true);
        assert.equal(JSON.parse(fs.readFileSync(config,'utf8')).agents.reviewer.disabled,true);
        assert.equal((await (await fetch(base+'/api/agents/reviewer/toggle',{method:'POST'})).json()).disabled,false);
        assert.equal((await fetch(base+'/api/agents/reviewer',{method:'DELETE'})).status,200);
        assert.equal(JSON.parse(fs.readFileSync(config,'utf8')).agents.reviewer,undefined);
        const agentsDir=path.join(directory,'agents');fs.mkdirSync(agentsDir,{recursive:true});
        const markdown=path.join(agentsDir,'native-md.md');
        fs.writeFileSync(markdown,'---\nsteps: 4\ncolor: "#123456"\npermissions:\n  - action: shell\n    resource: "*"\n    effect: deny\n---\nOriginal body');
        const markdownAgents=await (await fetch(base+'/api/agents')).json();
        assert.equal(markdownAgents.agents.find(a=>a.name==='native-md').configurationFormat,'v2');
        assert.equal((await fetch(base+'/api/agents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'native-md',source:'markdown',config:{prompt:'Updated body',maxSteps:9,nativePermissions:rules}})})).status,200);
        const updatedMarkdown=fs.readFileSync(markdown,'utf8');
        assert.match(updatedMarkdown,/steps: 9/);assert.match(updatedMarkdown,/#123456/);assert.match(updatedMarkdown,/Updated body/);assert.doesNotMatch(updatedMarkdown,/maxSteps:|prompt:/);
        assert.equal((await (await fetch(base+'/api/agents/native-md/toggle',{method:'POST'})).json()).disabled,true);
        assert.match(fs.readFileSync(markdown,'utf8'),/disabled: true/);
        const { DatabaseSync }=require('node:sqlite');
        const dataDirectory=path.join(home,'.local/share/opencode');fs.mkdirSync(dataDirectory,{recursive:true});
        const db=new DatabaseSync(path.join(dataDirectory,'opencode.db'));
        db.exec(`CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT, worktree TEXT);
          CREATE TABLE session_v2 (id TEXT PRIMARY KEY, project_id TEXT);
          CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT);
          CREATE TABLE session (id TEXT PRIMARY KEY, project_id TEXT);
          CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, data TEXT);
          INSERT INTO project VALUES ('project', 'Synthetic project', '/synthetic');
          INSERT INTO session_v2 VALUES ('native-session','project');
          INSERT INTO session VALUES ('legacy-session','project');`);
        const now=Date.now();
        const nativeMessage=JSON.stringify({type:'assistant',cost:0.5,tokens:{input:10,output:20,reasoning:3,cache:{read:4,write:5}},time:{created:now},model:{providerID:'fixture',id:'native-model'}});
        const oldMessage=JSON.stringify({role:'assistant',cost:0.25,tokens:{input:2,output:3},time:{created:now},modelID:'legacy-model'});
        db.prepare('INSERT INTO session_message VALUES (?,?,?,?)').run('native-message','native-session',now,nativeMessage);
        db.prepare('INSERT INTO message VALUES (?,?,?,?)').run('legacy-message','legacy-session',now,oldMessage);
        db.prepare('INSERT INTO message VALUES (?,?,?,?)').run('native-message','legacy-session',now,nativeMessage);
        db.close();
        const usageResponse=await fetch(base+'/api/usage?range=all');assert.equal(usageResponse.status,200);
        const usage=await usageResponse.json();assert.equal(usage.totalCost,0.75);assert.equal(usage.totalTokens,47);
        assert.equal(usage.byModel.length,2);assert.ok(usage.byModel.some(m=>m.id==='native-model'));
        const brokenDb=new DatabaseSync(path.join(dataDirectory,'opencode.db'));brokenDb.exec('DROP TABLE project');brokenDb.close();
        assert.equal((await fetch(base+'/api/usage?range=all')).status,500,'database failures must not become a false zero-spending report');
        fs.unlinkSync(path.join(dataDirectory,'opencode.db'));
        fs.writeFileSync(config,'{}');
        fs.writeFileSync(path.join(directory,'auth.json'),JSON.stringify({openai:{type:'api',key:'synthetic-not-a-real-secret'}}));
        const legacyAuth=await (await fetch(base+'/api/auth')).json();
        assert.equal(JSON.stringify(legacyAuth).includes('synthetic-not-a-real-secret'),false,'auth status must not return stored keys');
        assert.equal(legacyAuth.openai,undefined);
        assert.ok(legacyAuth.credentials.some(c=>c.id==='openai' && c.hasCurrentAuth));





    } finally {
        if(child.exitCode===null)child.kill('SIGTERM');
        await exited;fs.rmSync(home,{recursive:true,force:true});
    }
});
