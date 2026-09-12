// Vazi Safi — Cloud & Updates (Management)
// Two things the owner needs from a distance: the books backed up off-site, and every
// till running the same version.
const { useState: useStateCl, useEffect: useEffectCl } = React;

function UpdatesCard() {
  const [st, setSt] = useStateCl({ state: 'idle' });
  const [checking, setChecking] = useStateCl(false);
  const desktop = !!(window.lms && window.lms.isDesktop);

  useEffectCl(() => {
    if (!desktop) return;
    window.lms.updateStatus().then(setSt).catch(() => {});
    window.lms.onUpdate(setSt);
  }, [desktop]);

  if (!desktop) {
    return (
      <Card title="App updates">
        <p className="safi-cell-sub" style={{ marginTop: 0 }}>
          You are running Vazi Safi in a browser, so there is nothing to update. The installed
          desktop app keeps itself current — download it from the releases page.
        </p>
      </Card>
    );
  }

  const label = {
    idle: 'Not checked yet',
    checking: 'Checking…',
    current: 'Up to date',
    available: `Version ${st.version} found — downloading`,
    downloading: `Downloading… ${st.percent || 0}%`,
    ready: `Version ${st.version} ready — restart to install`,
    error: st.message || 'Could not check',
    dev: 'Running from source — updates apply to installed copies only',
    unavailable: 'Updates not available in this build'
  }[st.state] || st.state;

  return (
    <Card title="App updates">
      <div className="safi-store-info">
        <div><span>Status</span><b>{label}</b></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button kind="primary" icon="refresh" disabled={checking} onClick={() => {
          setChecking(true);
          Promise.resolve(window.lms.checkUpdate()).finally(() => setTimeout(() => setChecking(false), 1500));
        }}>{checking ? 'Checking…' : 'Check for updates'}</Button>
      </div>
      <p className="safi-hint" style={{ marginBottom: 0 }}>
        The app also checks on its own every few hours and downloads quietly in the background.
        It never interrupts a sale — you choose when to restart.
      </p>
    </Card>
  );
}

function CloudCard() {
  const [st, setSt] = useStateCl(window.SAFI_CLOUD.status());
  const [cfg, setCfg] = useStateCl(window.SAFI_CLOUD.getConfig());
  const [email, setEmail] = useStateCl('');
  const [pw, setPw] = useStateCl('');
  const [busy, setBusy] = useStateCl('');
  const [backups, setBackups] = useStateCl(null);

  useEffectCl(() => window.SAFI_CLOUD.subscribe(setSt), []);

  const run = (key, fn, okMsg) => {
    setBusy(key);
    Promise.resolve().then(fn)
      .then(() => { if (okMsg) toast(okMsg, 'success'); })
      .catch(e => toast(e.message || String(e), 'error'))
      .finally(() => setBusy(''));
  };

  return (
    <>
      <Card title="Cloud connection">
        <p className="safi-cell-sub" style={{ marginTop: 0 }}>
          Connect a Supabase project and the books can be backed up off-site and reached from
          another device. Until you connect one, everything stays on this laptop and nothing changes.
        </p>
        <div className="safi-form" style={{ maxWidth: 620 }}>
          <label>Project URL
            <input className="safi-input" value={cfg.url} placeholder="https://xxxxx.supabase.co"
              onChange={e => setCfg({ ...cfg, url: e.target.value.trim() })}/>
          </label>
          <label>Anon public key
            <input className="safi-input safi-mono" value={cfg.anonKey} placeholder="eyJhbGciOi…"
              onChange={e => setCfg({ ...cfg, anonKey: e.target.value.trim() })}/>
          </label>
          <p className="safi-hint">Both are in Supabase → Project Settings → API. The anon key is meant to be public.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Button kind="primary" icon="check" onClick={() => run('save', () => { window.SAFI_CLOUD.setConfig(cfg); }, 'Connection saved')}>Save</Button>
          <Button kind="ghost" icon="refresh" disabled={busy === 'test'}
            onClick={() => run('test', async () => { window.SAFI_CLOUD.setConfig(cfg); await window.SAFI_CLOUD.test(); }, 'Reached the database')}>
            {busy === 'test' ? 'Testing…' : 'Test connection'}
          </Button>
        </div>
        <div className="safi-store-info" style={{ marginTop: 14 }}>
          <div><span>Status</span><b>{!st.configured ? 'Not connected' : st.signedIn ? `Signed in as ${st.email}` : 'Connected — not signed in'}</b></div>
          <div><span>Internet</span><b>{st.online ? 'Online' : 'Offline — the app still works'}</b></div>
          <div><span>Last cloud backup</span><b>{st.lastBackup ? new Date(st.lastBackup).toLocaleString() : 'Never'}</b></div>
        </div>
      </Card>

      {st.configured && (
        <Card title="Sign in">
          {st.signedIn ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span className="safi-cell-sub">Signed in as <b>{st.email}</b></span>
              <Button kind="ghost" onClick={() => run('out', () => window.SAFI_CLOUD.signOut(), 'Signed out')}>Sign out</Button>
            </div>
          ) : (
            <>
              <div className="safi-form" style={{ maxWidth: 420 }}>
                <label>Email
                  <input className="safi-input" type="email" value={email} autoComplete="username" onChange={e => setEmail(e.target.value)}/>
                </label>
                <label>Password
                  <input className="safi-input" type="password" value={pw} autoComplete="current-password"
                    onChange={e => setPw(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && email && pw) run('in', () => window.SAFI_CLOUD.signIn(email, pw), 'Signed in'); }}/>
                </label>
                <p className="safi-hint">Create the account in Supabase → Authentication → Users.</p>
              </div>
              <Button kind="primary" icon="lock" disabled={busy === 'in' || !email || !pw} onClick={() => run('in', () => window.SAFI_CLOUD.signIn(email, pw), 'Signed in')}>
                {busy === 'in' ? 'Signing in…' : 'Sign in'}
              </Button>
            </>
          )}
        </Card>
      )}

      {st.signedIn && (
        <Card title="Cloud backup">
          <p className="safi-cell-sub" style={{ marginTop: 0 }}>
            Sends a full snapshot to the <span className="safi-mono">backups</span> table. Do this at
            the end of the day, or before changing anything big.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button kind="primary" icon="box" disabled={busy === 'push'}
              onClick={() => run('push', () => window.SAFI_CLOUD.pushBackup(navigator.platform), 'Backed up to the cloud')}>
              {busy === 'push' ? 'Sending…' : 'Back up now'}
            </Button>
            <Button kind="ghost" icon="list" disabled={busy === 'list'}
              onClick={() => run('list', async () => { setBackups(await window.SAFI_CLOUD.listBackups()); })}>Show cloud backups</Button>
          </div>
          {backups && (
            <Table
              cols={[
                { label: 'When', render: b => new Date(b.created_at).toLocaleString() },
                { label: 'Device', render: b => b.device || '—' },
                { label: '', render: b => (
                  <button className="safi-rowlink" onClick={() => {
                    if (!window.confirm('Replace everything on this laptop with that backup?')) return;
                    run('pull', () => window.SAFI_CLOUD.pullBackup(b.id), 'Restored from cloud');
                  }}>Restore</button>
                )}
              ]}
              rows={backups}
              empty="No cloud backups yet."
            />
          )}
        </Card>
      )}

      <Card title="Setting up Supabase">
        <ol className="safi-form" style={{ gap: 6, paddingLeft: 18 }}>
          <li>Create a free project at supabase.com.</li>
          <li>Project Settings → API: copy the URL and anon key into the fields above.</li>
          <li>SQL Editor: run the snippet below to create the backups table.</li>
          <li>Authentication → Users: add yourself, then sign in above.</li>
        </ol>
        <pre className="safi-code">{`create table backups (
  id bigserial primary key,
  device text,
  created_at timestamptz default now(),
  payload jsonb not null
);

alter table backups enable row level security;

create policy "signed in users" on backups
  for all to authenticated
  using (true) with check (true);`}</pre>
      </Card>
    </>
  );
}

function CloudScreen() {
  return (
    <>
      <Topbar title="Cloud & Updates" subtitle="Off-site backup, and keeping every till on the same version."/>
      <UpdatesCard/>
      <CloudCard/>
    </>
  );
}

Object.assign(window, { CloudScreen, CloudCard, UpdatesCard });
