const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {listenOnAvailablePort}=require('./listen');
function fakeApp(failures) {
    const calls=[];
    return {calls,listen(port,host){calls.push({port,host});const server=new EventEmitter();queueMicrotask(()=>{
        const code=failures.shift();if(code)server.emit('error',Object.assign(new Error(code),{code}));else server.emit('listening');
    });return server;}};
}
test('binds loopback and retries only occupied ports within discovery range',async()=>{
    const app=fakeApp(['EADDRINUSE','EADDRINUSE']);await listenOnAvailablePort(app);
    assert.deepEqual(app.calls,[1920,1921,1922].map(port=>({port,host:'127.0.0.1'})));
});
test('fails clearly when all ten discoverable ports are occupied',async()=>{
    const app=fakeApp(Array(10).fill('EADDRINUSE'));
    await assert.rejects(listenOnAvailablePort(app),/1920-1929/);assert.equal(app.calls.length,10);
});
test('permission errors fail immediately instead of scanning indefinitely',async()=>{
    const app=fakeApp(['EACCES']);await assert.rejects(listenOnAvailablePort(app),{code:'EACCES'});assert.equal(app.calls.length,1);
});
