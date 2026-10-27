'use strict';
// Injection only follows the user's explicit Start action in this tab.
if (!window.__skillforgeEvidenceInstalled) {
  window.__skillforgeEvidenceInstalled = true;
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const target = event.target instanceof Element ? event.target.closest('button,a,input,select,[role="button"]') : null;
    if (!target || target.closest('[data-skillforge-private],[data-private]')) return;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return; // Never inspect values or form contents.
    const label = (target.getAttribute('aria-label') || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!label || /password|secret|token|api.?key|sign.?in|log.?in/i.test(label)) return;
    // Labels can still contain sensitive information. Redact common patterns and review in SkillForge.
    const safe = label.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]').replace(/\b(?:gh[pousr]_|sk-)[A-Za-z0-9_-]{16,}\b/g, '[REDACTED TOKEN]');
    chrome.runtime.sendMessage({type:'event', text: `Click ${safe}`}).catch(() => {});
  }, true);
}
