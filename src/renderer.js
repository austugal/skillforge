'use strict';
const C = window.SkillForge, api = window.desktop, $ = id => document.getElementById(id);
let current = fresh(), recorder = null, stream = null, recordingState = 'idle', timer = null, elapsed = 0, started = 0, chunkQueue = Promise.resolve(), chunkError = null, previewUrl = null;
function fresh() {return C.normalize({id: `session-${crypto.randomUUID()}`, title: '', events: [], steps: []});}
function el(tag, options = {}, children = []) {const n = document.createElement(tag); for (const [k, v] of Object.entries(options)) {if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'checked' || k === 'disabled') n[k] = v; else n.setAttribute(k, v);} for (const child of children) n.append(child); return n;}
function message(text, error = false) {$('notice').textContent = text; $('notice').style.color = error ? '#ffb2aa' : '';}
function run(fn) {return async (...args) => {try {await fn(...args);} catch (e) {message(e.message || String(e), true);}};}
function changed(step) {current.approved = false; if (step) step.approved = false; updateReview();}
function field(label, value, fn, multiline = false) {const input = el(multiline ? 'textarea' : 'input', {'aria-label': label, maxlength: '2000'}); input.value = value; input.addEventListener('input', () => fn(input.value)); return el('label', {text: label}, [input]);}
function button(text, fn, disabled = false) {return el('button', {text, onclick: run(fn), disabled});}
function time(ms) {return `${String(Math.floor(ms / 60000)).padStart(2,'0')}:${String(Math.floor(ms / 1000) % 60).padStart(2,'0')}`;}
function tab(name) {document.querySelectorAll('.panel').forEach(n => n.classList.toggle('active', n.id === name)); document.querySelectorAll('[data-tab]').forEach(n => n.classList.toggle('active', n.dataset.tab === name)); if (name === 'history') run(renderHistory)(); updateReview();}
function render() {
  for (const id of ['title', 'description', 'preconditions']) $(id).value = current[id];
  renderTimeline(); renderParameters(); renderSteps(); updateReview();
}
function renderTimeline() {
  $('event-count').textContent = `${current.events.length} EVENTS`;
  const nodes = current.events.map((e, i) => el('div', {class: 'event'}, [el('time', {text: time(e.at)}), el('span', {text: e.type, class: 'kind'}), el('div', {text: `${e.text}${e.url ? ` · ${e.url}` : ''}`}), button('×', () => {
    current.events.splice(i, 1); current.steps.forEach(s => {s.evidence = s.evidence.filter(id => id !== e.id); s.approved = false;}); changed(); renderTimeline();
  })]));
  $('timeline').replaceChildren(...(nodes.length ? nodes : [el('div', {class: 'empty', text: 'Your actions and observations will appear here. Add notes or import browser evidence.'})]));
}
function addEvent(type, text) {
  if (current.events.length >= 2000) throw Error('Evidence limit reached: 2,000 events. Start another session.');
  current.events.push({id: `event-${crypto.randomUUID()}`, type, at: recordingState !== 'idle' ? elapsed + (recordingState === 'recording' ? Date.now() - started : 0) : elapsed, text: C.redact(text), url: ''});
  changed(); renderTimeline();
}
function renderParameters() {
  $('parameters').replaceChildren(...current.parameters.map((p, i) => {
    const name = el('input', {placeholder: 'parameter_name', 'aria-label': `Parameter ${i+1} name`, maxlength: '40'}); name.value = p.name;
    const description = el('input', {placeholder: 'What the agent must supply', 'aria-label': `Parameter ${i+1} description`, maxlength: '500'}); description.value = p.description;
    name.addEventListener('input', () => {p.name = name.value; current.steps.forEach(x => x.approved = false); changed();});
    description.addEventListener('input', () => {p.description = description.value; current.steps.forEach(x => x.approved = false); changed();});
    return el('div', {class: 'parameter'}, [name, description, button('×', () => {current.parameters.splice(i,1); current.steps.forEach(x => x.approved = false); changed(); renderParameters();})]);
  }));
}
function renderSteps() {
  $('steps').replaceChildren(...(current.steps.length ? current.steps.map((s, i) => {
    const check = el('input', {type: 'checkbox', checked: s.approved, 'aria-label': `Approve step ${i+1}`});
    check.addEventListener('change', () => {s.approved = check.checked; current.approved = false; updateReview();});
    const sensitive = el('input', {type: 'checkbox', checked: s.sensitive, 'aria-label': `Step ${i+1} requires authorization`});
    sensitive.addEventListener('change', () => {s.sensitive = sensitive.checked; changed(s); check.checked = false;});
    const edit = key => value => {s[key] = value; changed(s); check.checked = false;};
    const move = delta => {const j = i + delta; [current.steps[i], current.steps[j]] = [current.steps[j], current.steps[i]]; current.steps.forEach(x => x.approved = false); changed(); renderSteps();};
    return el('article', {class: 'step'}, [el('div', {class: 'step-top'}, [el('span', {class: 'step-number', text: `STEP ${String(i+1).padStart(2,'0')}`}), el('small', {text: `${s.evidence.length} evidence link${s.evidence.length === 1 ? '' : 's'}`}), el('div', {class: 'step-tools'}, [button('↑', () => move(-1), i === 0), button('↓', () => move(1), i === current.steps.length-1), button('Remove', () => {current.steps.splice(i,1); changed(); renderSteps();})])]),
      field('Action', s.action, edit('action'), true), el('div', {class: 'two-col'}, [field('Expected result / verification', s.expected, edit('expected'), true), field('Recovery if it fails', s.recovery, edit('recovery'), true)]),
      el('div', {class: 'step-bottom'}, [el('label', {class: 'checkbox'}, [sensitive, document.createTextNode('Requires authorization before execution')]), el('label', {class: 'checkbox'}, [check, document.createTextNode('Reviewed & approved')])])]);
  }) : [el('div', {class: 'empty', text: 'Build a draft from your evidence or add the first step.'})]));
}
function updateReview() {
  const result = C.validate(current), count = current.steps.filter(x => x.approved).length;
  $('score').replaceChildren(document.createTextNode(String(count)), el('span', {text: `/ ${current.steps.length} reviewed`}));
  $('progress').style.width = `${current.steps.length ? count / current.steps.length * 100 : 0}%`;
  $('readiness').textContent = result.ok ? 'Review complete. Ready to export.' : `${result.issues.length} authoring check${result.issues.length === 1 ? '' : 's'} remaining.`;
  $('approved').checked = current.approved;
  $('issues').replaceChildren(...result.issues.map(x => el('li', {text: x.message})));
  if (result.ok) $('issues').append(el('li', {text: 'All authoring checks passed.'}));
  $('export-button').disabled = !result.ok || recordingState !== 'idle';
  $('copy').disabled = !result.ok;
  if (result.ok) {const files = C.exportFiles(current, $('target').value); $('skill-preview').textContent = Object.values(files)[0];}
  else $('skill-preview').textContent = 'Resolve the checks above to prepare the exact export preview.';
}
async function renderSessions() {
  if (!api) return;
  const sessions = await api.list();
  $('sessions').replaceChildren(...sessions.map(s => el('button', {class: `session-item ${s.id === current.id ? 'selected' : ''}`, onclick: run(async () => {
    if (recordingState !== 'idle') throw Error('Finish recording before changing sessions.');
    await api.save(current); current = await api.load(s.id); render(); await renderSessions(); message('Session loaded. Previous work saved as a revision.');
  })}, [document.createTextNode(s.title || 'Untitled workflow'), el('small', {text: `${s.steps} steps · ${s.createdAt.slice(0,10)}`})])));
}
async function renderHistory() {
  if (!api) return;
  const list = await api.history(current.id);
  $('revisions').replaceChildren(...(list.length ? await Promise.all(list.map(async r => {
    const saved = await api.load(current.id, r); const diff = C.compare(saved, current);
    return el('div', {class: 'revision'}, [el('span', {text: new Date(Number(r.split('-')[0])).toLocaleString()}, [el('small', {text: diff.length ? `Different fields: ${diff.join(', ')}` : 'Matches the current workflow'})]), button('Restore', async () => {
      if (recordingState !== 'idle') throw Error('Finish recording before restoring a revision.');
      await api.save(current); current = C.normalize({...saved, approved: false, steps: saved.steps.map(x => ({...x, approved: false}))}); render(); message('Revision restored. Review is required again.'); await renderHistory();
    })]);
  })) : [el('div', {class: 'empty', text: 'Save a revision to start the history.'})]));
}
async function sources() {
  const list = await api.sources(); $('source').replaceChildren(el('option', {value: '', text: 'Select a screen or window'}), ...list.map(s => el('option', {value: s.id, text: s.name})));
}
function lock(active) {
  for (const id of ['new','import','source','refresh','microphone','record','delete','derive','analyze']) $(id).disabled = active;
  $('pause').disabled = !active; $('stop').disabled = !active; updateReview();
}
async function startRecording() {
  if (!api || !$('source').value) throw Error('Select a capture source first.');
  if (recordingState !== 'idle') return;
  let screenStream = null, micStream = null;
  try {
    await api.chooseSource($('source').value);
    screenStream = await navigator.mediaDevices.getDisplayMedia({video: {frameRate: 10, width: {ideal: 1280}, height: {ideal: 720}}, audio: false});
    if ($('microphone').checked) micStream = await navigator.mediaDevices.getUserMedia({audio: true, video: false});
    stream = new MediaStream([...screenStream.getVideoTracks(), ...(micStream ? micStream.getAudioTracks() : [])]);
    const mimeType = ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(x => MediaRecorder.isTypeSupported(x));
    if (!mimeType) throw Error('This runtime cannot encode WebM recording.');
    recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond: 1600000});
    await api.save(current); await api.recordStart(current.id); chunkQueue = Promise.resolve(); chunkError = null;
    recorder.ondataavailable = e => {if (!e.data.size) return; chunkQueue = chunkQueue.then(async () => {if (!chunkError) await api.recordChunk(new Uint8Array(await e.data.arrayBuffer()));}).catch(error => {chunkError = error; message(error.message, true); if (recorder?.state !== 'inactive') recorder.stop();});};
    recorder.onstop = run(async () => {
      stream.getTracks().forEach(t => t.stop()); clearInterval(timer); elapsed += recordingState === 'recording' ? Date.now() - started : 0;
      await chunkQueue;
      const info = await api.recordFinish(Boolean(chunkError));
      recorder = null; stream = null; recordingState = 'idle'; lock(false); $('pause').textContent = 'Pause'; $('record-state').textContent = 'SAVED'; $('preview').srcObject = null;
      await api.save(current); await renderSessions();
      message(chunkError ? `Recording discarded after storage error: ${chunkError.message}` : `Recording saved locally (${Math.round((info?.bytes || 0)/1024)} KB). Notes are ready to refine.` , Boolean(chunkError));
    });
    recorder.onerror = e => {chunkError = Error(e.error?.message || 'Recording failed.'); recorder.stop();};
    stream.getVideoTracks()[0].onended = () => {if (recorder?.state !== 'inactive') recorder.stop();};
    elapsed = 0; started = Date.now(); recordingState = 'recording'; $('preview').srcObject = stream; await $('preview').play();
    recorder.start(1000); lock(true); $('record-state').textContent = 'RECORDING';
    timer = setInterval(() => {const ms = elapsed + (recordingState === 'recording' ? Date.now()-started : 0); $('timer').textContent = time(ms); if (ms > 30*60*1000) recorder.stop();}, 300);
    message('Recording locally. Add evidence notes while you work.');
  } catch (error) {
    screenStream?.getTracks().forEach(t => t.stop()); micStream?.getTracks().forEach(t => t.stop());
    if (recorder && recorder.state !== 'inactive') recorder.stop(); else {await api.recordFinish(true); recorder = null; stream = null; recordingState = 'idle'; lock(false);} throw error;
  }
}
for (const n of document.querySelectorAll('[data-tab]')) n.addEventListener('click', () => tab(n.dataset.tab));
for (const id of ['title','description','preconditions']) $(id).addEventListener('input', () => {current[id] = $(id).value; current.steps.forEach(x => x.approved = false); changed(); renderSteps();});
$('new').onclick = run(async () => {if (api) await api.save(current); current = fresh(); elapsed = 0; $('timer').textContent = '00:00'; render(); tab('capture'); await renderSessions(); message('New local workflow.');});
$('save').onclick = run(async () => {await api.save(current); await renderSessions(); message('Revision saved.');});
$('backup').onclick = run(async () => {message(await api.backup(current) ? 'Session JSON saved. Recording is separate.' : 'Backup cancelled.');});
$('import').onclick = run(async () => {const incoming = await api.import(); if (!incoming) return; await api.save(current); current = C.normalize({...incoming, approved: false, steps: incoming.steps.map(x => ({...x, approved:false}))}); render(); tab('capture'); message('Imported a new session. Pattern-based redaction applied; inspect the evidence.');});
$('delete').onclick = run(async () => {if (await api.delete(current.id)) {current = fresh(); render(); await renderSessions(); message('Session deleted.');}});
$('refresh').onclick = run(sources);
$('record').onclick = run(startRecording);
$('pause').onclick = run(() => {if (recordingState === 'recording') {recorder.pause(); elapsed += Date.now() - started; recordingState = 'paused'; addEvent('pause','Recording paused'); $('pause').textContent = 'Resume'; $('record-state').textContent = 'PAUSED';} else if (recordingState === 'paused') {recorder.resume(); started = Date.now(); recordingState = 'recording'; addEvent('resume','Recording resumed'); $('pause').textContent = 'Pause'; $('record-state').textContent = 'RECORDING';}});
$('stop').onclick = () => {if (recorder && recorder.state !== 'inactive') recorder.stop();};
$('video-export').onclick = run(async () => {message(await api.recordingExport(current.id) ? 'Recording copied.' : 'Copy cancelled.');});
$('add-note').onclick = run(() => {if (!$('note').value.trim()) return; addEvent($('note-type').value, $('note').value); $('note').value = '';});
$('note').addEventListener('keydown', e => {if (e.key === 'Enter') $('add-note').click();});
$('derive').onclick = run(async () => {if (api) await api.save(current); current = C.derive(current); renderSteps(); updateReview(); tab('refine'); message('Draft created from text evidence. Add verification and recovery details before approval.');});
$('add-step').onclick = () => {current.steps.push({id:`step-${crypto.randomUUID()}`, action:'', expected:'', recovery:'', evidence:[], approved:false, sensitive:true}); changed(); renderSteps();};
$('add-parameter').onclick = () => {current.parameters.push({name:'', description:''}); changed(); renderParameters();};
$('analyze').onclick = run(async () => {
  $('analyze').disabled = true; message('Local model is analysing text evidence. This can take up to two minutes.');
  const snapshot = JSON.stringify(current);
  try {await api.save(current); const result = await api.analyze(current, $('model').value); if (JSON.stringify(current) !== snapshot) throw Error('The workflow changed during analysis. Suggestions were not applied; retry on the latest version.'); current = result; render(); message('Local AI suggestions ready. Review each step against the evidence.');}
  finally {$('analyze').disabled = false;}
});
$('approved').onchange = () => {current.approved = $('approved').checked; updateReview();};
$('target').onchange = updateReview;
$('export-button').onclick = run(async () => {const location = await api.export(current, $('target').value); if (location) {await api.save(current); $('export-location').textContent = location; message('Reviewed skill bundle exported.');} else message('Export cancelled.');});
$('copy').onclick = run(async () => {await navigator.clipboard.writeText($('skill-preview').textContent); message('Exact skill preview copied.');});
render();
if (api) run(async () => {await renderSessions(); await sources();})(); else message('Desktop bridge unavailable. Launch this application with npm start.', true);
