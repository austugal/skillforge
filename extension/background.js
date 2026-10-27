'use strict';
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  queue = queue.then(async () => {
    const {capture} = await chrome.storage.session.get('capture');
    if (message.type === 'event') {
      if (!capture || capture.tabId !== sender.tab?.id || sender.frameId !== 0) return;
      if (capture.events.length >= 2000) return;
      let url = ''; try {const parsed = new URL(sender.url); if (['https:', 'http:'].includes(parsed.protocol)) url = parsed.origin + parsed.pathname;} catch {}
      capture.events.push({id: `event-${crypto.randomUUID()}`, at: Date.now() - capture.started, type: 'click', text: String(message.text || '').slice(0,160), url});
      await chrome.storage.session.set({capture}); return;
    }
    if (sender.tab || sender.url !== chrome.runtime.getURL('popup.html')) return;
    if (message.type === 'start') {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab?.id || !/^https?:/.test(tab.url || '')) throw Error('Open an HTTP or HTTPS page first.');
      if (capture) throw Error('Stop the current capture before starting another.');
      await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['content.js']});
      const u = new URL(tab.url);
      await chrome.storage.session.set({capture: {tabId: tab.id, started: Date.now(), title: 'Browser workflow', events: [{id: 'event-1', type: 'navigation', at: 0, text: 'Open the selected browser page', url: u.origin + u.pathname}]}});
      return {ok: true};
    }
    if (message.type === 'stop') {
      if (!capture) throw Error('No active capture.');
      await chrome.storage.session.remove('capture'); return {ok: true, session: {schemaVersion: 1, title: capture.title, events: capture.events, steps: []}};
    }
    if (message.type === 'status') return {ok:true, active: Boolean(capture), count: capture?.events.length || 0};
  }).then(result => respond(result || {ok: true}), error => respond({ok: false, error: error.message}));
  return true;
});
