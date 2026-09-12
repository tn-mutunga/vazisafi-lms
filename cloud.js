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
  let session = read(SESSION_KEY);
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
      lastBackup: cfg.lastBackup || null
    };
  }

  function base() { return String(cfg.url || '').replace(/\/+$/, ''); }

  function headers(auth = true) {
    const h = { 'apikey': cfg.anonKey, 'Content-Type': 'application/json' };
    if (auth && session?.access_token) h['Authorization'] = 'Bearer ' + session.access_token;
    return h;
  }

  async function call(path, opts = {}) {
    if (!cfg.url || !cfg.anonKey) throw new Error('Not configured');
    if (!navigator.onLine) throw new Error('No internet connection');
    const res = await fetch(base() + path, { ...opts, headers: { ...headers(opts.auth !== false), ...(opts.headers || {}) } });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) throw new Error((body && (body.msg || body.message || body.error_description || body.error)) || `HTTP ${res.status}`);
    return body;
  }

  const API = {
    status,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    getConfig() { return { ...cfg }; },
    setConfig(patch) {
      cfg = { ...cfg, ...patch };
      write(CFG_KEY, cfg);
      emit();
      return { ...cfg };
    },

    // Reachability check that does not need a login — asks the REST root for its schema.
    async test() {
      if (!cfg.url || !cfg.anonKey) throw new Error('Enter the project URL and anon key first');
      await call('/rest/v1/', { method: 'GET', auth: false });
      return true;
    },

    async signIn(email, password) {
      const body = await call('/auth/v1/token?grant_type=password', {
        method: 'POST', auth: false, body: JSON.stringify({ email, password })
      });
      session = body;
      write(SESSION_KEY, session);
      emit();
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
        body: JSON.stringify({ device: deviceName || 'unnamed', payload })
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
    }
  };

  window.addEventListener('online', emit);
  window.addEventListener('offline', emit);

  window.SAFI_CLOUD = API;
})();
