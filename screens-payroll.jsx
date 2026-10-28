// Vazi Safi — Payroll (Management). Saved in synced settings, so every laptop sees the same.
// settings.payroll = { meta: { [staffId]: { empNo, pay, off:[0-6] } }, months: { 'YYYY-MM': { [staffId]: { absent, bonus, advance, deduct, note, paidAt, method, txn } } } }
const { useState: useStatePy } = React;
const PY_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pyDm = (s) => { s = String(s || ''); return s.length >= 10 ? `${s.slice(8, 10)}-${s.slice(5, 7)}` : s; };

function pyWorkingDays(ym, off) {
  const [y, m] = ym.split('-').map(Number);
  const n = new Date(y, m, 0).getDate();
  let w = 0; for (let d = 1; d <= n; d++) if (!(off || []).includes(new Date(y, m - 1, d).getDay())) w++;
  return { days: n, working: w };
}

const PY_VARS = ['pay', 'rate', 'days', 'working', 'absent', 'worked', 'bonus', 'ot', 'advance', 'deduct'];
const PY_DEFAULT = 'pay - rate * absent + bonus + ot - advance - deduct';
// Safe formula: only numbers, + - * / ( ) . and the variable names above.
function pyCompile(src) {
  const s = String(src || '').trim();
  if (!s) return { err: 'Formula is empty' };
  if (!/^[\w\s+\-*/().,]+$/.test(s)) return { err: 'Use only numbers, + - * / ( ) and the names listed' };
  const bad = (s.match(/[A-Za-z_]\w*/g) || []).filter(w => !PY_VARS.includes(w) && !['min', 'max', 'round'].includes(w));
  if (bad.length) return { err: `Unknown name: ${bad[0]}` };
  try { const fn = new Function(...PY_VARS, 'min', 'max', 'round', `return (${s});`); fn(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, Math.min, Math.max, Math.round); return { fn }; }
  catch (e) { return { err: 'Formula has a mistake (check brackets and signs)' }; }
}

function PayrollScreen({ money }) {
  const D = useStore();
  const P = (D.settings || {}).payroll || { meta: {}, months: {} };
  const [ym, setYm] = useStatePy(SAFI_TIME.day().slice(0, 7));
  const [showAll, setShowAll] = useStatePy(true);
  const [payFor, setPayFor] = useStatePy(null);
  const [payM, setPayM] = useStatePy('bank');
  const [payTxn, setPayTxn] = useStatePy('');
  const [addOpen, setAddOpen] = useStatePy(false);
  const [newS, setNewS] = useStatePy({ name: '', role: 'Front Desk' });
  const [extraFor, setExtraFor] = useStatePy(null);
  const [ex, setEx] = useStatePy({ date: SAFI_TIME.day(), type: 'ot', amount: '', note: '' });
  const [fx, setFx] = useStatePy(null);
  const isDir = (s) => ['timothy mutunga', 'lyn okaka'].indexOf((s.name || '').toLowerCase());
  const ordered = [...(D.staff || [])].sort((a, b) => { const x = isDir(a), y = isDir(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
  const staff = ordered.filter(s => showAll || s.active !== false);
  const allStaff = D.staff || [];
  const save = (next) => window.SAFI_STORE.setSetting('payroll', next);
  const formulaSrc = P.formula || PY_DEFAULT;
  const formula = pyCompile(formulaSrc);
  const metaOf = (s) => {
    const m = P.meta[s.id] || {};
    const idx = ordered.findIndex(x => x.id === s.id) + 1;
    return { empNo: m.empNo || `SF-${String(idx).padStart(3, '0')}`, pay: Number(m.pay) || 0, off: m.off || [0] };
  };
  const rowOf = (s) => (P.months[ym] || {})[s.id] || {};
  // Save only what was changed; a made-up employee number is never stored.
  const setMeta = (s, patch) => {
    if (patch.empNo) {
      const clash = ordered.find(x => x.id !== s.id && metaOf(x).empNo === patch.empNo);
      if (clash) { toast(`${patch.empNo} is already ${clash.name}`, 'error'); return false; }
    }
    save({ ...P, meta: { ...P.meta, [s.id]: { ...(P.meta[s.id] || {}), ...patch } } });
  };
  const setRow = (s, patch) => save({ ...P, months: { ...P.months, [ym]: { ...(P.months[ym] || {}), [s.id]: { ...rowOf(s), ...patch } } } });
  const calc = (s) => {
    // Pay is always counted over 30 days; off days are only markers on the roster.
    const m = metaOf(s), r = rowOf(s);
    const working = 30;
    const wd = { days: 30, working, auto: 30 };
    const rate = m.pay / 30;
    const auto = wd;
    const extras = r.extras || [];
    const bonus = extras.filter(e => e.type !== 'ot').reduce((a, e) => a + (Number(e.amount) || 0), 0) + (Number(r.bonus) || 0);
    const ot = extras.filter(e => e.type === 'ot').reduce((a, e) => a + (Number(e.amount) || 0), 0);
    const absent = Number(r.absent) || 0, advance = Number(r.advance) || 0, deduct = Number(r.deduct) || 0;
    const absDed = Math.round(rate * absent);
    const worked = Math.max(0, working - absent);
    let net = 0, err = '';
    if (formula.fn) { try { net = Number(formula.fn(m.pay, rate, auto.days, working, absent, worked, bonus, ot, advance, deduct, Math.min, Math.max, Math.round)); if (!isFinite(net)) { net = 0; err = 'Result is not a number'; } } catch (e) { err = 'Formula error'; } }
    return { m, r, wd, rate, absent, bonus, ot, extras, advance, deduct, absDed, net: Math.round(net), err, worked };
  };
  // One-time: add the two directors at KES 15,000 each.
  React.useEffect(() => {
    if (P.seededDirectors4) return;
    const meta = { ...P.meta };
    const dirIds = [];
    for (const name of ['Timothy Mutunga', 'Lyn Okaka']) {
      let s = (window.SAFI_STORE.get().staff || []).find(x => (x.name || '').toLowerCase() === name.toLowerCase());
      const id = s ? s.id : window.SAFI_STORE.addStaff({ name, role: 'Director', shift: 'All-day' });
      if (s && !s.role) window.SAFI_STORE.updateStaff(id, { role: 'Director' });
      dirIds.push(id);
      meta[id] = { ...(meta[id] || {}), empNo: name === 'Timothy Mutunga' ? 'SF-001' : 'SF-002', pay: (meta[id] && meta[id].pay) || 15000, off: (meta[id] && meta[id].off) || [0] };
    }
    const cur = (window.SAFI_STORE.get().settings || {}).payroll || { meta: {}, months: {} };
    const merged = { ...cur.meta, ...meta };
    // Renumber everyone else by position: SF-003, SF-004 … (directors are SF-001 and SF-002).
    const others = (window.SAFI_STORE.get().staff || []).filter(x => !dirIds.includes(x.id));
    others.forEach((x, i) => { merged[x.id] = { ...(merged[x.id] || {}), empNo: `SF-${String(i + 3).padStart(3, '0')}` }; });
    window.SAFI_STORE.setSetting('payroll', { ...cur, meta: merged, seededDirectors: true, seededDirectors2: true, seededDirectors3: true, seededDirectors4: true });
  }, []);
  const rows = staff.map(s => ({ s, ...calc(s) }));
  const tot = (k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
  const label = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
  const num = (v) => Math.round(v).toLocaleString('en-KE');

  function markPaid() {
    const r = payFor; if (!r) return;
    if (payM !== 'cash' && String(payTxn).trim().length < 5) { toast('Code needs at least 5 characters', 'error'); return; }
    // Recorded in Payroll only, not in Expenses (so staff don't see individual pay).
    setRow(r.s, { paidAt: SAFI_TIME.stamp(), method: payM, txn: payTxn.trim().toUpperCase(), paidNet: r.net });
    toast(`${r.s.name} marked paid · KES ${num(r.net)} · ${payTxn.trim().toUpperCase()}`);
    setPayFor(null); setPayTxn('');
  }

  const exportRows = () => rows.map(r => [r.m.empNo, r.s.name, r.s.role || '', r.m.off.map(d => PY_DAYS[d]).join(' & '), r.wd.working, r.absent, r.worked, num(r.m.pay), num(r.rate), num(r.absDed), num(r.bonus + r.ot), num(r.advance), num(r.deduct), num(r.net), r.r.paidAt ? `Paid ${r.r.paidAt}` : 'Not paid', r.r.note || '']);
  const head = ['Emp no.', 'Name', 'Role', 'Off days', 'Days', 'Absent', 'Worked', 'Monthly pay', 'Daily rate', 'Absence deduction', 'Bonus / overtime', 'Advance', 'Other deductions', 'Net pay', 'Status', 'Notes'];
  const fname = `Vazi Safi - Payroll - ${ym}`;
  const csv = () => { const cell = (v) => { const s = String(v ?? '').replace(/,/g, ''); return s; }; const text = [head.join(','), ...exportRows().map(r => r.map((c, i) => i === 15 || i === 1 || i === 2 ? `"${String(c).replace(/"/g, '""')}"` : cell(c)).join(','))].join('\n'); const b = new Blob(['\ufeff' + text], { type: 'text/csv' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = fname + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
  const pdf = () => window.expPDF && window.expPDF({ head, rows: exportRows(), money: [7, 8, 9, 10, 11, 12, 13], summary: [['Staff', rows.length], ['Gross', `KES ${num(tot('m') ? rows.reduce((a, r) => a + r.m.pay, 0) : 0)}`], ['Net to pay', `KES ${num(tot('net'))}`]] }, fname, `Payroll · ${label}`, (D.settings || {}).shopName);

  const NumIn = ({ v, on, w = 70 }) => <input type="number" min="0" className="safi-input safi-mono safi-py__in" style={{ width: w }} key={String(v)} defaultValue={v || ''} placeholder="0" onBlur={e => { const n = Number(e.target.value) || 0; if (n !== (Number(v) || 0)) on(n); }}/>;

  return (
    <>
      <Topbar title="Payroll" subtitle={`${label} · net pay = monthly pay − daily rate × absent days + bonus − advance − other deductions`}
        right={<>
          <input type="month" className="safi-input" style={{ width: 'auto' }} value={ym} onChange={e => setYm(e.target.value || ym)}/>
          <Button kind="ghost" icon="box" onClick={csv}>CSV</Button>
          <Button kind="ghost" icon="print" onClick={pdf}>PDF</Button>
        </>}/>

      <div className="safi-grid safi-grid--4">
        <StatCard label="Staff on payroll" value={rows.length} icon="staff"/>
        <StatCard label="Gross monthly pay" value={money(rows.reduce((a, r) => a + r.m.pay, 0))} icon="wallet"/>
        <StatCard label="Absence deductions" value={money(tot('absDed'))} icon="alert" deltaKind="down" delta={`${tot('absent')} absent days`}/>
        <StatCard label="Net to pay" value={money(tot('net'))} icon="check" delta={`${rows.filter(r => r.r.paidAt).length} of ${rows.length} paid`}/>
      </div>

      <Card title="Net pay formula" action={<span className="safi-cell-sub">Applies to every row</span>}>
        <div className="safi-py__fx">
          <input className="safi-input safi-mono" style={{ flex: 1 }} value={fx == null ? formulaSrc : fx} onChange={e => setFx(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { const c = pyCompile(fx == null ? formulaSrc : fx); if (c.err) toast(c.err, 'error'); else { save({ ...P, formula: fx == null ? formulaSrc : fx }); setFx(null); toast('Formula saved'); } } }}/>
          <Button kind="primary" size="sm" icon="check" disabled={fx == null || fx === formulaSrc} onClick={() => { const c = pyCompile(fx); if (c.err) { toast(c.err, 'error'); return; } save({ ...P, formula: fx }); setFx(null); toast('Formula saved'); }}>Save</Button>
          <Button kind="ghost" size="sm" onClick={() => { save({ ...P, formula: PY_DEFAULT }); setFx(null); toast('Default formula restored'); }}>Reset</Button>
        </div>
        {fx != null && pyCompile(fx).err && <p className="safi-hint" style={{ color: 'var(--red)', margin: '6px 0 0' }}>{pyCompile(fx).err}</p>}
        <p className="safi-hint" style={{ margin: '6px 0 0' }}>Names you can use: <b className="safi-mono">pay</b> monthly pay · <b className="safi-mono">rate</b> daily rate · <b className="safi-mono">days</b> = 30 · <b className="safi-mono">absent</b> · <b className="safi-mono">worked</b> · <b className="safi-mono">bonus</b> · <b className="safi-mono">ot</b> overtime · <b className="safi-mono">advance</b> · <b className="safi-mono">deduct</b>. Also min( ), max( ), round( ). Example: <span className="safi-mono">rate * worked + ot</span></p>
      </Card>

      <Card pad={false} title={`Payroll · ${label}`} action={<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><label className="safi-cell-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)}/> show inactive staff</label><Button kind="primary" size="sm" icon="plus" onClick={() => { setNewS({ name: '', role: 'Front Desk' }); setAddOpen(true); }}>Add staff</Button></div>}>
        <div className="safi-py-wrap">
          <table className="safi-table safi-py">
            <thead><tr>
              <th>Emp no.</th><th>Name</th><th>Role</th><th>Monthly pay</th><th>Off day(s)</th><th>Daily rate</th><th>Absent</th><th>Bonus &amp; OT</th><th>Advance</th><th>Other ded.</th><th title={formulaSrc}>Net pay ƒ</th><th>Notes</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.s.id} className={r.r.paidAt ? 'is-paid' : ''}>
                  <td><input className="safi-input safi-mono safi-py__in" style={{ width: 78 }} key={'e' + r.s.id + r.m.empNo} defaultValue={r.m.empNo} onBlur={e => { const v = e.target.value.trim().toUpperCase(); if (!v || v === r.m.empNo) { e.target.value = r.m.empNo; return; } if (setMeta(r.s, { empNo: v }) === false) e.target.value = r.m.empNo; }}/></td>
                  <td><b>{r.s.name}</b></td>
                  <td><input className="safi-input safi-py__in" style={{ width: 110 }} key={'r' + r.s.id + (r.s.role || '')} defaultValue={r.s.role || ''} placeholder="Role" onBlur={e => e.target.value.trim() !== (r.s.role || '') && window.SAFI_STORE.updateStaff(r.s.id, { role: e.target.value.trim() })}/></td>
                  <td><NumIn v={r.m.pay} w={90} on={(n) => setMeta(r.s, { pay: n })}/></td>
                  <td>
                    <div className="safi-py__days">
                      {PY_DAYS.map((d, i) => {
                        const on = r.m.off.includes(i);
                        return <button key={d} className={`safi-py__day${on ? ' is-on' : ''}`} title={on ? 'Off day' : 'Working day'} onClick={() => {
                          if (on) setMeta(r.s, { off: r.m.off.filter(x => x !== i) });
                          else if (r.m.off.length >= 2) toast('At most 2 off days a week', 'error');
                          else setMeta(r.s, { off: [...r.m.off, i].sort() });
                        }}>{d[0]}{d[1]}</button>;
                      })}
                    </div>
                  </td>
                  <td className="safi-mono">{num(r.rate)}</td>
                  <td><NumIn v={r.absent} w={56} on={(n) => n > 30 ? toast('At most 30 days', 'error') : setRow(r.s, { absent: n })}/>{r.absDed > 0 && <div className="safi-cell-sub safi-mono">−{num(r.absDed)}</div>}</td>
                  <td><button className="safi-py__extra" onClick={() => { setEx({ date: SAFI_TIME.day(), type: 'ot', amount: '', note: '' }); setExtraFor(r.s.id); }}>{(r.bonus + r.ot) ? <><b className="safi-mono">{num(r.bonus + r.ot)}</b><span className="safi-cell-sub">{r.extras.length} entr{r.extras.length === 1 ? 'y' : 'ies'}</span></> : <span className="safi-cell-sub">+ add</span>}</button></td>
                  <td><NumIn v={r.advance} on={(n) => setRow(r.s, { advance: n })}/></td>
                  <td><NumIn v={r.deduct} on={(n) => setRow(r.s, { deduct: n })}/></td>
                  <td className="safi-mono safi-py__net" title={r.err || formulaSrc}>{formula.err || r.err ? <span style={{ color: 'var(--red)' }}>error</span> : num(r.net)}</td>
                  <td><input className="safi-input safi-py__in" style={{ width: 140 }} key={'n' + r.s.id + ym + (r.r.note || '')} defaultValue={r.r.note || ''} placeholder="e.g. advance on 12th" onBlur={e => e.target.value !== (r.r.note || '') && setRow(r.s, { note: e.target.value })}/></td>
                  <td>{r.r.paidAt
                    ? <span className="safi-paidcell"><span className="safi-pill safi-pill--green"><Icon name="check" size={10}/> Paid {pyDm(r.r.paidAt)}</span><span className="safi-paidcell__code safi-mono">{r.r.method === 'bank' ? 'Bank' : r.r.method === 'cash' ? 'Cash' : 'M-Pesa'} · {r.r.txn || '—'}</span></span>
                    : <Button kind="ghost" size="sm" disabled={!r.m.pay} onClick={() => { setPayM('bank'); setPayTxn(''); setPayFor(r); }}>Mark paid</Button>}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan="14" className="safi-cell-sub" style={{ padding: 20 }}>No staff yet. Add staff in Management → Staff.</td></tr>}
            </tbody>
            {rows.length > 0 && <tfoot><tr>
              <td colSpan="3"><b>Total</b></td><td className="safi-mono"><b>{num(rows.reduce((a, r) => a + r.m.pay, 0))}</b></td><td colSpan="2"/>
              <td className="safi-mono">{tot('absent')} d</td><td className="safi-mono">{num(tot('bonus') + tot('ot'))}</td><td className="safi-mono">{num(tot('advance'))}</td><td className="safi-mono">{num(tot('deduct'))}</td>
              <td className="safi-mono safi-py__net"><b>{num(tot('net'))}</b></td><td colSpan="2"/>
            </tr></tfoot>}
          </table>
        </div>
        <p className="safi-hint" style={{ margin: '10px 16px 14px' }}>Daily rate = monthly pay ÷ 30. Off days are markers only and don't change pay. Off days, pay and employee numbers carry over month to month; absent days, bonus, advance and deductions are per month. "Mark paid" records the payment and its code here only. It is not added to Expenses; log the month's salaries there as one bulk payment (e.g. code BULKPAY).</p>
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add staff to payroll" width={420}
        footer={<><Button kind="ghost" onClick={() => setAddOpen(false)}>Cancel</Button><Button kind="primary" icon="plus" onClick={() => { if (!newS.name.trim()) { toast('Name required', 'error'); return; } window.SAFI_STORE.addStaff({ name: newS.name.trim(), role: newS.role.trim() || 'Staff', shift: 'Morning' }); toast(`${newS.name.trim()} added`); setAddOpen(false); }}>Add</Button></>}>
        <div className="safi-form">
          <label>Full name<input className="safi-input" autoFocus value={newS.name} onChange={e => setNewS({ ...newS, name: e.target.value })} placeholder="e.g. Lydia Wanjiru"/></label>
          <label>Role<input className="safi-input" value={newS.role} onChange={e => setNewS({ ...newS, role: e.target.value })} placeholder="e.g. Washer, Rider, Front Desk"/></label>
          <p className="safi-hint" style={{ margin: 0 }}>They also appear in Management → Staff and can be chosen as attendant.</p>
        </div>
      </Modal>

      {(() => { const s = allStaff.find(x => x.id === extraFor); if (!s) return null; const r = rowOf(s); const list = r.extras || [];
        const add = () => { const a = Number(ex.amount) || 0; if (!a) { toast('Enter an amount', 'error'); return; } setRow(s, { extras: [...list, { id: Date.now().toString(36), date: ex.date, type: ex.type, amount: a, note: ex.note.trim() }] }); setEx({ ...ex, amount: '', note: '' }); toast('Added'); };
        return (
          <Modal open onClose={() => setExtraFor(null)} title={`Bonus & overtime · ${s.name} · ${label}`} width={520}
            footer={<Button kind="primary" onClick={() => setExtraFor(null)}>Done</Button>}>
            <div className="safi-form">
              {list.length ? <table className="safi-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Note</th><th/></tr></thead><tbody>
                {list.map(e => <tr key={e.id}><td>{pyDm(e.date)}</td><td>{e.type === 'ot' ? 'Overtime' : 'Bonus'}</td><td className="safi-mono">{num(e.amount)}</td><td className="safi-cell-sub">{e.note || '—'}</td><td><button className="safi-rowlink" style={{ color: 'var(--red)' }} onClick={() => setRow(s, { extras: list.filter(x => x.id !== e.id) })}>Remove</button></td></tr>)}
              </tbody></table> : <p className="safi-cell-sub" style={{ margin: 0 }}>Nothing added this month yet. Add bonus or overtime on the day it happens.</p>}
              <div className="safi-py__exrow">
                <input type="date" className="safi-input" value={ex.date} onChange={e => setEx({ ...ex, date: e.target.value })}/>
                <div className="safi-seg">{[['ot', 'Overtime'], ['bonus', 'Bonus']].map(([k, l]) => <button key={k} className={`safi-seg__btn ${ex.type === k ? 'is-active' : ''}`} onClick={() => setEx({ ...ex, type: k })}>{l}</button>)}</div>
                <input type="number" min="0" className="safi-input safi-mono" style={{ width: 100 }} placeholder="KES" value={ex.amount} onChange={e => setEx({ ...ex, amount: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()}/>
                <input className="safi-input" style={{ flex: 1 }} placeholder="Note (e.g. Sunday shift)" value={ex.note} onChange={e => setEx({ ...ex, note: e.target.value })} onKeyDown={e => e.key === 'Enter' && add()}/>
                <Button kind="primary" size="sm" icon="plus" onClick={add}>Add</Button>
              </div>
            </div>
          </Modal>
        ); })()}

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title={payFor ? `Pay ${payFor.s.name} · ${label}` : ''} width={420}
        footer={<><Button kind="ghost" onClick={() => setPayFor(null)}>Cancel</Button><Button kind="primary" icon="check" onClick={markPaid}>Mark paid</Button></>}>
        {payFor && <div className="safi-form">
          <div className="safi-callout"><Icon name="wallet" size={14}/><span>Net pay <b className="safi-mono">KES {num(payFor.net)}</b> · {payFor.worked} days worked, {payFor.absent} absent</span></div>
          <label>Paid by
            <div className="safi-seg safi-seg--full">{[['bank', 'Bank'], ['mpesa', 'M-Pesa']].map(([k, l]) => <button key={k} className={`safi-seg__btn ${payM === k ? 'is-active' : ''}`} onClick={() => setPayM(k)}>{l}</button>)}</div>
          </label>
          {<label>Transaction code (min. 5)<input className="safi-input safi-mono" value={payTxn} onChange={e => setPayTxn(e.target.value.toUpperCase())} placeholder="Last 5, e.g. KL2M9"/></label>}
        </div>}
      </Modal>
    </>
  );
}

Object.assign(window, { PayrollScreen });
