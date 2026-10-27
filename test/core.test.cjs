'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {mkdtemp, readdir, readFile, rm, mkdir} = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const C = require('../src/core.cjs');
const {Store} = require('../src/storage.cjs');
const {analyze} = require('../src/analyzer.cjs');
function ready() {return C.normalize({id:'session-test', title:'Review revenue', description:'Use to review a report in a test environment.', preconditions:'Test tenant, report access and approved input.', parameters:[{name:'property_id',description:'Target test property'}], events:[{id:'event-1',type:'note',text:'Open a report',at:0}], steps:[{action:'Open report for {{property_id}}',expected:'Report shows the selected test property', recovery:'Stop and verify property access',evidence:['event-1'],approved:true,sensitive:false}],approved:true});}
test('export gate rejects unreviewed, incomplete and undefined parameter workflows', () => {
  assert.equal(C.validate(ready()).ok,true);
  const variants = [s => s.approved=false, s=>s.steps[0].approved=false,s=>s.steps[0].expected='',s=>s.steps[0].recovery='',s=>s.preconditions='',s=>s.steps[0].action='Open {{missing}}',s=>s.parameters.push({...s.parameters[0]}),s=>s.steps[0].expected='Verify {{missing}}'];
  for (const mutate of variants) {const s=ready(); mutate(s); assert.equal(C.validate(s).ok,false); assert.throws(()=>C.exportFiles(s));}
});
test('redacts common secrets and emails and drops URL credentials, queries and fragments', () => {
  const secret='ghp_'+'a'.repeat(30), key='sk-'+'b'.repeat(30);
  const out=C.normalize({...ready(),events:[{text:`${secret} ${key} password="my password" a@example.com Bearer abcdef.123`,url:'https://u:pass@example.com/report?token=secret#private'}]});
  assert.ok(!JSON.stringify(out).includes(secret)); assert.ok(!JSON.stringify(out).includes(key)); assert.ok(!JSON.stringify(out).includes('my password'));
  assert.equal(out.events[0].url,'https://example.com/report'); assert.equal(C.safeUrl('javascript:alert(1)'), '');
  out.steps[0].action='email a@example.com'; assert.equal(C.validate(out).ok,false);
});
test('evidence IDs remain stable after deletion and normalization', () => {
  const s=ready(); s.events.unshift({id:'event-old',at:0,type:'note',text:'Earlier note',url:''});
  assert.equal(C.normalize(s).steps[0].evidence[0],'event-1');
  s.events.shift(); assert.equal(C.normalize(s).steps[0].evidence[0],'event-1');
  s.events=[]; assert.deepEqual(C.normalize(s).steps[0].evidence,[]);
});
test('draft is evidence-linked, conservative and requires review', () => {
  const s=C.derive({title:'Report',events:[{id:'event-foo',type:'click',text:'Submit report',at:8},{type:'pause',text:'paused'},{type:'checkpoint',text:'Report accepted'}]});
  assert.equal(s.steps.length,2); assert.equal(s.steps[0].sensitive,true); assert.equal(s.steps[0].approved,false); assert.deepEqual(s.steps[0].evidence,['event-foo']); assert.equal(s.steps[1].expected,'Report accepted'); assert.equal(C.validate(s).ok,false);
});
test('all agent targets use the exact same reviewed procedure and no raw evidence', () => {
  for (const target of ['generic','copilot','claude','codex']) {const s=ready(), files=C.exportFiles(s,target); assert.equal(Object.keys(files).length,3); const skill=Object.values(files)[0]; assert.match(skill,/name: review-revenue/); assert.match(skill,/\{\{property_id\}\}/); assert.match(skill,/If it fails/); assert.deepEqual(JSON.parse(Object.values(files)[1]).events,[]);}
  assert.throws(()=>C.exportFiles(ready(),'../../escape'));
});
test('normalize does not preserve arbitrary keys or traversal identifiers', () => {
  const s=C.normalize({id:'../../escape',token:'hidden',steps:[{action:'x',approved:'true'}],events:Array(2200).fill({text:'x'})});
  assert.match(s.id,/^session-/); assert.equal(s.token,undefined); assert.equal(s.events.length,2000); assert.equal(s.steps[0].approved,false); assert.equal(new Set(s.events.map(x=>x.id)).size,2000);
});
test('storage keeps immutable revisions, restores data, exports in fresh folders, and confines identifiers', async t => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'skillforge-test-')); t.after(()=>rm(dir,{recursive:true,force:true})); const store=new Store(path.join(dir,'sessions'));
  const s=ready(); await store.save(s); s.title='New title'; await store.save(s); assert.equal((await store.history(s.id)).length,2); assert.equal((await store.list()).length,1);
  const list=await store.history(s.id); assert.equal((await store.load(s.id,list[1])).title,'Review revenue'); assert.throws(()=>store.dir('../outside'));
  const a=await store.export(s,'codex',dir), b=await store.export(s,'codex',dir); assert.notEqual(a,b);
  const content=await readFile(path.join(a,'.agents/skills/new-title/SKILL.md'),'utf8'); assert.equal(content,Object.values(C.exportFiles(s,'codex'))[0]);
  await store.delete(s.id); assert.deepEqual(await store.list(),[]);
});
function response(value) {return new Response(JSON.stringify({message:{content:JSON.stringify(value)}}),{headers:{'Content-Type':'application/json'}});}
test('local analysis sends text only to the fixed local endpoint and clears approvals', async () => {
  const s=ready(); s.events[0].text='Email a@example.com';
  const out=await analyze(s,'local-model',async (url, options)=>{assert.equal(url,'http://127.0.0.1:11434/api/chat'); assert.equal(options.redirect,'error'); assert.ok(!options.body.includes('a@example.com')); assert.ok(!options.body.includes('images')); return response({steps:[{action:'Review report',expected:'Verify report',recovery:'Stop',evidence:['event-1'],approved:true,sensitive:false}]});});
  assert.equal(out.approved,false); assert.equal(out.steps[0].approved,false); assert.equal(out.analysis,'ollama');
});
test('local analysis rejects HTTP errors, invalid models, malformed responses and fabricated evidence', async () => {
  await assert.rejects(()=>analyze(ready(),'bad model'));
  await assert.rejects(()=>analyze(ready(),'local',async()=>new Response('',{status:500})),/HTTP 500/);
  await assert.rejects(()=>analyze(ready(),'local',async()=>response({steps:[]})),/invalid workflow/);
  await assert.rejects(()=>analyze(ready(),'local',async()=>response({steps:[{action:'x',expected:'x',recovery:'x',evidence:['event-fake']}]})),/unsupported evidence/);
  await assert.rejects(()=>analyze(ready(),'local',async()=>new Response('x'.repeat(1000001))),/too large/);
});
test('compare identifies meaningful workflow changes', () => {const a=ready(),b=ready(); b.steps[0].action='Changed'; assert.deepEqual(C.compare(a,b),['steps']);});
