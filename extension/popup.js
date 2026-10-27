'use strict';
const start = document.getElementById('start'), stop = document.getElementById('stop'), status = document.getElementById('status');
async function request(type) {const result = await chrome.runtime.sendMessage({type}); if (!result?.ok) throw Error(result?.error || 'Extension unavailable.'); return result;}
async function refresh() {const result = await request('status'); start.disabled = result.active; stop.disabled = !result.active; status.textContent = result.active ? `Capturing · ${result.count} events` : 'Capture stopped';}
start.onclick = async () => {try {await request('start'); await refresh();} catch (e) {status.textContent = e.message;}};
stop.onclick = async () => {try {const result = await request('stop'); const url = URL.createObjectURL(new Blob([JSON.stringify(result.session, null, 2)], {type:'application/json'})); const link = document.createElement('a'); link.href = url; link.download = 'skillforge-browser-session.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); await refresh(); status.textContent = 'Export requested. Import the JSON into SkillForge.';} catch (e) {status.textContent = e.message;}};
refresh().catch(e => status.textContent = e.message);
