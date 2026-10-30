// Vazi Safi — staff sign-in and screen lock.
// Accounts live in synced settings (staffAccounts), so one sign-up works on every laptop.
// Passwords are stored as salted SHA-256 hashes. First-time / reset codes are 6 characters,
// emailed from the shop Gmail (desktop app), valid 30 minutes.
const { useState: useStateLk, useEffect: useEffectLk, useRef: useRefLk } = React;

const LOCK_KEY = 'safi_lock_v1';
const SESSION_KEY = 'safi_session_v1';
const USER_RE = /^[A-Za-z0-9_]{3,20}$/;

async function lkHash(salt, pw) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + '|' + pw));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const lkSalt = () => [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
const lkCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.getRandomValues(new Uint8Array(6))].map(b => A[b % A.length]).join(''); };
const lkAllAccounts = () => ({ ...(((window.SAFI_STORE.get().settings) || {}).staffAccounts || {}) });
const lkAccounts = () => { const all = lkAllAccounts(); const o = {}; for (const k in all) if (all[k] && !all[k].deleted) o[k] = all[k]; return o; };
const lkSaveAccounts = (acc) => {
  // Stamp every changed account (and mark removed ones) so the per-person merge keeps the newest.
  const prev = lkAllAccounts(); const now = Date.now(); const next = { ...prev };
  for (const k of Object.keys(acc)) if (JSON.stringify(acc[k]) !== JSON.stringify(prev[k])) next[k] = { ...acc[k], u: now };
  for (const k of Object.keys(prev)) if (!(k in acc) && prev[k] && !prev[k].deleted) next[k] = { username: k, deleted: true, u: now };
  window.SAFI_STORE.setSetting('staffAccounts', next);
  window.__safiFastSyncUntil = Date.now() + 10 * 60e3;
  setTimeout(() => { try { window.SAFI_CLOUD && window.SAFI_CLOUD.syncNow && window.SAFI_CLOUD.syncNow().catch(() => {}); } catch (e) {} }, 300);
};
const lkFind = (name) => { const acc = lkAccounts(); const k = Object.keys(acc).find(u => u.toLowerCase() === String(name || '').trim().toLowerCase()); return k ? acc[k] : null; };

async function lkSendCode(account, code) {
  const text = `Hello ${account.name},\n\nYour Vazi Safi LMS sign-in code is: ${code}\n\nUsername: ${account.username}\nIt works once and expires in 30 minutes. After signing in you will choose your own password.\n\nVazi Safi Laundry`;
  if (window.lms && window.lms.sendMail) {
    try { const r = await window.lms.sendMail({ to: account.email, subject: 'Your Vazi Safi sign-in code', text }); if (r && r.ok) return { ok: true }; return { ok: false, reason: (r && r.reason) || 'Email failed' }; }
    catch (e) { return { ok: false, reason: e.message }; }
  }
  return { ok: false, reason: 'Email works in the desktop app only' };
}

// Create or reset an account and send a 6-character code.
async function lkIssueCode({ username, email, kind, staffId, name }) {
  const acc = lkAccounts();
  const existingKey = Object.keys(acc).find(u => u.toLowerCase() === username.toLowerCase());
  const code = lkCode();
  const salt = lkSalt();
  const a = { ...(existingKey ? acc[existingKey] : {}), username, email, kind, staffId: staffId || '', name,
    tempSalt: salt, tempHash: await lkHash(salt, code), tempCode: code, tempExp: Date.now() + 24 * 3600e3, issuedAt: SAFI_TIME.stamp() };
  if (existingKey && existingKey !== username) delete acc[existingKey];
  acc[username] = a;
  lkSaveAccounts(acc);
  // Codes are not emailed for now: Management reads them in Settings → Signings and passes them on.
  return { account: a, code, sent: { ok: false, reason: 'held for Management' } };
}

function lkNow() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function lkLockMinutes(st) { const [h, m] = String(st.lockTime || '20:30').split(':').map(Number); return (h || 0) * 60 + (m || 0); }

window.safiLock = (why) => { localStorage.setItem(LOCK_KEY, JSON.stringify({ locked: true, why: why || '', at: SAFI_TIME.stamp() })); localStorage.removeItem(SESSION_KEY); window.dispatchEvent(new Event('safi-lock')); };
window.safiSignOut = () => {
  localStorage.removeItem(SESSION_KEY);
  const on = !!((window.SAFI_STORE.get().settings || {}).lockEnabled);
  window.dispatchEvent(new Event('safi-signout'));
  if (on) window.safiLock('Signed out');
  else { try { toast('Signed out of Management', 'success'); } catch (e) {} }
};
window.safiSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; } };

function LockScreen({ onUnlock }) {
  const D = useStore();
  const st = D.settings || {};
  const enabled = !!st.lockEnabled;
  const [locked, setLocked] = useStateLk(() => { try { return !!(JSON.parse(localStorage.getItem(LOCK_KEY)) || {}).locked; } catch (e) { return false; } });
  const [left, setLeft] = useStateLk(264);
  const lastAct = useRefLk(Date.now());

  useEffectLk(() => {
    const on = () => setLocked(true);
    window.addEventListener('safi-lock', on);
    const act = () => { lastAct.current = Date.now(); };
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'wheel'].forEach(e => window.addEventListener(e, act, { passive: true }));
    return () => { window.removeEventListener('safi-lock', on); ['mousemove', 'keydown', 'mousedown', 'touchstart', 'wheel'].forEach(e => window.removeEventListener(e, act)); };
  }, []);

  // Daily lock time + no-activity lock.
  useEffectLk(() => {
    if (!enabled) return;
    const t = setInterval(() => {
      if (locked) {
        // Unlock all screens (from Management): undo a remote lock, restore who was signed in.
        let ls = {}; try { ls = JSON.parse(localStorage.getItem(LOCK_KEY)) || {}; } catch (e) {}
        const un = st.unlockAllAt || '';
        if (un && ls.why === 'Locked from Management' && (!ls.at || ls.at <= un)) {
          let prev = null; try { prev = JSON.parse(localStorage.getItem('safi_session_prev')); } catch (e) {}
          localStorage.setItem(LOCK_KEY, JSON.stringify({ locked: false }));
          if (prev) localStorage.setItem(SESSION_KEY, JSON.stringify(prev));
          setLocked(false);
        }
        return;
      }
      const s = window.safiSession();
      // Attendant on duty must be the attendant signed in here; if it changed (e.g. from another laptop), lock for a fresh sign-in.
      const duty = (window.SAFI_STORE.get().settings || {}).currentStaffId || '';
      if (s && s.kind === 'attendant' && s.staffId && duty && duty !== s.staffId) { localStorage.removeItem(SESSION_KEY); window.safiLock('Switch attendant'); return; }
      const all = st.lockAllAt || '';
      if (all && (!s || !s.at || s.at < all) && localStorage.getItem('safi_lockall_seen') !== all) { localStorage.setItem('safi_lockall_seen', all); if (s) localStorage.setItem('safi_session_prev', JSON.stringify(s)); window.safiLock('Locked from Management'); return; }
      if (s && s.kind === 'management') return; // Management stays signed in until Sign out
      const lockAt = lkLockMinutes(st);
      const today = SAFI_TIME.day();
      const signedInAt = s && s.at ? s.at : '';
      const passedLock = lkNow() >= lockAt;
      const signedBeforeLock = !signedInAt || signedInAt.slice(0, 10) < today || (Number(signedInAt.slice(11, 13)) * 60 + Number(signedInAt.slice(14, 16))) < lockAt;
      if (passedLock && signedBeforeLock) { window.safiLock('Daily lock ' + (st.lockTime || '20:30')); return; }
      const idle = Number(st.idleLockMin == null ? 60 : st.idleLockMin);
      if (idle > 0 && Date.now() - lastAct.current > idle * 60e3) window.safiLock('No activity for ' + idle + ' min');
    }, 20000);
    return () => clearInterval(t);
  }, [enabled, locked, st.lockTime, st.idleLockMin, st.lockAllAt, st.unlockAllAt, st.currentStaffId]);

  useEffectLk(() => {
    const m = () => { const s = document.querySelector('.safi-side'); setLeft(s ? Math.round(s.getBoundingClientRect().right) : 264); };
    m(); window.addEventListener('resize', m); const t = setInterval(m, 1500);
    return () => { window.removeEventListener('resize', m); clearInterval(t); };
  }, []);

  if (!enabled || !locked) return null;
  const unlock = (account) => {
    localStorage.setItem(LOCK_KEY, JSON.stringify({ locked: false }));
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: account.username, kind: account.kind, staffId: account.staffId, name: account.name, at: SAFI_TIME.stamp() }));
    lastAct.current = Date.now();
    setLocked(false);
    onUnlock && onUnlock(account);
  };
  return (
    <>
      <div className="safi-lock-block" style={{ width: left }}/>
      <div className="safi-lock" style={{ left }}>
        <SignInCard D={D} onDone={unlock} why={(() => { try { return (JSON.parse(localStorage.getItem(LOCK_KEY)) || {}).why || ''; } catch (e) { return ''; } })()}/>
      </div>
    </>
  );
}

function SignInCard({ D, onDone, why }) {
  const [mode, setMode] = useStateLk('in'); // in | first | change
  // Usernames are never remembered. Staff get suggestions as they type; Management gets none.
  try { localStorage.removeItem('safi_last_user'); } catch (e) {}
  const [u, setU] = useStateLk('');
  const [mu, setMu] = useStateLk('');
  const [p, setP] = useStateLk('');
  const [err, setErr] = useStateLk('');
  const [busy, setBusy] = useStateLk(false);
  const [pending, setPending] = useStateLk(null);
  const [np, setNp] = useStateLk(''); const [np2, setNp2] = useStateLk(''); const [nu, setNu] = useStateLk('');
  // first-time form
  const [who, setWho] = useStateLk(''); const [em, setEm] = useStateLk(''); const [fu, setFu] = useStateLk(''); const [mpin, setMpin] = useStateLk('');
  const [info, setInfo] = useStateLk('');
  const st = D.settings || {};
  const staff = (D.staff || []).filter(s => s.active !== false && !/manager|director/i.test(s.role || ''));
  const mgmt = [{ id: 'mgmt-tim', name: 'Timothy Mutunga' }, { id: 'mgmt-lyn', name: 'Lyn Okaka' }];

  async function mgmtIn() {
    setErr('');
    const realPin = String(window.__safiOwnerPin || window.SAFI_OWNER_PIN || st.ownerPin || '');
    const a = mu.trim() ? lkFind(mu.trim()) : null;
    if (a && a.kind === 'management') {
      const ok = (a.hash && await lkHash(a.salt, p) === a.hash) || (a.tempHash && Date.now() < (a.tempExp || 0) && await lkHash(a.tempSalt, p) === a.tempHash);
      if (ok && a.tempHash && !a.hash) { setPending(a); setNu(a.username); setMode('change'); return; }
      if (ok) { if (a.kind !== 'management') { try { const L = JSON.parse(localStorage.getItem('safi_used_staff_users') || '[]').filter(x => x !== a.username); localStorage.setItem('safi_used_staff_users', JSON.stringify([a.username, ...L].slice(0, 30))); } catch (e) {} } onDone(a); return; }
    }
    if (realPin && String(p).trim() === realPin) { onDone(a && a.kind === 'management' ? a : { username: 'management', kind: 'management', staffId: '', name: 'Management' }); return; }
    setErr(mu.trim() && !a ? 'No Management account with that username.' : a && a.kind !== 'management' ? 'That is a staff account. Use Staff sign in.' : 'Wrong password or passcode.'); setP('');
  }
  async function signIn(retried) {
    setErr('');
    // Management PIN always unlocks (with or without a username).
    const realPin = String(window.__safiOwnerPin || window.SAFI_OWNER_PIN || st.ownerPin || '');
    if (realPin && String(p).trim() === realPin) {
      const a0 = lkFind(u);
      const acct = a0 && a0.kind === 'management' ? a0 : { username: (a0 && a0.kind === 'management' && a0.username) || 'management', kind: 'management', staffId: '', name: 'Management' };
      if (!a0 || a0.kind === 'management') { onDone(acct); return; }
    }
    const a = lkFind(u);
    if (!a) { setErr('No account with that username.'); return; }
    if (a.disabled && a.kind !== 'management') { setErr('This account is disabled. Ask Management.'); return; }
    setBusy(true);
    const ok = a.hash && a.salt && (await lkHash(a.salt, p)) === a.hash;
    const temp = !ok && a.tempHash && Date.now() < (a.tempExp || 0) && (await lkHash(a.tempSalt, p.toUpperCase())) === a.tempHash;
    setBusy(false);
    if (ok && a.kind !== 'management' && !a.approved) { setErr('Waiting for Management to approve your account.'); return; }
    if (ok) { onDone(a); return; }
    if (temp) { setPending(a); setNu(a.username); setMode('change'); setP(''); return; }
    if (retried !== true) { setErr('Checking…'); try { window.SAFI_CLOUD && window.SAFI_CLOUD.syncNow && await window.SAFI_CLOUD.syncNow(); } catch (e) {} return signIn(true); }
    setErr(!a.hash && !a.tempHash ? 'No password set yet. Tap Get a code.' : a.tempHash && Date.now() >= (a.tempExp || 0) && !a.hash ? 'That code has expired. Request a new one.' : p.length > 8 && !a.tempHash ? 'Passwords are 4–8 characters. Check what you typed.' : 'Wrong password or code.');
  }
  async function savePw() {
    setErr('');
    if (!USER_RE.test(nu)) { setErr('Username: 3–20 letters, numbers or _'); return; }
    const clash = lkFind(nu); if (clash && clash.username !== pending.username) { setErr('That username is taken.'); return; }
    if (np.length < 4 || np.length > 8) { setErr('Use 4–8 characters (numbers, letters or a mix).'); return; }
    if (np !== np2) { setErr('The two passwords do not match.'); return; }
    const acc = lkAccounts(); const salt = lkSalt();
    const a = { ...acc[pending.username], username: nu, salt, hash: await lkHash(salt, np) };
    delete a.tempHash; delete a.tempSalt; delete a.tempCode; delete a.tempExp;
    delete acc[pending.username]; acc[nu] = a; lkSaveAccounts(acc);
    if (a.kind !== 'management' && !a.approved) { toast('Password saved. Management will approve your account.', 'success'); setMode('in'); setP(''); setInfo('Password saved. You can sign in once Management approves your account.'); return; }
    toast('Password saved', 'success'); onDone(a);
  }
  async function requestCode() {
    setErr(''); setInfo('');
    const isM = who.startsWith('mgmt-');
    if (!who) { setErr('Select your name.'); return; }
    if (em && !/^\S+@\S+\.\S+$/.test(em)) { setErr('That email does not look right.'); return; }
    if (!USER_RE.test(fu)) { setErr('Username: 3–20 letters, numbers or _'); return; }
    const clash = lkFind(fu);
    const mine = clash && ((isM && clash.staffId === who) || (!isM && clash.staffId === who));
    if (clash && !mine) { setErr('That username is taken.'); return; }
    const realPin = String(window.__safiOwnerPin || window.SAFI_OWNER_PIN || st.ownerPin || '');
    if (isM && (!realPin || String(mpin).trim() !== realPin)) { setErr('Wrong Management PIN.'); return; }
    const person = isM ? mgmt.find(m => m.id === who) : staff.find(s => s.id === who);
    setBusy(true);
    const r = await lkIssueCode({ username: fu, email: em.trim(), kind: isM ? 'management' : 'attendant', staffId: who, name: person ? person.name : fu });
    setBusy(false);
    if (isM) setInfo(`Your code is ${r.code}. Sign in with username ${fu} and this code within 24 hours.`);
    else setInfo(`Request sent. Management will give you your code. Then sign in with username ${fu}.`);
    setU(fu); setMode('in');
  }

  const onKey = (fn) => (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };
  return (
    <div className="safi-lock__card">
      <div className="safi-lock__ico"><Icon name="lock" size={22}/></div>
      {mode === 'in' && (<>
        {why === 'Signed out' && <div className="safi-callout" style={{ marginBottom: 10 }}><Icon name="check" size={14}/><span>You are signed out.</span></div>}
        <h2>Staff sign in</h2>
        {info && <div className="safi-callout" style={{ marginBottom: 10 }}><Icon name="sms" size={14}/><span>{info}</span></div>}
        <div className="safi-form">
          <label>Username
            <div className="safi-usugg">
              <input className="safi-input" autoFocus value={u} onChange={e => setU(e.target.value)} onKeyDown={onKey(signIn)} autoComplete="off" name="safi-staff-u"/>
              {(() => { const q = u.trim().toLowerCase(); if (!q) return null; let used = []; try { used = JSON.parse(localStorage.getItem('safi_used_staff_users') || '[]'); } catch (e) {} const acc = lkAccounts(); const list = used.map(n => acc[n] || Object.values(acc).find(x => x.username === n)).filter(a => a && a.kind !== 'management' && !a.disabled && a.username.toLowerCase().startsWith(q) && a.username.toLowerCase() !== q); return list.length ? <div className="safi-usugg__list">{list.map(a => <button key={a.username} type="button" onMouseDown={e => { e.preventDefault(); setU(a.username); }}>{a.username}</button>)}</div> : null; })()}
            </div>
          </label>
          <label>Password / Passcode<input className="safi-input safi-mono" type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={onKey(signIn)} autoComplete="off"/></label>
          {err && <p className="safi-pin__err">{err}</p>}
          <Button kind="primary" icon="check" disabled={busy} onClick={signIn}>{busy ? 'Checking…' : 'Sign in'}</Button>
          <button className="safi-rowlink" onClick={() => { setMode('first'); setErr(''); setInfo(''); }}>First time, or forgot your password? Get a code</button>
        </div>
        <div className="safi-lock-mgmt">
          <Button kind="ghost" full icon="lock" onClick={() => { setMode('mgmt'); setErr(''); setP(''); }}>Management sign in</Button>
        </div>
      </>)}
      {mode === 'mgmt' && (<>
        <h2>Management sign in</h2>
        <div className="safi-form">
          <label>Username<input className="safi-input" autoFocus value={mu} onChange={e => setMu(e.target.value)} onKeyDown={onKey(mgmtIn)} autoComplete="off" name="safi-m-u" spellCheck={false}/></label>
          <label>Password / Passcode<input className="safi-input safi-mono" type="password" value={p} onChange={e => setP(e.target.value)} onKeyDown={onKey(mgmtIn)} autoComplete="off"/></label>
          {err && <p className="safi-pin__err">{err}</p>}
          <Button kind="primary" icon="check" onClick={mgmtIn}>Sign in as Management</Button>
          <button className="safi-rowlink" onClick={() => { setMode('in'); setErr(''); setP(''); }}>‹ Back to staff sign in</button>
        </div>
      </>)}
      {mode === 'change' && pending && (<>
        <h2>Welcome, {pending.name.split(' ')[0]}</h2>
        <p className="safi-cell-sub">Choose the username and password you will use from now on.</p>
        <div className="safi-form">
          <label>Username<input className="safi-input" value={nu} onChange={e => setNu(e.target.value)}/></label>
          <label>New password or passcode (4–8 characters: numbers, letters, symbols or a mix)<input className="safi-input safi-mono" type="password" maxLength={8} value={np} onChange={e => setNp(e.target.value)}/></label>
          <label>Repeat password<input className="safi-input safi-mono" type="password" maxLength={8} value={np2} onChange={e => setNp2(e.target.value)} onKeyDown={onKey(savePw)}/></label>
          {err && <p className="safi-pin__err">{err}</p>}
          <Button kind="primary" icon="check" onClick={savePw}>Save and sign in</Button>
        </div>
      </>)}
      {mode === 'first' && (<>
        <h2>Get a sign-in code</h2>
        <p className="safi-cell-sub">Management gets a 6-character code for you. Use it once to sign in, then set your own password.</p>
        <div className="safi-form">
          <label>Select your name
            <select className="safi-input" value={who} onChange={e => setWho(e.target.value)}>
              <option value="">— Choose —</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>Email <span className="safi-cell-sub">(optional)</span><input className="safi-input" type="email" value={em} onChange={e => setEm(e.target.value)}/></label>
          <label>Username (letters, numbers, _)<input className="safi-input" value={fu} onChange={e => setFu(e.target.value)} placeholder="e.g. john_doe, grace26, joe_123"/></label>
          {who.startsWith('mgmt-') && <label>Management PIN<input className="safi-input safi-mono" type="password" value={mpin} onChange={e => setMpin(e.target.value)}/></label>}
          {err && <p className="safi-pin__err">{err}</p>}
          <Button kind="primary" icon="check" disabled={busy} onClick={requestCode}>{busy ? 'Sending…' : 'Request code'}</Button>
          <button className="safi-rowlink" onClick={() => { setMode('in'); setErr(''); }}>Back to sign in</button>
        </div>
      </>)}
    </div>
  );
}

// Management → Settings card.
function SignOutButton({ ses }) {
  const [ask, setAsk] = useStateLk(false);
  const [pw, setPw] = useStateLk('');
  const [err, setErr] = useStateLk('');
  const isM = ses && ses.kind === 'management';
  async function confirm() {
    setErr('');
    const st = window.SAFI_STORE.get().settings || {};
    const real = String(window.__safiOwnerPin || window.SAFI_OWNER_PIN || st.ownerPin || '');
    let ok = real && pw.trim() === real;
    if (!ok && ses && ses.username) { const a = lkFind(ses.username); if (a && a.hash) ok = (await lkHash(a.salt, pw)) === a.hash; }
    if (!ok) { setErr('Wrong password / passcode'); setPw(''); return; }
    setAsk(false); setPw(''); window.safiSignOut();
  }
  if (!isM) return <button className="safi-lockbtn" onClick={() => window.safiSignOut()}><Icon name="arrow-l" size={16}/>Signed out</button>;
  if (!ask) return <button className="safi-lockbtn is-navy" onClick={() => { setAsk(true); setErr(''); }}><Icon name="check" size={16}/>Signed in</button>;
  return (
    <span className="safi-signout-ask">
      <input className="safi-input safi-mono" type="password" autoFocus placeholder="Password / Passcode" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') confirm(); if (e.key === 'Escape') setAsk(false); }}/>
      <button className="safi-lockbtn is-navy" onClick={confirm}><Icon name="arrow-l" size={16}/>Sign out</button>
      <button className="safi-rowlink" onClick={() => setAsk(false)}>Cancel</button>
      {err && <span className="safi-pin__err" style={{ margin: 0 }}>{err}</span>}
    </span>
  );
}

function MgmtAccountSetup() {
  const [who, setWho] = useStateLk('mgmt-tim');
  const [un, setUn] = useStateLk('');
  const [msg, setMsg] = useStateLk('');
  const people = [{ id: 'mgmt-tim', name: 'Timothy Mutunga' }, { id: 'mgmt-lyn', name: 'Lyn Okaka' }];
  async function make() {
    setMsg('');
    const u = un.trim();
    if (!USER_RE.test(u)) { setMsg('Username: 3–20 letters, numbers or _'); return; }
    const clash = lkFind(u);
    if (clash && clash.staffId !== who) { setMsg('That username is taken.'); return; }
    const p = people.find(x => x.id === who);
    const r = await lkIssueCode({ username: u, email: '', kind: 'management', staffId: who, name: p.name });
    setMsg(`Code for ${u}: ${r.code}. Use Management sign in with this username and code, then set your password.`);
    setUn('');
  }
  return (
    <>
      <h4 className="safi-section-h">Management accounts</h4>
      <div className="safi-mgmt-setup">
        <select className="safi-input" value={who} onChange={e => setWho(e.target.value)}>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input className="safi-input" placeholder="Username, e.g. tim_vs" value={un} onChange={e => setUn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') make(); }}/>
        <Button kind="secondary" icon="check" onClick={make}>Create / reset</Button>
      </div>
      {msg && <p className="safi-hint" style={{ marginTop: 8 }}><b>{msg}</b></p>}
    </>
  );
}

function StaffSignInCard() {
  const D = useStore();
  const st = D.settings || {};
  const acc = (() => { const all = st.staffAccounts || {}; const o = {}; for (const k in all) if (all[k] && !all[k].deleted) o[k] = all[k]; return o; })();
  const set = (k, v) => window.SAFI_STORE.setSetting(k, v);
  const rows = Object.values(acc).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  async function reset(a) {
    const r = await lkIssueCode({ username: a.username, email: a.email, kind: a.kind, staffId: a.staffId, name: a.name });
    toast(`New code for ${a.username}: ${r.code}`, 'success');
  }
  function patchAcc(a, patch) { const n = { ...acc, [a.username]: { ...acc[a.username], ...patch } }; lkSaveAccounts(n); toast(patch.approved ? `${a.username} approved` : patch.disabled ? `${a.username} disabled` : `${a.username} enabled`, 'success'); }
  function remove(a) {
    const pin = prompt(`Delete the account ${a.username}? Enter the Management PIN to confirm.`);
    if (pin == null) return;
    const real = String(window.__safiOwnerPin || window.SAFI_OWNER_PIN || st.ownerPin || '');
    if (!real || pin.trim() !== real) { toast('Wrong Management PIN', 'error'); return; } const n = { ...acc }; delete n[a.username]; lkSaveAccounts(n); }
  return (
    <Card title="Staff sign-in & screen lock" action={<span className="safi-cell-sub">Blurs the working area until someone signs in</span>}>
      <div className="safi-form" style={{ maxWidth: 760 }}>
        <label className="safi-toggle safi-toggle--lg">
          <input type="checkbox" checked={!!st.lockEnabled} onChange={e => set('lockEnabled', e.target.checked)}/><span/>
          <div><b>Require sign-in</b><p className="safi-cell-sub" style={{ margin: '2px 0 0' }}>Off until you switch it on. Turn on after the attendants have their accounts. Signing in makes that attendant the one on duty; Management sign-in opens Management without the PIN.</p></div>
        </label>
        <div className="safi-form__row">
          <label>Lock every day at<input type="time" className="safi-input safi-mono" value={st.lockTime || '20:30'} onChange={e => set('lockTime', e.target.value)}/></label>
          <label>Lock after no activity (minutes, 0 = never)<input type="number" min="0" className="safi-input safi-mono" value={st.idleLockMin == null ? 60 : st.idleLockMin} onChange={e => set('idleLockMin', Math.max(0, Number(e.target.value) || 0))}/></label>
        </div>
        <p className="safi-hint">The screen also locks when a shift is closed.</p>
        {(() => { const allOn = !!st.lockAllAt && !(st.unlockAllAt && st.unlockAllAt >= st.lockAllAt); const ses = window.safiSession(); return (
        <div className="safi-lockbtns">
          <button className={`safi-lockbtn${allOn ? ' is-on' : ''}`} onClick={() => { const at = SAFI_TIME.stamp(); if (allOn) { set('unlockAllAt', at); toast('Other laptops unlock at their next sync', 'success'); } else { localStorage.setItem('safi_lockall_seen', at); set('lockAllAt', at); toast('Other laptops lock at their next sync', 'success'); } setTimeout(() => { try { window.SAFI_CLOUD && window.SAFI_CLOUD.syncNow && window.SAFI_CLOUD.syncNow().catch(() => {}); } catch (e) {} }, 300); }}><Icon name="lock" size={16}/>{allOn ? 'Screens locked · Unlock all' : 'Lock all screens'}</button>
          <button className="safi-lockbtn" onClick={() => { if (!st.lockEnabled) set('lockEnabled', true); window.__safiGoFrontDesk && window.__safiGoFrontDesk(); setTimeout(() => window.safiLock('Preview'), 150); }}><Icon name="staff" size={16}/>Preview Front Desk lock</button>
          <SignOutButton ses={ses}/>
        </div>); })()}
        <p className="safi-hint">Management stays signed in (no daily or idle lock) until you press Sign out.</p>

        <MgmtAccountSetup/>

        <h4 className="safi-section-h">Signings · accounts and codes</h4>
        <p className="safi-hint">When someone taps "Get a code", it appears here. Send them the username and the code (valid 24 hours). Once they set their own password the status shows Active.</p>
        {rows.length ? (
          <table className="safi-approval-items">
            <thead><tr><th>Name</th><th>Username</th><th>Type</th><th>Requested</th><th>Status</th><th></th></tr></thead>
            <tbody>{rows.map(a => (
              <tr key={a.username}>
                <td>{a.name}</td><td className="safi-mono">{a.username}</td><td>{a.kind === 'management' ? 'Management' : 'Attendant'}</td><td className="safi-cell-sub">{a.issuedAt ? `${a.issuedAt.slice(8, 10)}-${a.issuedAt.slice(5, 7)} ${a.issuedAt.slice(11, 16)}` : '—'}</td>
                <td>{a.disabled ? <span className="safi-pill safi-pill--red">Disabled</span> : a.hash && a.kind !== 'management' && !a.approved ? <span className="safi-pill safi-pill--amber">Needs approval</span> : a.hash ? <span className="safi-pill safi-pill--green">Active</span> : a.tempCode && Date.now() < (a.tempExp || 0) ? <span className="safi-pill safi-pill--amber">Code {a.tempCode}</span> : <span className="safi-pill safi-pill--gray">Code expired</span>}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{a.kind !== 'management' && !a.approved && !a.disabled && <button className="safi-rowlink" onClick={() => patchAcc(a, { approved: true, approvedAt: SAFI_TIME.stamp() })}>Approve</button>}{a.kind !== 'management' && <button className="safi-rowlink" onClick={() => patchAcc(a, { disabled: !a.disabled })}>{a.disabled ? 'Enable' : 'Disable'}</button>}<button className="safi-rowlink" onClick={() => reset(a)}>New code</button><button className="safi-rowlink safi-rowlink--danger" onClick={() => remove(a)}>Delete</button></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="safi-cell-sub">No requests yet. While this is off, test it here: tick Require sign-in, then tap "Get a code" on the lock screen.</p>}
      </div>
    </Card>
  );
}

Object.assign(window, { LockScreen, StaffSignInCard });
