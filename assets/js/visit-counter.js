/* Footer visit stats powered by the Abacus API (https://abacus.jasoncameron.dev).
   The site is fully static, so the counts live server-side at Abacus under one namespace.
   - Total: one "hit" per page load on the shared key `visits`. The last good number is
     cached in localStorage and painted immediately, so returning visitors still see it
     even when the (overseas, slow-from-mainland-China) endpoint is unreachable.
   - Online: minute-bucketed keys (`online-YYYYMMDDHHMM`). Each visible tab hits the
     current minute bucket on load and every 60s while it stays in the foreground. A tab
     contributes at most one hit per minute bucket, so the current bucket's value is a
     good live estimate of how many people are reading the page right now. Closing a tab
     just stops the hits, so the number self-corrects within a minute — no decrement
     endpoint needed (Abacus removed the public /sub).
   Every request is aborted after a timeout so a hanging connection never blocks the
   footer; a failed part simply stays hidden. */
(() => {
  const NAMESPACE = 'malab-tju';
  const API = 'https://abacus.jasoncameron.dev';
  const CACHE = 'malab-tju:visits';
  const TIMEOUT_MS = 6000;
  const HEARTBEAT_MS = 60_000;

  // Skip the editor's iframe preview so editing does not inflate the counts.
  if (window.self !== window.top) return;

  const wrap = document.getElementById('visit-stats');
  const totalEl = document.getElementById('visit-total');
  const onlineEl = document.getElementById('visit-online');
  const sepEl = document.querySelector('.visit-sep');
  if (!wrap || !totalEl || !onlineEl) return;

  const pad = n => String(n).padStart(2, '0');
  const minuteBucket = () => {
    const d = new Date();
    return `online-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  };

  // Abacus replies with { "value": N }; anything else counts as a failure (null).
  const request = path => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    return fetch(`${API}${path}`, { signal: ctrl.signal })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(j => (typeof j?.value === 'number' ? j.value : Promise.reject(new Error('bad payload'))))
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  };

  const show = (el, text) => {
    el.textContent = text;
    el.hidden = false;
    wrap.hidden = false;
    // Only print the middle dot once both numbers have arrived.
    if (sepEl && !totalEl.hidden && !onlineEl.hidden) sepEl.hidden = false;
  };

  // 1) Total visits: paint cached number first, then refresh with the live count.
  try {
    const cached = Number(localStorage.getItem(CACHE));
    if (Number.isFinite(cached) && cached > 0) show(totalEl, `已有 ${cached.toLocaleString('en-US')} 位访客`);
  } catch { /* localStorage unavailable (e.g. private mode) — ignore */ }
  request(`/hit/${NAMESPACE}/visits`).then(value => {
    if (value === null) return;
    show(totalEl, `已有 ${value.toLocaleString('en-US')} 位访客`);
    try { localStorage.setItem(CACHE, String(value)); } catch { /* ignore */ }
  });

  // 2) Online: heartbeat the current minute bucket while the tab is in the foreground.
  const pingOnline = () => {
    if (document.hidden) return;
    request(`/hit/${NAMESPACE}/${minuteBucket()}`).then(value => {
      if (value === null) return;
      show(onlineEl, `${Math.max(value, 1).toLocaleString('en-US')} 人正在访问`);
    });
  };
  pingOnline();
  setInterval(pingOnline, HEARTBEAT_MS);
})();
