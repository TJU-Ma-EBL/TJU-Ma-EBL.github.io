/* Footer visit counter powered by the Abacus API (https://abacus.jasoncameron.dev).
   The site is fully static, so the count lives server-side at Abacus under one namespace.
   Only a total-visit number is shown now: the earlier live "online" estimate needed a
   per-minute heartbeat to this overseas endpoint, which is slow/unreachable from mainland
   China, so it was dropped. Resilience for the remaining single request:
   - Abort after a timeout so a hanging connection never blocks the footer.
   - Cache the last good total in localStorage and paint it immediately, so returning
     visitors still see a number even when the network is slow or blocked. */
(() => {
  const NAMESPACE = 'malab-tju';
  const KEY = 'visits';
  const API = `https://abacus.jasoncameron.dev/hit/${NAMESPACE}/${KEY}`;
  const CACHE = 'malab-tju:visits';
  const TIMEOUT_MS = 6000;

  // Skip the editor's iframe preview so editing does not inflate the count.
  if (window.self !== window.top) return;

  const wrap = document.getElementById('visit-stats');
  if (!wrap) return;
  const label = n => `已有 ${n.toLocaleString('en-US')} 位访客`;

  // 1) Paint any cached total right away.
  try {
    const cached = Number(localStorage.getItem(CACHE));
    if (Number.isFinite(cached) && cached > 0) {
      wrap.textContent = label(cached);
      wrap.hidden = false;
    }
  } catch { /* localStorage unavailable (e.g. private mode) — ignore */ }

  // 2) Refresh with the live count, but never hang past the timeout.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  fetch(API, { signal: ctrl.signal })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then(j => {
      if (typeof j?.value !== 'number') return;
      wrap.textContent = label(j.value);
      wrap.hidden = false;
      try { localStorage.setItem(CACHE, String(j.value)); } catch { /* ignore */ }
    })
    .catch(() => { /* offline/blocked: keep the cached value if there was one */ })
    .finally(() => clearTimeout(timer));
})();
