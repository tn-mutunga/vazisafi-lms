// Vazi Safi — cloud connection (Supabase, or any PostgREST-compatible host).
//
// Deliberately dependency-free: Supabase's REST and auth endpoints are plain HTTPS,
// so the whole client is fetch calls. No SDK to vendor, nothing extra to ship, and it
// still works when the shop is offline (every call simply reports "offline" and the
// app carries on against localStorage as before).
//
// What this does today: holds the connection, signs the owner in, and pushes/pulls a
// full data snapshot to one `backups` table. That is the useful half of cloud sync and
// it needs only one table. Per-table live sync comes with the full schema.

(function () {
  const CFG_KEY = 'safi.cloud.config';
  const SESSION_KEY = 'safi.cloud.session';

  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch { return null; } };
  const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  let cfg = read(CFG_KEY) || { url: '', anonKey: '', autoBackup: true };
  if (cfg.branch === undefined)   cfg.branch = 'main';
  if (cfg.liveSync === undefined) cfg.liveSync = false;
  let session = read(SESSION_KEY);
  let signedOutReason = '';
  const listeners = new Set();

  function emit() { listeners.forEach(fn => { try { fn(status()); } catch {} }); }

  function status() {
    return {
      configured: !!(cfg.url && cfg.anonKey),
      signedIn: !!(session && session.access_token),
      email: session?.user?.email || null,
      url: cfg.url,
      autoBackup: !!cfg.autoBackup,
      online: navigator.onLine,
      lastBackup: cfg.lastBackup || null,
      lastCloudOrders: cfg.lastCloudOrders != null ? cfg.lastCloudOrders : null,
      branch: cfg.branch || 'main',
      liveSync: !!cfg.liveSync,
      lastSync: cfg.lastSync || null,
      syncing: syncing,
      syncError: syncError,
      signedOutReason: signedOutReason,
      email: cfg.email || '',
      needsSetup: !!(window.SAFI_SYNC && !window.SAFI_SYNC.isSetup()),
      refusedDeletes: cfg.lastRefusedDeletes || 0
    };
  }

  let syncing = false;
  let syncError = null;

  function base() { return String(cfg.url || '').replace(/\/+$/, ''); }

  function headers(auth = true) {
    const h = { 'apikey': cfg.anonKey, 'Content-Type': 'application/json' };
    if (auth && session?.access_token) h['Authorization'] = 'Bearer ' + session.access_token;
    return h;
  }

  async function callRaw(path, opts = {}) {
    if (!cfg.url || !cfg.anonKey) throw new Error('Not configured');
    if (!navigator.onLine) throw new Error('No internet connection');
    if (opts.auth !== false) await ensureFresh();
    const go = () => fetch(base() + path, { ...opts, headers: { ...headers(opts.auth !== false), ...(opts.headers || {}) } });
    let res = await go();
    // A token can expire between the check and the request (a laptop lid closed
    // for an hour, say). Renew once and retry before giving up.
    if (res.status === 401 && opts.auth !== false && session?.refresh_token) {
      if (await refresh()) res = await go();
    }
    return res;
  }

  // ── Session renewal ─────────────────────────────────────────────────
  // Supabase access tokens last an hour. The refresh token that comes with them
  // lasts until sign-out, so a till signed in once stays signed in.
  let refreshing = null;
  function expiresAt() {
    if (!session) return 0;
    if (session.expires_at) return session.expires_at * 1000;
    if (session.expires_in && session.issued_at) return session.issued_at + session.expires_in * 1000;
    return 0;
  }
  async function refresh() {
    if (!session?.refresh_token) return false;
    if (refreshing) return refreshing;
    const sent = session.refresh_token;
    refreshing = (async () => {
      try {
        const res = await fetch(base() + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', headers: headers(false),
          body: JSON.stringify({ refresh_token: session.refresh_token })
        });
        if (!res.ok) {
          // Another window or an earlier attempt may already have swapped the token
          // (each one can be used once). If storage holds a newer session, use it.
          const stored = read(SESSION_KEY);
          if (stored && stored.refresh_token && stored.refresh_token !== sent) { session = stored; emit(); return true; }
          let msg = '';
          try { msg = (await res.json()).error_description || ''; } catch (e) {}
          // Only a token the server says is gone ends the sign-in. Anything else
          // (server busy, network blip) is retried on the next cycle.
          if ((res.status === 400 || res.status === 401) && /not found|revoked|invalid/i.test(msg) && !/already used/i.test(msg)) {
            session = null; write(SESSION_KEY, null); signedOutReason = 'Cloud sign-in expired. Sign in again to resume sync.'; emit();
          }
          return false;
        }
        const body = await res.json();
        session = { ...body, issued_at: Date.now() };
        write(SESSION_KEY, session);
        emit();
        return true;
      } catch { return false; }
      finally { refreshing = null; }
    })();
    return refreshing;
  }
  async function ensureFresh() {
    if (!session?.refresh_token) return;
    const at = expiresAt();
    if (!at || at - Date.now() < 120000) await refresh();
  }

  async function call(path, opts = {}) {
    const res = await callRaw(path, opts);
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) throw new Error((body && (body.msg || body.message || body.error_description || body.error)) || `HTTP ${res.status}`);
    return body;
  }

  const API = {
    status,
    raw: call,
    rawResponse: callRaw,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    getConfig() { return { ...cfg }; },
    setConfig(patch) {
      cfg = { ...cfg, ...patch };
      write(CFG_KEY, cfg);
      if (window.SAFI_SYNC) window.SAFI_SYNC.setBranch(cfg.branch);
      emit();
      return { ...cfg };
    },

    // Reachability check that does not need a login. The REST root is off-limits to
    // the new publishable keys (it lists the whole schema), so ask the auth service
    // instead — it answers any valid key and rejects a wrong one.
    async test() {
      if (!cfg.url || !cfg.anonKey) throw new Error('Enter the project URL and anon key first');
      await call('/auth/v1/settings', { method: 'GET', auth: false });
      return true;
    },

    async signIn(email, password) {
      const body = await call('/auth/v1/token?grant_type=password', {
        method: 'POST', auth: false, body: JSON.stringify({ email, password })
      });
      session = { ...body, issued_at: Date.now() };
      write(SESSION_KEY, session);
      signedOutReason = '';
      API.setConfig({ email });
      emit();
      // Back in: pick up straight away rather than waiting for the next change.
      schedule(800);
      return status();
    },

    async signOut() {
      try { await call('/auth/v1/logout', { method: 'POST' }); } catch {}
      session = null;
      write(SESSION_KEY, null);
      emit();
    },

    // Push a full snapshot. Table `backups`: id bigserial, device text, created_at timestamptz
    // default now(), payload jsonb.
    async pushBackup(deviceName) {
      if (!session) throw new Error('Sign in first');
      const payload = JSON.parse(window.SAFI_STORE.snapshot());
      await call('/rest/v1/backups', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          device: deviceName || 'unnamed',
          branch_id: cfg.branch || 'main',
          app_version: (window.lms && window.lms.version) || '',
          payload
        })
      });
      API.setConfig({ lastBackup: new Date().toISOString() });
      return true;
    },

    async listBackups() {
      if (!session) throw new Error('Sign in first');
      return await call('/rest/v1/backups?select=id,device,created_at&order=created_at.desc&limit=20');
    },

    async pullBackup(id) {
      if (!session) throw new Error('Sign in first');
      const rows = await call(`/rest/v1/backups?select=payload&id=eq.${encodeURIComponent(id)}`);
      if (!rows || !rows.length) throw new Error('Backup not found');
      return window.SAFI_STORE.importJSON(JSON.stringify(rows[0].payload));
    },

    // ── Live sync ────────────────────────────────────────────────────
    // When on, every local change queues a push a few seconds later. Batched
    // deliberately: a busy counter fires a dozen writes a minute and the shop's
    // connection should not carry a request for each one.
    setLiveSync(on) {
      API.setConfig({ liveSync: !!on });
      if (on) schedule(1500);
      return status();
    },

    async joinSync(mode) {
      if (!session) throw new Error('Sign in first');
      syncing = true; syncError = null; emit();
      try {
        window.SAFI_SYNC.setBranch(cfg.branch);
        return mode === 'cloud' ? await window.SAFI_SYNC.setupFromCloud() : await window.SAFI_SYNC.setupAsMaster();
      } catch (e) { syncError = e.message || String(e); throw e; }
      finally { syncing = false; emit(); }
    },

    async syncNow() {
      if (!session) throw new Error('Sign in first');
      if (!window.SAFI_SYNC) throw new Error('Sync module not loaded');
      syncing = true; syncError = null; emit();
      try {
        window.SAFI_SYNC.setBranch(cfg.branch);
        const report = await window.SAFI_SYNC.sync();
        syncError = null;
        return report;
      } catch (e) {
        syncError = e.message || String(e);
        throw e;
      } finally { syncing = false; emit(); }
    }
  };

  // ── Debounced background push ──────────────────────────────────────
  let timer = null;
  let retryStep = 0;
  function schedule(ms) {
    if (!cfg.liveSync || !session || !navigator.onLine) return;
    clearTimeout(timer);
    // A failed attempt (Wi-Fi still connecting at start-up, a dropped line) retries
    // on its own after 30 s, then 1, 2 and 5 minutes, instead of waiting for a change.
    timer = setTimeout(() => {
      API.syncNow().then(() => { retryStep = 0; }).catch(() => {
        const waits = [30000, 60000, 120000, 300000];
        schedule(waits[Math.min(retryStep++, waits.length - 1)]);
      });
    }, ms);
  }

  // Subscribe once the store exists.
  setTimeout(() => {
    if (window.SAFI_STORE) window.SAFI_STORE.subscribe(() => schedule(60000));
    if (window.SAFI_SYNC) window.SAFI_SYNC.setBranch(cfg.branch);
  }, 0);

  // Fetch other laptops' changes even when nobody is typing here.
  // Every 10 minutes (plus on open, on wake, when the internet returns and on close).
  setInterval(() => schedule(0), 600000);
  window.addEventListener('beforeunload', () => { try { if (cfg.liveSync && session && navigator.onLine) API.syncNow().catch(() => {}); } catch (e) {} });
  // Renew the sign-in in the background every 30 minutes, so a till left open (or
  // reopened the next morning) never finds an expired token at the counter.
  setInterval(() => { if (session && navigator.onLine) ensureFresh().catch(() => {}); }, 1800000);
  // On opening the app: renew, then sync.
  setTimeout(() => { if (session && navigator.onLine) ensureFresh().then(() => schedule(1500)).catch(() => {}); }, 2000);
  // Waking from sleep shows up as the window becoming visible again.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && session && navigator.onLine) ensureFresh().then(() => schedule(1500)).catch(() => {}); });

  // Coming back online after a spell offline is the moment the cloud is most stale.
  window.addEventListener('online', () => schedule(3000));

  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);

  window.SAFI_CLOUD = API;
})();
