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
      body: tpl.replace(/\{name\}/g, firstName(c.name)).replace(/\{days\}/g, days),
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

function WinbackCard({ readOnly }) {
  const D = useStore();
  const st = D.settings || {};
  const days = Number(st.winbackDays) || 14;
  const due = winbackDue(D, days);
  const [show, setShow] = useStateOps(false);
  return (
    <Card title="Win-back messages" action={<span className="safi-cell-sub">For customers who haven't come back</span>}>
      <div className="safi-form" style={{ maxWidth: 760 }}>
        {readOnly && <div className="safi-callout"><Icon name="lock" size={14}/><span>Win-back messages are set by Management. Automatic sending is <b>{st.winbackAuto ? 'ON' : 'OFF'}</b>.</span></div>}
        <div className="safi-form__row">
          <label>Send after
            <select className="safi-input" value={days} disabled={readOnly} onChange={e => window.SAFI_STORE.setSetting('winbackDays', Number(e.target.value))}>
              {[7, 10, 14, 15, 21, 30, 45, 60].map(n => <option key={n} value={n}>{n} days without an order</option>)}
            </select>
          </label>
        </div>
        {!readOnly && <label className="safi-toggle safi-toggle--lg">
          <input type="checkbox" checked={!!st.winbackAuto} onChange={e => window.SAFI_STORE.setSetting('winbackAuto', e.target.checked)}/>
          <span/>
          <div><b>Send automatically once a day</b></div>
        </label>}
        <label><span>{'Message (tokens: {name} {days})'}</span>
          <textarea className="safi-input" rows="3" readOnly={readOnly} defaultValue={(D.smsTemplates || {}).winback || WINBACK_DEFAULT}
            onBlur={e => window.SAFI_STORE.setSmsTemplate('winback', e.target.value)}/>
        </label>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <b>{due.length} customer{due.length === 1 ? '' : 's'} due now</b>
          {due.length > 0 && <button className="safi-rowlink" onClick={() => setShow(!show)}>{show ? 'Hide list' : 'Show list'}</button>}
          {due.length > 0 && !readOnly && <Button kind="primary" icon="sms" onClick={() => { sendWinback(D, due, days); toast(`${due.length} win-back message(s) sent`, 'success'); }}>Send to all {due.length}</Button>}
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

// A thermal roll has no fixed page length. Size each printed page to its content so
// the paper (and the PDF) ends right after the last line; the printer cuts at each page end.
function fitRollPages() {
  // Retired in v2.4.6: page length is now set by the measuring code in app.jsx (beforeprint),
  // which measures at the real 76mm print width. This older version measured at screen size
  // ×1.25 and, loading later, overrode it, giving ~360mm pages.
  const old = document.getElementById('safi-roll-pages'); if (old) old.remove();
  return;
  // Print text is ~20% larger than on screen, so allow for it; the printer cuts the blank tail.
  const mm = (el) => Math.ceil(el.getBoundingClientRect().height * 1.25 * 25.4 / 96) + 8;
  const css = [];
  const roll = document.querySelector('.safi-jcsheet--roll');
  if (roll) {
    const jc = roll.querySelector('.safi-jc'), dn = roll.querySelector('.safi-dn');
    // The cut line rides on the job card's page; otherwise it lands on its own default-size page (a blank sheet).
    const tear = roll.querySelector('.safi-tear');
    const tearMm = tear ? Math.ceil(tear.getBoundingClientRect().height * 25.4 / 96) + 4 : 0;
    if (jc) css.push(`@page jcp { size: 80mm ${mm(jc) + tearMm}mm; margin: 0 } .safi-jcsheet--roll .safi-jc, .safi-jcsheet--roll .safi-tear { page: jcp }`);
    if (dn) css.push(`@page dnp { size: 80mm ${mm(dn)}mm; margin: 0 } .safi-jcsheet--roll .safi-dn { page: dnp }`);
  } else {
    const rc = document.querySelector('.safi-receipt-wrap #safi-print-area');
    if (rc) css.push(`@page { size: 80mm ${mm(rc)}mm; margin: 0 }`);
  }
  if (!css.length) return;
  const s = document.createElement('style'); s.id = 'safi-roll-pages'; s.media = 'print'; s.textContent = css.join('\n');
  document.head.appendChild(s);
  // Remove once printed so later A4 prints (reports, lists) are not forced onto the roll size.
  window.addEventListener('afterprint', () => { const x = document.getElementById('safi-roll-pages'); if (x) x.remove(); }, { once: true });
}
window.fitRollPages = fitRollPages;

function printDoc(kind, orderId) {
  window.SAFI_STORE.logPrint(kind, orderId);
  fitRollPages();
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
  const [open, setOpen] = useStateOps(false);
  const [period, setPeriod] = useStateOps('today');
  const days = { today: 1, week: 7, month: 30, year: 365 }[period];
  const d0 = new Date(); d0.setDate(d0.getDate() - (days - 1));
  const from = opsDay(d0);
  const orders = D.orders.filter(o => String(o.in || '').slice(0, 10) >= from);
  // Broad streams: Laundry (all wet-cleaned items), Dry Cleaning, Shoes.
  const STREAMS = [['laundry', 'Laundry', 'wash'], ['drycleaning', 'Dry Cleaning', 'dry'], ['shoes', 'Shoes', 'shoe']];
  const per = {}, perO = {};
  for (const o of orders) for (const it of o.items || []) {
    const cat = ((D.services.find(s => s.id === it.svc) || {}).category) || 'other';
    if (!STREAMS.some(x => x[0] === cat)) continue;
    const set = per[cat] = per[cat] || new Set();
    set.add(o.customer || 'walk:' + o.id);
    const os = perO[cat] = perO[cat] || new Set(); os.add(o.id);
  }
  const all = new Set(orders.map(o => o.customer || 'walk:' + o.id));
  const rows = STREAMS.map(([k, l, ic]) => ({ k, l, ic, n: per[k] ? per[k].size : 0, no: perO[k] ? perO[k].size : 0 }));
  const sd = window.SAFI_PRICING && window.SAFI_PRICING.studentDayLive();
  const label = { today: 'today', week: 'last 7 days', month: 'last 30 days', year: 'last 12 months' }[period];
  return (
    <>
      <button className="safi-recent-open" onClick={() => setOpen(true)}>
        <span className="safi-recent-open__ico"><Icon name="users" size={18}/></span>
        <span className="safi-recent-open__txt"><b>Clients by service</b></span>
        <span className="safi-recent-open__go">View ›</span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Clients by service · ${label}`} width={900}
        footer={<Button kind="ghost" onClick={() => setOpen(false)}>Close</Button>}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap' }}>
          <span className="safi-cell-sub">{all.size} client{all.size === 1 ? '' : 's'} · {orders.length} order{orders.length === 1 ? '' : 's'}{sd ? ' · Student Thursday is on' : ''}</span>
          <div className="safi-seg">{[['today', 'Today'], ['week', '7 days'], ['month', 'Month'], ['year', 'Year']].map(([k, l]) => <button key={k} className={`safi-seg__btn ${period === k ? 'is-active' : ''}`} onClick={() => setPeriod(k)}>{l}</button>)}</div>
        </div>
        <div className="safi-svcday safi-svcday--streams">
          {rows.map(({ k, l, ic, n, no }) => <div key={k} className={`safi-svcday__c safi-svcday__c--${k}`}><span className="safi-svcday__ico"><Icon name={ic} size={18}/></span><span className="safi-svcday__n">{n}</span><span className="safi-svcday__l">{l} · client{n === 1 ? '' : 's'}</span><span className="safi-cell-sub">{no} order{no === 1 ? '' : 's'}</span></div>)}
        </div>
      </Modal>
    </>
  );
}

Object.assign(window, { DispatchCalendar, safiChime, DispatchReminders, WinbackCard, ActivityCounts, printDoc, CustomerTypeahead, ServiceClientsToday });
