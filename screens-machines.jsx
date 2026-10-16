// Vazi Safi — Live machines: 4 stacked washer/dryer sets + 1 standalone dryer.
// Manual timers (no machine connection yet): staff tap a machine, choose minutes and,
// optionally, the order inside. Countdown on every laptop (synced via settings.machines),
// chime when it finishes. Drawings are illustrations, not photos of the LG units.
const { useState: useStateM, useEffect: useEffectM } = React;

// Floor order as it stands in the shop: the standalone Dryer 5 sits between sets 2 and 4.
const MACHINES = [
  { set: 1, w: 'w1', d: 'd1' }, { set: 2, w: 'w2', d: 'd2' },
  { set: 3, w: null, d: 'd5' },
  { set: 4, w: 'w3', d: 'd3' }, { set: 5, w: 'w4', d: 'd4' },
];
const SET_OF = Object.fromEntries(MACHINES.flatMap(u => [[u.d, u.set]].concat(u.w ? [[u.w, u.set]] : [])));
// Names follow the set number on the floor. Ids stay fixed so saved timers and logs keep
// pointing at the same physical machine (d5 is the standalone dryer in Set 3).
const MNAME = { w1: 'Washer 1', d1: 'Dryer 1', w2: 'Washer 2', d2: 'Dryer 2', d5: 'Dryer 3', w3: 'Washer 4', d3: 'Dryer 4', w4: 'Washer 5', d4: 'Dryer 5' };
const DEF_MIN = { w: 35, d: 45 };

function machineState(D, id) {
  const m = ((D.settings || {}).machines || {})[id] || {};
  if (m.service) return { kind: 'service', m };
  if (!m.startedAt) return { kind: 'idle', m };
  const end = new Date(m.startedAt).getTime() + (Number(m.minutes) || 0) * 60000;
  const left = end - Date.now();
  return left > 0 ? { kind: 'run', m, left, end } : { kind: 'done', m, over: -left, end };
}
const mmss = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60), se = s % 60; return h ? `${h}:${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')}` : `${String(mi).padStart(2, '0')}:${String(se).padStart(2, '0')}`; };

// Machine display: total minutes:seconds ("74:59") so it always fits the small LCD.
const lcdTime = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function setMachine(id, patch) {
  const S = window.SAFI_STORE; const st = S.get().settings || {};
  const all = { ...(st.machines || {}) };
  all[id] = patch === null ? {} : { ...(all[id] || {}), ...patch };
  S.setSetting('machines', all);
}

// One machine face: the real LG photo with live overlays on its display and door.
// Positions are fractions of the photo (measured from the supplied images).
const FACE = {
  w: { img: () => window.VAZI_IMG_WASHER, ratio: 419 / 295, cx: 49.8, cy: 45.7, r: 29.1, lcd: [47.8, 5.0, 9.5, 2.1] },
  d: { img: () => window.VAZI_IMG_DRYER,  ratio: 337 / 276, cx: 50.3, cy: 51.3, r: 31.5, lcd: [47.5, 4.4, 9.8, 2.3] },
};
const spinOf = (id) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997; return { dur: (1.1 + (h % 17) / 10).toFixed(2) + 's', delay: '-' + ((h % 23) / 10).toFixed(1) + 's', dir: h % 3 === 0 ? 'reverse' : 'normal' }; };
function MachineFace({ id, D, onOpen }) {
  const s = machineState(D, id);
  const order = s.m.orderId ? D.orders.find(o => o.id === s.m.orderId) : null;
  const cust = order ? D.customers.find(c => c.id === order.customer) : null;
  const t = id[0] === 'w' ? 'w' : 'd';
  const F = FACE[t];
  const disp = s.kind === 'run' ? lcdTime(s.left) : s.kind === 'done' ? 'END' : s.kind === 'service' ? 'SERV' : 'PUSH';
  const r = F.r, pad = 2.5;
  return (
    <button className={`safi-mc safi-mc--${t} is-${s.kind}`} onClick={() => onOpen(id)} title={`${MNAME[id]} — tap to start, stop or mark for service`}>
      <div className="safi-mc__photo" style={{ paddingTop: (F.ratio * 100) + '%' }}>
        <img src={F.img()} alt={MNAME[id]} draggable="false"/>
        <span className="safi-mc__lcd" style={{ left: F.lcd[0] + '%', top: F.lcd[1] + '%', width: F.lcd[2] + '%', height: F.lcd[3] + '%' }}>{disp}</span>
        <span className="safi-mc__spin" style={{ left: (F.cx - r) + '%', top: (F.cy - r / F.ratio) + '%', width: (r * 2) + '%' }}><i style={{ animationDuration: spinOf(id).dur, animationDelay: spinOf(id).delay, animationDirection: spinOf(id).dir }}/></span>
        <span className="safi-mc__ring" style={{ left: (F.cx - r - pad) + '%', top: (F.cy - (r + pad) / F.ratio) + '%', width: ((r + pad) * 2) + '%' }}/>
      </div>
    </button>
  );
}

function MachineInfo({ id, D }) {
  const s = machineState(D, id);
  const order = s.m.orderId ? D.orders.find(o => o.id === s.m.orderId) : null;
  const cust = order ? D.customers.find(c => c.id === order.customer) : null;
  return (
    <div className={`safi-mc-info is-${s.kind}`}>
      <i/><b>{MNAME[id]}</b>
      <span>{s.kind === 'run' ? `${mmss(s.left)} left${order ? ` · ${orderNo(order.id)} ${cust?.name || ''}` : ''}` : s.kind === 'done' ? `Finished ${mmss(s.over)} ago — unload` : s.kind === 'service' ? `Out of service${s.m.note ? ` · ${s.m.note}` : ''}` : 'Free'}</span>
    </div>
  );
}

// Table under the floor: one row per machine, live status plus today's run figures.
function MachineTable({ D, onOpen }) {
  const today = SAFI_TIME.day();
  const log = ((D.settings || {}).machineLog || []).filter(r => SAFI_TIME.day(new Date(r.at)) === today);
  const hm = (iso) => { if (!iso) return '—'; const t = new Date(iso); return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); };
  const dur = (min) => min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m`;
  const order = MACHINES.flatMap(u => u.w ? [u.w, u.d] : [u.d]);
  const label = { run: 'Running', done: 'Finished', idle: 'Free', service: 'Out of service' };
  const rows = order.map(id => {
    const s = machineState(D, id);
    const runs = log.filter(r => r.id === id).sort((a, b) => a.at.localeCompare(b.at));
    const mins = runs.reduce((t, r) => t + (Number(r.minutes) || 0), 0);
    const o = s.m.orderId ? D.orders.find(x => x.id === s.m.orderId) : null;
    const cu = o ? D.customers.find(c => c.id === o.customer) : null;
    const setNo = SET_OF[id];
    return { id, setNo, s, runs, mins, o, cu };
  });
  const totRuns = rows.reduce((t, r) => t + r.runs.length, 0), totMin = rows.reduce((t, r) => t + r.mins, 0);
  return (
    <Card title="Machine log · today" pad={false} action={<span className="safi-cell-sub">{totRuns} runs · {dur(totMin)} running time</span>}>
      <div className="safi-table-wrap">
        <table className="safi-table safi-mtable">
          <thead><tr><th>Machine</th><th>Set</th><th>Status</th><th>Started</th><th>Ends</th><th>Time left</th><th>Order inside</th><th>Runs today</th><th>Run time today</th><th>Start times today</th><th>Use of a 12h day</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="is-clickable" onClick={() => onOpen(r.id)}>
                <td><b>{MNAME[r.id]}</b></td>
                <td>Set {r.setNo}</td>
                <td><span className={`safi-mstat is-${r.s.kind}`}><i/>{label[r.s.kind]}</span></td>
                <td className="safi-mono">{r.s.m.startedAt && r.s.kind !== 'idle' ? hm(r.s.m.startedAt) : '—'}</td>
                <td className="safi-mono">{r.s.end ? hm(new Date(r.s.end).toISOString()) : '—'}</td>
                <td className="safi-mono">{r.s.kind === 'run' ? mmss(r.s.left) : r.s.kind === 'done' ? `+${mmss(r.s.over)}` : '—'}</td>
                <td>{r.o ? <><span className="safi-mono">{orderNo(r.o.id)}</span> <span className="safi-cell-sub">{r.cu?.name || ''}</span></> : '—'}</td>
                <td className="safi-mono">{r.runs.length}</td>
                <td className="safi-mono">{r.mins ? dur(r.mins) : '—'}</td>
                <td><div className="safi-setpanel__runs">{r.runs.length ? r.runs.map((x, k) => <span key={k}>{hm(x.at)}<small>{x.minutes}m</small></span>) : <em>—</em>}</div></td>
                <td><div className="safi-mbar"><div style={{ width: Math.min(100, Math.round(r.mins / 720 * 100)) + '%' }}/></div><span className="safi-cell-sub">{Math.min(100, Math.round(r.mins / 720 * 100))}%</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// Under each set: the machines in it and the times each one ran today.
function SetPanel({ ids, D }) {
  const today = SAFI_TIME.day();
  const log = ((D.settings || {}).machineLog || []).filter(r => SAFI_TIME.day(new Date(r.at)) === today);
  const hm = (iso) => { const t = new Date(iso); return String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0'); };
  return (
    <div className="safi-setpanel">
      {ids.map(id => {
        const runs = log.filter(r => r.id === id).sort((a, b) => a.at.localeCompare(b.at));
        const s = machineState(D, id);
        return (
          <div key={id} className="safi-setpanel__row">
            <div className="safi-setpanel__hd"><i className={`is-${s.kind}`}/><b>{MNAME[id]}</b><span>{runs.length} run{runs.length === 1 ? '' : 's'}</span></div>
            <div className="safi-setpanel__runs">{runs.length ? runs.map((r, k) => <span key={k} title={r.orderId ? orderNo(r.orderId) : ''}>{hm(r.at)}<small>{r.minutes}m</small></span>) : <em>Not run today</em>}</div>
          </div>
        );
      })}
    </div>
  );
}

function MachineSheet({ id, D, onClose }) {
  const s = id ? machineState(D, id) : null;
  const isW = id && id[0] === 'w';
  const [min, setMin] = useStateM(isW ? DEF_MIN.w : DEF_MIN.d);
  const [orderId, setOrderId] = useStateM('');
  const [note, setNote] = useStateM('');
  useEffectM(() => { if (id) { setMin(isW ? DEF_MIN.w : DEF_MIN.d); setOrderId(''); setNote(''); } }, [id]);
  if (!id) return null;
  const stageFor = isW ? ['intake', 'washing'] : ['washing', 'holding', 'drying'];
  const cands = D.orders.filter(o => stageFor.includes(o.status)).sort((a, b) => String(b.in).localeCompare(String(a.in)));
  const staff = window.SAFI_STORE.getCurrentStaff ? window.SAFI_STORE.getCurrentStaff().name : '';
  function start() {
    const startedAt = new Date().toISOString();
    setMachine(id, { startedAt, minutes: Number(min) || 1, orderId, by: staff, service: false, chimed: false });
    const S = window.SAFI_STORE; const log = ((S.get().settings || {}).machineLog || []).slice(-300);
    S.setSetting('machineLog', [...log, { id, at: startedAt, minutes: Number(min) || 1, orderId, by: staff }]);
    toast(`${MNAME[id]} started · ${min} min`, 'success'); onClose();
  }
  const presets = isW ? [25, 30, 35, 45, 60] : [30, 40, 45, 60, 75];
  return (
    <Modal open={!!id} onClose={onClose} title={MNAME[id]} width={520}
      footer={<>
        <Button kind="ghost" onClick={onClose}>Close</Button>
        {s.kind === 'service'
          ? <Button kind="primary" icon="check" onClick={() => { setMachine(id, null); toast(`${MNAME[id]} back in service`); onClose(); }}>Back in service</Button>
          : (s.kind === 'run' || s.kind === 'done')
            ? <Button kind="primary" icon="check" onClick={() => { setMachine(id, null); toast(`${MNAME[id]} is free`); onClose(); }}>{s.kind === 'done' ? 'Unloaded — mark free' : 'Stop now'}</Button>
            : <Button kind="primary" icon="arrow" onClick={start}>Start {min} min</Button>}
      </>}>
      <div className="safi-form">
        {(s.kind === 'run' || s.kind === 'done') && (
          <div className="safi-callout"><Icon name="clock" size={14}/><span>{s.kind === 'run' ? `${mmss(s.left)} left` : `Finished ${mmss(s.over)} ago`} · started by {s.m.by || '—'}{s.m.orderId ? ` · ${orderNo(s.m.orderId)}` : ''}</span></div>
        )}
        {s.kind === 'idle' && <>
          <label>Minutes
            <div className="safi-seg">{presets.map(p => <button key={p} type="button" className={`safi-seg__btn ${Number(min) === p ? 'is-active' : ''}`} onClick={() => setMin(p)}>{p}</button>)}</div>
            <input type="number" className="safi-input safi-mono" min="1" value={min} onChange={e => setMin(e.target.value)} style={{ marginTop: 6, width: 120 }}/>
          </label>
          <label>Order inside <span className="safi-cell-sub">(optional)</span>
            <select className="safi-input" value={orderId} onChange={e => setOrderId(e.target.value)}>
              <option value="">— Not linked —</option>
              {cands.map(o => { const c = D.customers.find(x => x.id === o.customer); return <option key={o.id} value={o.id}>{orderNo(o.id)} · {c?.name || ''} · {o.status}</option>; })}
            </select>
          </label>
        </>}
        {s.kind !== 'service' && s.kind !== 'run' && (
          <label>Out of service <span className="safi-cell-sub">(optional note)</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="safi-input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. door seal leaking"/>
              <Button kind="ghost" icon="alert" onClick={() => { setMachine(id, { service: true, note, startedAt: null }); toast(`${MNAME[id]} marked out of service`); onClose(); }}>Mark</Button>
            </div>
          </label>
        )}
      </div>
    </Modal>
  );
}

function MachinesScreen() {
  const D = useStore();
  const [, tick] = useStateM(0);
  const [open, setOpen] = useStateM(null);
  useEffectM(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, []);
  // Chime once per finished cycle on this laptop.
  useEffectM(() => {
    const KEY = 'safi_machine_chimed_v1';
    let seen = {}; try { seen = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
    let changed = false;
    Object.keys(MNAME).forEach(id => {
      const s = machineState(D, id);
      if (s.kind === 'done' && s.over < 10 * 60000) {
        const k = id + '@' + s.m.startedAt;
        if (!seen[k]) { seen[k] = 1; changed = true; window.safiChime && window.safiChime(true); toast(`${MNAME[id]} finished — unload`, 'success'); }
      }
    });
    if (changed) localStorage.setItem(KEY, JSON.stringify(seen));
  });
  const counts = Object.keys(MNAME).reduce((a, id) => { const k = machineState(D, id).kind; a[k] = (a[k] || 0) + 1; return a; }, {});
  return (
    <>
      <Topbar title="Live machines"/>
      <div className="safi-mc-stats">
        <span className="is-run"><i/>Running <b>{counts.run || 0}</b></span>
        <span className="is-done"><i/>Finished <b>{counts.done || 0}</b></span>
        <span className="is-idle"><i/>Free <b>{counts.idle || 0}</b></span>
        <span className="is-service"><i/>Out of service <b>{counts.service || 0}</b></span>
      </div>
      <div className="safi-mc-floor">
        {MACHINES.map(u => (
          <div key={u.set} className={`safi-mc-unit${u.w ? '' : ' is-single'}`}>
            <div className="safi-mc-unit__label">Set {u.set}</div>
            <div className="safi-mc-stack">
              <MachineFace id={u.d} D={D} onOpen={setOpen}/>
              {u.w && <MachineFace id={u.w} D={D} onOpen={setOpen}/>}
              {!u.w && <div className="safi-mc-stand" aria-hidden="true"><i/><i/></div>}
            </div>

          </div>
        ))}
      </div>
      <MachineTable D={D} onOpen={setOpen}/>
      <p className="safi-hint" style={{ textAlign: 'center' }}>Timers are set by staff and shared with every laptop. When LG's machine connection is added later, these will update by themselves.</p>
      <MachineSheet id={open} D={D} onClose={() => setOpen(null)}/>
    </>
  );
}

Object.assign(window, { MachinesScreen, machineState, MNAME });
