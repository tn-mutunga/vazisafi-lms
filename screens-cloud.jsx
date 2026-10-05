// Vazi Safi — Cloud & Updates (Management)
// Two things the owner needs from a distance: the books backed up off-site, and every
// till running the same version.
const { useState: useStateCl, useEffect: useEffectCl } = React;

// Thin bar shown to BOTH roles — an update is a shop-wide thing, and the person at the
// counter is usually the only one at the machine. No PIN, no Management screen needed.
function UpdateBar() {
  const [st, setSt] = useStateCl(null);
  const [dismissed, setDismissed] = useStateCl(false);
  const desktop = !!(window.lms && window.lms.isDesktop);

  useEffectCl(() => {
    if (!desktop) return;
    window.lms.updateStatus().then(setSt).catch(() => {});
    window.lms.onUpdate(s => { setSt(s); setDismissed(false); });
  }, [desktop]);

  if (!desktop || !st || dismissed) return null;
  if (!['available', 'downloading', 'ready'].includes(st.state)) return null;

  const ready = st.state === 'ready';
  return (
    <div className={`safi-updatebar ${ready ? 'is-ready' : ''}`}>
      <Icon name="refresh" size={15}/>
      <span>
        {ready
          ? <>Version <b>{st.version}</b> is ready. Installing takes a few seconds and reopens the app.</>
          : st.state === 'downloading'
            ? <>Downloading update… {st.percent || 0}%</>
            : <>Version <b>{st.version}</b> found — downloading in the background.</>}
      </span>
      {ready && (
        <button className="safi-updatebar__go" onClick={() => window.lms.installUpdate()}>
          Install now
        </button>
      )}
      <button className="safi-updatebar__x" onClick={() => setDismissed(true)} title="Later">×</button>
    </div>
  );
}

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
    error: /code signature|code requirement|not pass validation/i.test(st.message || '')
      ? 'Downloaded, but macOS will not install it — this Mac build is unsigned. Update by hand from the releases page.'
      : (st.message || 'Could not check'),
    dev: 'Running from source — updates apply to installed copies only',
    unavailable: 'Updates not available in this build'
  }[st.state] || st.state;

  return (
    <Card title="App updates">
      <div className="safi-store-info">
        <div><span>Status</span><b style={{ textAlign: 'right', maxWidth: 420 }}>{label}</b></div>
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
  const [email, setEmail] = useStateCl(window.SAFI_CLOUD.status().email || '');
  const [pw, setPw] = useStateCl('');
  const [busy, setBusy] = useStateCl('');
  const [backups, setBackups] = useStateCl(null);
  const [counts, setCounts] = useStateCl(null);
  const [schema, setSchema] = useStateCl(null);

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
          <label>This branch
            <select className="safi-input" value={cfg.branch || 'main'} onChange={e => setCfg({ ...cfg, branch: e.target.value })}>
              <option value="main">Vazi Safi Main</option>
              <option value="br1">Branch 1</option>
              <option value="br2">Branch 2</option>
              <option value="br3">Branch 3</option>
              <option value="br4">Branch 4</option>
              <option value="br5">Branch 5</option>
            </select>
          </label>
          <p className="safi-hint">Which branch this machine belongs to. Everything it sends is stamped with it. Only Main is open — the rest are placeholders waiting for the pick-up points.</p>
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
          <div><span>Last live sync</span><b>{st.lastSync ? new Date(st.lastSync).toLocaleString() : 'Never'}</b></div>
          {st.lastCloudOrders != null && <div><span>Orders: cloud / this laptop</span><b>{st.lastCloudOrders} / {(window.SAFI_STORE.get().orders || []).length}{st.lastCloudOrders === (window.SAFI_STORE.get().orders || []).length ? ' ✓ matching' : ''}</b></div>}
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
                {st.signedOutReason && <p className="safi-hint" style={{ color: 'var(--red)' }}>{st.signedOutReason}</p>}
                <p className="safi-hint">Create the account in Supabase → Authentication → Users. After signing in, sync resumes by itself.</p>
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

      {st.signedIn && (
        <Card title="Live sync">
          <p className="safi-cell-sub" style={{ marginTop: 0 }}>
            Two-way sync: changes made on this laptop go up within seconds, and changes made on
            other laptops come down every two minutes. Needs supabase/05_two_way_sync.sql run once.
          </p>
          {st.needsSetup && (
            <div className="safi-hint" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <b>First time on this laptop: which data is correct?</b>
              <p className="safi-cell-sub" style={{ margin: '6px 0 10px' }}>Pick once. After that the laptops keep each other up to date.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button kind="primary" disabled={st.syncing} onClick={() => {
                  if (!window.confirm('Send everything on this laptop to the cloud, overwriting matching records there?')) return;
                  run('join', () => window.SAFI_CLOUD.joinSync('master'), 'This laptop is now in sync');
                }}>This laptop is correct</Button>
                <Button kind="ghost" disabled={st.syncing} onClick={() => {
                  if (!window.confirm('Replace everything on this laptop with what is in the cloud?')) return;
                  run('join', () => window.SAFI_CLOUD.joinSync('cloud'), 'Downloaded from the cloud');
                }}>The cloud is correct</Button>
              </div>
            </div>
          )}
          <label className="safi-switchrow">
            <input type="checkbox" checked={!!st.liveSync}
              onChange={e => { window.SAFI_CLOUD.setLiveSync(e.target.checked); }}/>
            <span><b>Keep the cloud up to date automatically</b><br/>
              <span className="safi-cell-sub">Changes are sent a few seconds after they are made, and again whenever the internet comes back.</span></span>
          </label>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Button kind="primary" icon="refresh" disabled={busy === 'sync' || st.syncing || st.needsSetup}
              onClick={() => run('sync', () => window.SAFI_CLOUD.syncNow(), 'Cloud is up to date')}>
              {busy === 'sync' || st.syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button kind="ghost" icon="list" disabled={busy === 'cmp'}
              onClick={() => run('cmp', async () => setCounts(await window.SAFI_SYNC.compare()))}>Compare row counts</Button>
            <Button kind="ghost" icon="check" disabled={busy === 'sch'}
              onClick={() => run('sch', async () => setSchema(await window.SAFI_SYNC.checkSchema()))}>Check schema</Button>
            <Button kind="ghost" icon="box" disabled={busy === 'pullall'}
              onClick={() => {
                if (!window.confirm('Replace everything on this laptop with what is in the cloud?')) return;
                run('pullall', () => window.SAFI_SYNC.pull(), 'Pulled down from the cloud');
              }}>Pull cloud → this laptop</Button>
          </div>
          {st.syncError && <p className="safi-hint" style={{ color: 'var(--danger, #b42318)' }}>Last attempt failed: {st.syncError}</p>}
          {st.refusedDeletes > 0 && <p className="safi-hint">{st.refusedDeletes} deletion(s) were refused because this laptop uses the shop login, so those records were put back. Delete them from the owner's laptop.</p>}
          {schema && (
            <p className="safi-hint" style={{ marginBottom: 0 }}>
              {schema.ok
                ? 'All tables are present. Safe to turn live sync on.'
                : <>Missing: <span className="safi-mono">{schema.missing.join(', ')}</span>. Run the SQL files in the supabase folder first.</>}
            </p>
          )}
          {counts && (
            <Table
              cols={[
                { label: 'Table', render: r => r.table },
                { label: 'On this laptop', align: 'right', render: r => r.local },
                { label: 'In the cloud', align: 'right', render: r => r.cloud == null ? '—' : r.cloud },
                { label: '', render: r => r.error ? <span style={{ color: 'var(--danger, #b42318)' }}>{r.error}</span> : r.cloud === r.local ? 'matched' : `${Math.abs(r.local - r.cloud)} behind` },
              ]}
              rows={counts}
              empty="Nothing to compare."
            />
          )}
        </Card>
      )}

      <Card title="Setting up Supabase">
        <ol className="safi-form" style={{ gap: 6, paddingLeft: 18 }}>
          <li>Create a free project at supabase.com. Region: <b>Central EU (Frankfurt)</b> — the closest one to Nairobi.</li>
          <li>SQL Editor → New query. Run <span className="safi-mono">supabase/01_schema.sql</span>, then <span className="safi-mono">02_security.sql</span>, then <span className="safi-mono">03_seed.sql</span>, in that order.</li>
          <li>Authentication → Users: add your own email as the owner, and one till account for the counter.</li>
          <li>Edit the two email addresses at the bottom of <span className="safi-mono">03_seed.sql</span> and run that part again.</li>
          <li>Project Settings → API: copy the URL and anon key into the fields above, then Test connection.</li>
          <li>Sign in, press <b>Check schema</b>, then turn live sync on.</li>
        </ol>
        <p className="safi-hint" style={{ marginBottom: 0 }}>
          The full walkthrough, including what each table is for, is in
          <span className="safi-mono"> supabase/SETUP.md</span>.
        </p>
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

Object.assign(window, { CloudScreen, CloudCard, UpdatesCard, UpdateBar });
