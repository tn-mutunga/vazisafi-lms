// ─── Operations: dispatch reminders, win-back SMS, activity counts ────────
const { useState: useStateOps, useEffect: useEffectOps } = React;

const opsDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const opsOpen = d => d.status !== 'completed' && d.status !== 'cancelled' && d.status !== 'failed';

// Banner on every screen: today's pickups/deliveries and anything overdue.
// Also pops a reminder 30 minutes before each slot.
// Two-tone chime, generated so it works offline with no sound file.
function safiChime(urgent) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    const ctx = safiChime.ctx = safiChime.ctx || new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    const notes = urgent ? [880, 660, 880, 660] : [660, 880];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + i * 0.22;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.22);
    });
  } catch (e) {}
}

function DispatchReminders({ setView }) {
  const D = useStore();
  const soundOn = (D.settings || {}).dispatchChime !== false;
  const [flash, setFlash] = useStateOps(false);
  const [, tick] = useStateOps(0);
  useEffectOps(() => { const t = setInterval(() => tick(x => x + 1), 60000); return () => clearInterval(t); }, []);
  const today = opsDay();
  const now = new Date();
  const hhmm = now.toTimeString().slice(0, 5);
  const list = (D.dispatch || []).filter(opsOpen);
  const overdue = list.filter(d => d.slotDate && (d.slotDate < today || (d.slotDate === today && d.slotEnd && d.slotEnd < hhmm)));
  const dueToday = list.filter(d => d.slotDate === today && !overdue.includes(d));

  useEffectOps(() => {
    const seen = JSON.parse(sessionStorage.getItem('safi_dx_reminded') || '{}');
    const soon = new Date(now.getTime() + 30 * 60000).toTimeString().slice(0, 5);
    let rang = false, urgent = false;
    for (const d of dueToday) {
      if (!d.slotStart || seen[d.id] || d.slotStart > soon) continue;
      const c = D.customers.find(x => x.id === d.customerId);
      toast(`${d.type === 'pickup' ? 'Pickup' : 'Delivery'} at ${d.slotStart}: ${c?.name || d.address}`, 'error');
      seen[d.id] = 1; rang = true;
    }
    // Overdue jobs chime again every 15 minutes until they are dealt with.
    const slot = Math.floor(Date.now() / 900000);
    for (const d of overdue) { const k = 'late:' + d.id; if (seen[k] !== slot) { seen[k] = slot; rang = true; urgent = true; } }
    sessionStorage.setItem('safi_dx_reminded', JSON.stringify(seen));
    if (rang) { if (soundOn) safiChime(urgent); setFlash(true); setTimeout(() => setFlash(false), 6000); }
  });

  if (!overdue.length && !dueToday.length) return null;
  return (
    <div className={`safi-dxbar ${overdue.length ? 'is-late' : ''} ${flash ? 'is-flash' : ''}`}>
      <Icon name="truck" size={16}/>
      <span>
        {dueToday.length > 0 && <b>{dueToday.length} pickup/delivery{dueToday.length === 1 ? '' : 's'} today</b>}
        {dueToday.length > 0 && overdue.length > 0 && ' · '}
        {overdue.length > 0 && <b className="safi-dxbar__late">{overdue.length} overdue</b>}
        {dueToday[0]?.slotStart && <span className="safi-cell-sub"> · next at {[...dueToday].filter(d => d.slotStart).sort((a, b) => a.slotStart.localeCompare(b.slotStart))[0]?.slotStart}</span>}
      </span>
      <button className="safi-dxbar__snd" title={soundOn ? 'Chime on' : 'Chime off'} onClick={() => window.SAFI_STORE.setSetting('dispatchChime', !soundOn)}>{soundOn ? 'Chime on' : 'Chime off'}</button>
      <button className="safi-rowlink" onClick={() => setView('dispatch')}>Open dispatch →</button>
    </div>
  );
}

// Month calendar for the dispatch board. Each day shows how many jobs are booked.
function DispatchCalendar({ value, onPick }) {
  const D = useStore();
  const [base, setBase] = useStateOps(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = opsDay();
  const per = {};
  for (const d of D.dispatch || []) if (d.slotDate && d.status !== 'cancelled') {
    const p = per[d.slotDate] = per[d.slotDate] || { pickup: 0, delivery: 0, open: 0 };
    p[d.type === 'pickup' ? 'pickup' : 'delivery']++; if (opsOpen(d)) p.open++;
  }
  const y = base.getFullYear(), m = base.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const key = n => `${y}-${String(m + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
  return (
    <Card title={base.toLocaleDateString('en-KE', { month: 'long', year: 'numeric' })} action={
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {value && <button className="safi-rowlink" onClick={() => onPick('')}>Show all days</button>}
        <Button kind="ghost" size="sm" onClick={() => setBase(new Date(y, m - 1, 1))}>←</Button>
        <Button kind="ghost" size="sm" onClick={() => { const d = new Date(); setBase(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
        <Button kind="ghost" size="sm" onClick={() => setBase(new Date(y, m + 1, 1))}>→</Button>
      </div>}>
      <div className="safi-cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="safi-cal__h">{d}</div>)}
        {cells.map((n, i) => {
          if (!n) return <div key={i}/>;
          const k = key(n), p = per[k];
          return (
            <button key={i} className={`safi-cal__d ${k === today ? 'is-today' : ''} ${k === value ? 'is-sel' : ''} ${p && p.open && k < today ? 'is-late' : ''}`} onClick={() => onPick(k === value ? '' : k)}>
              <span className="safi-cal__n">{n}</span>
              {p && <span className="safi-cal__c">{p.pickup > 0 && <i className="is-p">{p.pickup}↑</i>}{p.delivery > 0 && <i className="is-d">{p.delivery}↓</i>}</span>}
            </button>
          );
        })}
      </div>
      <p className="safi-cell-sub" style={{ margin: '8px 0 0' }}>↑ pickups · ↓ deliveries. Click a day to show only its jobs. Red days have jobs still open.</p>
    </Card>
  );
}

// Customers whose last order is older than N days and who have not had a
// win-back text since that order.
function winbackDue(D, days) {
  const last = {};
  for (const o of D.orders) if (o.customer && (!last[o.customer] || o.in > last[o.customer])) last[o.customer] = o.in;
  const cutoff = opsDay(new Date(Date.now() - days * 86400000));
  const texted = {};
  // Keyed by phone so it still works after messages sync in from another laptop.
  const ph = c => `${c.prefix || ''} ${c.phone}`.trim();
  for (const m of D.messages || []) if (m.stage === 'winback' && m.to && m.date > (texted[m.to] || '')) texted[m.to] = m.date;
  return D.customers.filter(c => c.phone && last[c.id] && last[c.id].slice(0, 10) <= cutoff && !(texted[ph(c)] && texted[ph(c)] >= last[c.id]))
    .map(c => ({ c, last: last[c.id].slice(0, 10) }));
}
const WINBACK_DEFAULT = 'Hi {name}, we miss you at Vazi Safi! It has been {days} days since your last laundry. Drop off this week and we will have it fresh for you. Karibu!';
function sendWinback(D, rows, days) {
  const tpl = (D.smsTemplates || {}).winback || WINBACK_DEFAULT;
  for (const { c } of rows) {
    window.SAFI_STORE.logMessage({
      to: `${c.prefix || ''} ${c.phone}`.trim(), name: c.name,
      body: tpl.replace(/\{name\}/g, c.name.split(' ')[0]).replace(/\{days\}/g, days),
      orderId: '', stage: 'winback', method: 'sms', customerId: c.id,
    });
  }
}
// Automatic run, at most once a day per laptop, when switched on.
setInterval(() => {
  const S = window.SAFI_STORE; if (!S) return;
  const D = S.get ? S.get() : null; if (!D) return;
  const st = D.settings || {};
  if (!st.winbackAuto) return;
  const today = opsDay();
  if (st.winbackLastRun === today) return;
  const days = Number(st.winbackDays) || 14;
  sendWinback(D, winbackDue(D, days), days);
  S.setSetting('winbackLastRun', today);
}, 60000);

function WinbackCard() {
  const D = useStore();
  const st = D.settings || {};
  const days = Number(st.winbackDays) || 14;
  const due = winbackDue(D, days);
  const [show, setShow] = useStateOps(false);
  return (
    <Card title="Win-back messages" action={<span className="safi-cell-sub">For customers who haven't come back</span>}>
      <div className="safi-form" style={{ maxWidth: 760 }}>
        <div className="safi-form__row">
          <label>Send after
            <select className="safi-input" value={days} onChange={e => window.SAFI_STORE.setSetting('winbackDays', Number(e.target.value))}>
              {[7, 10, 14, 15, 21, 30, 45, 60].map(n => <option key={n} value={n}>{n} days without an order</option>)}
            </select>
          </label>
        </div>
        <label className="safi-toggle safi-toggle--lg">
          <input type="checkbox" checked={!!st.winbackAuto} onChange={e => window.SAFI_STORE.setSetting('winbackAuto', e.target.checked)}/>
          <span/>
          <div><b>Send automatically once a day</b></div>
        </label>
        <label><span>{'Message (tokens: {name} {days})'}</span>
          <textarea className="safi-input" rows="3" defaultValue={(D.smsTemplates || {}).winback || WINBACK_DEFAULT}
            onBlur={e => window.SAFI_STORE.setSmsTemplate('winback', e.target.value)}/>
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>{due.length} customer{due.length === 1 ? '' : 's'} due now</b>
          {due.length > 0 && <button className="safi-rowlink" onClick={() => setShow(!show)}>{show ? 'Hide list' : 'Show list'}</button>}
          {due.length > 0 && <Button kind="primary" icon="sms" onClick={() => { sendWinback(D, due, days); toast(`${due.length} win-back message(s) sent`, 'success'); }}>Send to all {due.length}</Button>}
        </div>
        {show && due.length > 0 && (
          <ul className="safi-wb__list">
            {due.map(({ c, last }) => <li key={c.id}><span>{c.name}</span><span className="safi-cell-sub safi-mono">last order {last}</span></li>)}
          </ul>
        )}
        <p className="safi-cell-sub" style={{ margin: 0 }}>Each customer gets one message per absence. It goes again only after they order and then stay away for {days} days.</p>
      </div>
    </Card>
  );
}

// Orders taken and documents printed, today and this month.
function ActivityCounts() {
  const D = useStore();
  const today = opsDay();
  const month = today.slice(0, 7);
  const isDay = v => String(v || '').slice(0, 10) === today;
  const isMonth = v => String(v || '').slice(0, 7) === month;
  const local = v => { if (!v) return ''; const s = String(v); return s.includes('T') ? opsDay(new Date(s)) + s.slice(10) : s; };
  const prints = (D.auditLog || []).filter(a => String(a.action || '').startsWith('print.'));
  const count = (kind, f) => prints.filter(a => a.action === 'print.' + kind && f(local(a.at))).length;
  const rows = [
    ['Orders taken', D.orders.filter(o => isDay(o.in)).length, D.orders.filter(o => isMonth(o.in)).length],
    ['Receipts printed', count('receipt', isDay), count('receipt', isMonth)],
    ['Job cards printed', count('jobcard', isDay), count('jobcard', isMonth)],
    ['Delivery notes printed', count('jobcard', isDay), count('jobcard', isMonth)],
  ];
  const monthName = new Date().toLocaleDateString('en-KE', { month: 'long' });
  return (
    <Card title="Orders & printing" action={<span className="safi-cell-sub">Counts from this laptop and synced tills</span>}>
      <table className="safi-counts">
        <thead><tr><th></th><th>Today</th><th>{monthName}</th></tr></thead>
        <tbody>{rows.map(([l, d, m]) => <tr key={l}><td>{l}</td><td className="safi-mono">{d}</td><td className="safi-mono">{m}</td></tr>)}</tbody>
      </table>
      <p className="safi-cell-sub" style={{ margin: '10px 0 0' }}>Job card and delivery note print on one sheet, so their counts match. A receipt count far below orders taken means receipts are not being printed.</p>
    </Card>
  );
}

function printDoc(kind, orderId) {
  window.SAFI_STORE.logPrint(kind, orderId);
  window.print();
}

// Type a saved customer's name or phone; pick from the matches.
function CustomerTypeahead({ value, onChange }) {
  const D = useStore();
  const [q, setQ] = useStateOps('');
  const [open, setOpen] = useStateOps(false);
  const [hi, setHi] = useStateOps(0);
  const sel = D.customers.find(c => c.id === value);
  if (sel && !open) return (
    <div className="safi-ta__sel safi-input">
      <span><b>{sel.name}</b> <span className="safi-cell-sub">{sel.prefix} {sel.phone}</span></span>
      <button type="button" className="safi-rowlink" onClick={() => { onChange(''); setQ(''); setOpen(true); }}>Change</button>
    </div>
  );
  const term = q.trim().toLowerCase();
  const digits = term.replace(/\D/g, '').replace(/^(254|0)/, '');
  const list = term ? D.customers.filter(c => c.name.toLowerCase().includes(term) || (digits && String(c.phone || '').replace(/\D/g, '').includes(digits))).slice(0, 8) : [];
  const pick = c => { onChange(c.id); setQ(''); setOpen(false); };
  return (
    <div className="safi-ta">
      <input className="safi-input" placeholder="Type name or phone…" value={q} autoComplete="off"
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, list.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
          if (e.key === 'Enter' && list[hi]) { e.preventDefault(); pick(list[hi]); }
        }}/>
      {open && term && (
        <div className="safi-ta__list">
          {list.map((c, i) => (
            <button type="button" key={c.id} className={`safi-ta__item ${i === hi ? 'is-hi' : ''}`} onMouseDown={() => pick(c)}>
              <b>{c.name}</b><span>{c.prefix} {c.phone}</span>
            </button>
          ))}
          {!list.length && <div className="safi-cell-sub" style={{ padding: 10 }}>No saved customer matches. Add them under Customers first.</div>}
        </div>
      )}
    </div>
  );
}

// Distinct clients per service for today's orders (walk-ins count once per order).
function ServiceClientsToday() {
  const D = useStore();
  const today = opsDay();
  const orders = D.orders.filter(o => String(o.in || '').slice(0, 10) === today);
  const per = {};
  for (const o of orders) for (const it of o.items || []) {
    const set = per[it.svc] = per[it.svc] || new Set();
    set.add(o.customer || 'walk:' + o.id);
  }
  const all = new Set(orders.map(o => o.customer || 'walk:' + o.id));
  const rows = D.services.map(s => ({ s, n: per[s.id] ? per[s.id].size : 0 })).filter(r => r.n > 0).sort((a, b) => b.n - a.n);
  const sd = window.SAFI_PRICING && window.SAFI_PRICING.studentDayLive();
  return (
    <Card title={`Clients by service · today`} action={<span className="safi-cell-sub">{all.size} client{all.size === 1 ? '' : 's'} in total{sd ? ' · Student Thursday is on' : ''}</span>}>
      {rows.length ? (
        <div className="safi-svcday">
          {rows.map(({ s, n }) => <div key={s.id} className="safi-svcday__c"><span className="safi-svcday__n">{n}</span><span className="safi-svcday__l">{s.name}</span></div>)}
        </div>
      ) : <p className="safi-cell-sub" style={{ margin: 0 }}>No orders yet today.</p>}
    </Card>
  );
}

Object.assign(window, { DispatchCalendar, safiChime, DispatchReminders, WinbackCard, ActivityCounts, printDoc, CustomerTypeahead, ServiceClientsToday });
