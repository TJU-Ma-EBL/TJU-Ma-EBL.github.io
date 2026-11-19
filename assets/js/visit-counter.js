/* Footer visitor stats powered by the Abacus counter API (https://abacus.jasoncameron.dev).
   The site is fully static, so counts live server-side at Abacus under one namespace.
   - Total: one "hit" per page load on the shared key `visits`.
   - Online: minute-bucketed keys (`online-YYYYMMDDHHMM`). Each visible tab hits the current
     minute bucket on load and every 60s while it stays in the foreground. Because a tab
     contributes at most one hit per minute bucket, the value of the current bucket is a
     good estimate of how many people are reading the page right now. When a tab closes,
     it simply stops hitting, so the number self-corrects within a minute — no decrement
     endpoint needed (Abacus requires an admin key for that).
   Any request failure keeps that part hidden, so the page never shows "NaN". */
(() => {
  const NAMESPACE = 'malab-tju';
  const API = 'https://abacus.jasoncameron.dev';
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

  // Abacus replies with { "value": N }; treat anything else as a failure.
  const request = (path, options) =>
    fetch(`${API}${path}`, options)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
      .then(j => (typeof j?.value === 'number' ? j.value : Promise.reject(new Error('bad payload'))))
      .catch(() => null);

  const show = (el, text) => {
    el.textContent = text;
    el.hidden = false;
    wrap.hidden = false;
    // Only print the middle dot once both numbers have arrived.
    if (sepEl && !totalEl.hidden && !onlineEl.hidden) sepEl.hidden = false;
  };

  request(`/hit/${NAMESPACE}/visits`).then(value => {
    if (value === null) return;
    show(totalEl, `已有 ${value.toLocaleString('en-US')} 位访客`);
  });

  const pingOnline = () => {
    // Don't count background tabs, and refresh the shown number each heartbeat.
    if (document.hidden) return;
    request(`/hit/${NAMESPACE}/${minuteBucket()}`).then(value => {
      if (value === null) return;
      show(onlineEl, `${Math.max(value, 1).toLocaleString('en-US')} 人正在访问`);
    });
  };
  pingOnline();
  setInterval(pingOnline, HEARTBEAT_MS);
})();
