'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {selectedFrames,readFrame}=require('../src/frames.cjs');
const {Store}=require('../src/storage.cjs');
const {analyze}=require('../src/analyzer.cjs');
const {parseTranscript}=require('../src/transcript.cjs');
const C=require('../src/core.cjs');
test('visual evidence requires explicit request and per-frame approval',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sf-vision-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const store=new Store(root);
 const name='frame-12345678-1234-1234-1234-123456789abc.jpg';await fs.mkdir(store.dir('session-test'));await fs.writeFile(path.join(store.dir('session-test'),name),Buffer.from([255,216,255,217]));
 const s=C.normalize({id:'session-test',events:[{id:'event-frame',type:'frame',frame:name,imageApproved:false,at:1000,text:'Observed report'}]});
 assert.deepEqual(await selectedFrames(store,s,false),[]);await assert.rejects(()=>selectedFrames(store,s,true),/Select at least/);
 s.events[0].imageApproved=true;const frames=await selectedFrames(store,s,true);assert.equal(frames.length,1);
 let sent;
 const result=await analyze(s,'local-vision',async(url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({message:{content:JSON.stringify({steps:[{action:'Read report',expected:'Verify date',recovery:'Stop',evidence:['event-frame']}]})}}));},frames);
 assert.equal(sent.messages.at(-1).images[0],frames[0].image);assert.match(sent.messages.at(-1).content,/event-frame/);assert.equal(result.analysis,'ollama-vision');assert.equal(result.steps[0].approved,false);
 s.events[0].imageApproved=false;await assert.rejects(()=>analyze(s,'local-vision',fetch,frames),/unapproved/);
 await assert.rejects(()=>readFrame(store,s.id,'../secret'),/Invalid frame/);
 const large={...s,events:Array.from({length:13},(_,i)=>({...s.events[0],id:`event-${i}`,imageApproved:true}))};await assert.rejects(()=>selectedFrames(store,large,true),/at most 12/);
});
test('subtitle import preserves timestamps and strips markup',()=>{
 assert.deepEqual(parseTranscript('WEBVTT\n\n00:01.000 --> 00:02.500\n<b>Inspect</b> report\n'),[{at:1000,text:'Inspect report'}]);
 assert.equal(parseTranscript('1\n01:02:03,456 --> 01:02:04,999\nCheck\n')[0].at,3723456);
 assert.throws(()=>parseTranscript('1\n00:00:05,000 --> 00:00:04,000\nBad'),/before/);
 assert.throws(()=>parseTranscript('No subtitles'),/No SRT/);
 assert.throws(()=>parseTranscript('x'.repeat(500001)),/limit/);
});
