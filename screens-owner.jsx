// Vazi Safi — Owner screens (live store)
const { useState: useStateOw, useRef: useRefOw } = React;

// ─── Owner Dashboard ─────────────────────────────────────────────────────
// ─── Daily revenue for a chosen month ────────────────────────────────────
function MonthRevenue({ orders, money }) {
  const now = new Date();
  const [ym, setYm] = useStateOw({ y: now.getFullYear(), m: now.getMonth() });
  const days = new Date(ym.y, ym.m + 1, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const prefix = `${ym.y}-${pad(ym.m + 1)}`;
  const todayKey = SAFI_TIME.day(now);
  const data = Array.from({ length: days }, (_, i) => {
    const key = `${prefix}-${pad(i + 1)}`;
    const list = orders.filter(o => String(o.in).startsWith(key));
    return { day: i + 1, key, v: list.reduce((s, o) => s + (o.total || 0), 0), n: list.length, future: key > todayKey };
  });
  const max = Math.max(1, ...data.map(d => d.v));
  const total = data.reduce((s, d) => s + d.v, 0);
  const isCurrent = ym.y === now.getFullYear() && ym.m === now.getMonth();
  const label = new Date(ym.y, ym.m, 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
  const shift = d => setYm(p => { const x = new Date(p.y, p.m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });
  return (
    <Card title={`Daily revenue · ${label}`} action={
      <div className="safi-month-nav">
        <span className="safi-cell-sub">Total <b className="safi-mono">{money(total)}</b></span>
        <button onClick={() => shift(-1)} aria-label="Previous month">‹</button>
        <button onClick={() => shift(1)} disabled={isCurrent} aria-label="Next month">›</button>
      </div>
    }>
      <SafiChart labels={data.map(d => String(d.day))} height={230} yLabel="KES" fmt={(v) => money(v)}
        highlight={data.findIndex(d => d.key === todayKey)}
        series={[{ name: 'Revenue', color: 'var(--brand)', values: data.map(d => d.v) }]}/>
    </Card>
  );
}

// ─── Busiest hours: orders taken in (intake) and loads started washing, by hour ───
function BusyHours() {
  const D = useStore();
  const [per, setPer] = useStateOw('today');
  const days = per === 'today' ? 1 : per === 'week' ? 7 : 30;
  const from = SAFI_TIME.daysAgo(days - 1);
  const hours = Array.from({ length: 15 }, (_, i) => 7 + i);
  const intake = hours.map(() => 0), wash = hours.map(() => 0);
  const hourOf = (stamp) => { const m = String(stamp || '').match(/[ T](\d{1,2}):\d{2}/); if (m) return parseInt(m[1], 10); const d = new Date(stamp); return isNaN(d) ? -1 : d.getHours(); };
  const dayOf = (stamp) => { const s = String(stamp || ''); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10); const d = new Date(s); return isNaN(d) ? '' : SAFI_TIME.day(d); };
  const bump = (arr, stamp) => { const i = hourOf(stamp) - 7; if (i >= 0 && i < arr.length) arr[i]++; };
  for (const ord of D.orders) {
    const inAt = window.SAFI_STORE.stageTimes(ord.id).intake || ord.in;
    if (dayOf(inAt) >= from) bump(intake, inAt);
    const w = window.SAFI_STORE.stageTimes(ord.id).washing;
    if (w && dayOf(w) >= from) bump(wash, w);
  }
  const peak = (arr) => { const m = Math.max(...arr); return m ? `${pad2(hours[arr.indexOf(m)])}:00` : '—'; };
  return (
    <Card title="Busiest hours" action={
      <div className="safi-seg">{[['today', 'Today'], ['week', '7 days'], ['month', 'Month']].map(([k, l]) => <button key={k} className={`safi-seg__btn ${per === k ? 'is-active' : ''}`} onClick={() => setPer(k)}>{l}</button>)}</div>
    }>
      <SafiChart integer area labelEvery={3} labels={hours.map(h => `${pad2(h)}:00`)} height={190} yLabel="Orders" fmt={(v) => `${v} order${v === 1 ? '' : 's'}`}
        series={[{ name: 'Intake', color: 'var(--brand)', values: intake }, { name: 'Washing started', color: '#38bdf8', values: wash }]}/>
      <p className="safi-cell-sub" style={{ margin: '8px 0 0' }}>Peak intake {peak(intake)} · peak washing {peak(wash)}</p>
    </Card>
  );
}
const pad2 = (n) => String(n).padStart(2, '0');

// ─── Average time in Washing / Holding / Drying ───────────────────────────
function StageAverages() {
  const D = useStore();
  const [per, setPer] = useStateOw('day');
  const fmt = (ms) => { if (!ms) return '—'; const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}hr ${m % 60}min` : `${m} min`; };
  // One pass over the audit log: when each order entered each stage.
  const T = {};
  for (const a of [...(D.auditLog || [])].reverse()) {
    if (a.action !== 'order.stage' || !a.meta || !a.meta.stage) continue;
    const m = T[a.target] = T[a.target] || {};
    if (!m[a.meta.stage]) m[a.meta.stage] = new Date(a.at).getTime();
  }
  const now = new Date();
  const from = per === 'day' ? SAFI_TIME.day() : per === 'week' ? SAFI_TIME.daysAgo(6) : SAFI_TIME.day(new Date(now.getFullYear(), now.getMonth(), 1));
  const acc = { washing: [], holding: [], drying: [] };
  for (const id in T) {
    const t = T[id];
    if (!t.washing || SAFI_TIME.day(new Date(t.washing)) < from) continue;
    const wEnd = t.holding || t.drying; if (wEnd > t.washing) acc.washing.push(wEnd - t.washing);
    if (t.holding && t.drying > t.holding) acc.holding.push(t.drying - t.holding);
    const dEnd = [t.ironing, t.ready, t.collected].filter(Boolean).sort((a, b) => a - b)[0];
    if (t.drying && dEnd > t.drying) acc.drying.push(dEnd - t.drying);
  }
  const avg = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const rows = [['washing', 'Washing', 'blue'], ['holding', 'Holding', 'teal'], ['drying', 'Drying', 'brown']];
  return (
    <Card title="Average time per stage" action={
      <div className="safi-seg">{[['day', 'Today'], ['week', '7 days'], ['month', 'This month']].map(([k, l]) => <button key={k} className={`safi-seg__btn ${per === k ? 'is-active' : ''}`} onClick={() => setPer(k)}>{l}</button>)}</div>
    }>
      <div className="safi-stageavg">
        {rows.map(([k, l, c]) => (
          <div key={k} className={`safi-stageavg__i safi-stageavg__i--${c}`}>
            <span className="safi-stageavg__l">{l}</span>
            <b className="safi-stageavg__v">{fmt(avg(acc[k]))}</b>
            <span className="safi-cell-sub">{acc[k].length} order{acc[k].length === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>
      <p className="safi-hint" style={{ marginTop: 8 }}>Counted from when each order started washing. Holding only applies to orders that waited for a dryer.</p>
    </Card>
  );
}

function OwnerDashboard({ lang, money, setView }) {
  const D = useStore();
  const todayStr = SAFI_TIME.day();
  // Revenue = value of orders taken (sales). Collected = money actually received.
  const today = D.orders.filter(o => o.in.startsWith(todayStr)).reduce((s, o) => s + (o.total || 0), 0);
  const collectedToday = D.payments.filter(p => String(p.date).startsWith(todayStr)).reduce((s, p) => s + (p.amount || 0), 0);
  const avgOrder = D.orders.length ? Math.round(D.orders.reduce((s, o) => s + o.total, 0) / D.orders.length) : 0;
  const totalExpenses = D.expenses.reduce((s, e) => s + e.amount, 0);
  const _n = new Date();
  const localToday = `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, '0')}-${String(_n.getDate()).padStart(2, '0')}`;
  const expensesTodayList = D.expenses.filter(e => String(e.date).startsWith(localToday));
  const expensesToday = expensesTodayList.reduce((s, e) => s + e.amount, 0);
  const totalRevenue = D.orders.reduce((s, o) => s + (o.total || 0), 0);
  const totalCollected = D.orders.reduce((s, o) => s + (o.paid || 0), 0);
  const outstanding = Math.max(0, totalRevenue - totalCollected);
  const netProfit = totalRevenue - totalExpenses;

  const topCustomers = [...D.customers].sort((a, b) => b.spend - a.spend).slice(0, 5);

  // ── TODAY's 3-category breakdown (computed live) ─────────────────────────
  const catLabels = { laundry: 'Laundry', drycleaning: 'Dry Cleaning', shoes: 'Shoes', other: 'Other' };
  const catColors = { laundry: 'blue', drycleaning: 'violet', shoes: 'amber', other: 'gray' };
  const todayOrders = D.orders.filter(o => o.in.startsWith(todayStr));
  const byCategoryToday = ['laundry', 'drycleaning', 'shoes', 'other'].map(cat => {
    const total = todayOrders.reduce((s, o) => {
      return s + o.items.reduce((ss, it) => {
        const svc = D.services.find(x => x.id === it.svc);
        return ss + ((svc?.category || 'other') === cat ? it.price : 0);
      }, 0);
    }, 0);
    return { cat, label: catLabels[cat], color: catColors[cat], total };
  });
  const catTotalToday = byCategoryToday.reduce((s, c) => s + c.total, 0) || 1;

  // ── Real "By service" HBar (today) ───────────────────────────────────────
  const byServiceToday = D.services.map(svc => {
    const value = todayOrders.reduce((s, o) =>
      s + o.items.filter(it => it.svc === svc.id).reduce((ss, it) => ss + it.price, 0), 0);
    return { label: svc.name, value };
  }).filter(r => r.value > 0).sort((a, b) => b.value - a.value);

  // ── Real "By payment method" Donut (today) ───────────────────────────────
  const byMethodToday = ['mpesa', 'bank'].map(m => {
    const value = D.payments.filter(p => p.method === m && p.date.startsWith(todayStr)).reduce((s, p) => s + p.amount, 0);
    return { label: m === 'mpesa' ? 'M-Pesa' : m === 'cash' ? 'Cash' : 'Bank', value, m };
  }).filter(r => r.value > 0);
  const methodTotal = byMethodToday.reduce((s, m) => s + m.value, 0) || 1;
  const byMethodWithPct = byMethodToday.map(m => ({ ...m, pct: Math.round((m.value / methodTotal) * 100) }));

  // ── Real "last 14 days" revenue bar chart ────────────────────────────────
  const last14 = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = SAFI_TIME.day(d);
    const label = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
    const v = D.orders.filter(o => o.in.startsWith(key)).reduce((s, o) => s + (o.total || 0), 0);
    last14.push({ d: label, v });
  }

  return (
    <>
      <Topbar
        title="Management Dashboard"
        subtitle={`${new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Vazi Safi Laundry`}
        right={<>
          <Button kind="ghost" icon="print" onClick={() => window.print()}>{t('print_summary', lang)}</Button>
          <Button kind="ghost" icon="box" onClick={() => window.SAFI_STORE.exportJSON()}>Backup data</Button>
        </>}
      />

      <div className="safi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <StatCard label={t('revenue_today', lang)} value={money(today)} delta={`${todayOrders.length} orders · ${money(collectedToday)} collected`} icon="wallet"/>
        <StatCard label="Expenses today" value={money(expensesToday)} deltaKind="down" delta={`${expensesTodayList.length} ${expensesTodayList.length === 1 ? 'entry' : 'entries'} today`} icon="box"/>
        <StatCard label="Total revenue" value={money(totalRevenue)} delta={`${money(totalCollected)} collected · ${money(outstanding)} unpaid`} icon="chart"/>
        <StatCard label="Total expenses" value={money(totalExpenses)} deltaKind="down" delta="all-time" icon="box"/>
      </div>
      <div className="safi-grid safi-grid--4 safi-profit-row">
        <div className="safi-stat safi-stat--op">
          <div className="safi-stat__top">
            <div className="safi-stat__label">Operating profit</div>
            <Icon name="chart" size={16}/>
          </div>
          <div className="safi-stat__value">{money(totalRevenue - D.expenses.filter(e => !window.costGroupOf || window.costGroupOf(D, e) !== 'special').reduce((s, e) => s + (e.amount || 0), 0))}</div>
          <div className="safi-stat__delta">revenue − operational costs</div>
        </div>
        <div className={`safi-stat safi-stat--accent`}>
          <div className="safi-stat__top">
            <div className="safi-stat__label">Net profit</div>
            <Icon name="check" size={16}/>
          </div>
          <div className="safi-stat__value">{money(netProfit)}</div>
          <div className="safi-stat__delta">revenue − expenses</div>
        </div>
      </div>

      <PeriodSummary money={money}/>

      <StageAverages/>

      {window.ServiceClientsToday && <window.ServiceClientsToday/>}

      {window.ActivityCounts && <window.ActivityCounts/>}

      <TimeSeries money={money}/>

      <Card title={`Today's revenue by category · ${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}`} action={<span className="safi-cell-sub">Live from today's orders</span>}>
        <div className="safi-cat-grid">
          {byCategoryToday.map(c => (
            <div key={c.cat} className={`safi-cat-card safi-cat-card--${c.color}`}>
              <div className="safi-cat-card__lbl">{c.label}</div>
              <div className="safi-cat-card__val safi-mono">{money(c.total)}</div>
              <div className="safi-cat-card__bar"><div style={{ width: `${(c.total / catTotalToday) * 100}%` }}/></div>
              <div className="safi-cat-card__pct">{c.total > 0 ? `${Math.round((c.total / catTotalToday) * 100)}% of today` : 'no revenue yet'}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="safi-grid safi-grid--2-1">
        <MonthRevenue orders={D.orders} money={money}/>

        <Card title={`Today: ${t('by_method', lang)}`}>
          {byMethodWithPct.length > 0
            ? <Donut data={byMethodWithPct}/>
            : <p className="safi-cell-sub" style={{ padding: 20, textAlign: 'center' }}>No payments today yet.</p>}
        </Card>
      </div>

      <div className="safi-grid safi-grid--1-1">
        <Card title={`Today: ${t('by_service', lang)}`}>
          {byServiceToday.length > 0
            ? <HBar data={byServiceToday}/>
            : <p className="safi-cell-sub" style={{ padding: 20 }}>No revenue today yet — items will populate as orders are saved.</p>}
        </Card>

        <Card title={t('top_customers', lang)} action={<Button kind="ghost" size="sm" onClick={() => setView('customers')}>View all →</Button>}>
          <ul className="safi-top-cust">
            {topCustomers.map((c, i) => (
              <li key={c.id}>
                <span className="safi-top-cust__rank">{i + 1}</span>
                <span className="safi-cust-pick__avatar">{c.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
                <div className="safi-top-cust__info">
                  <b>{c.name}</b>
                  <span><GroupBadge group={c.group}/> · {c.orders} orders</span>
                </div>
                <span className="safi-mono safi-cell-strong">{money(c.spend)}</span>
              </li>
            ))}
            {topCustomers.length === 0 && <li><span className="safi-cell-sub">No customers yet.</span></li>}
          </ul>
        </Card>
      </div>

      <div className="safi-grid safi-grid--3">
        <BusyHours/>

        <Card title="Loyalty & repeat">
          <div className="safi-loy-big">
            <div className="safi-loy-big__num">{D.customers.length ? Math.round((D.customers.filter(c => c.orders > 1).length / D.customers.length) * 100) : 0}%</div>
            <div className="safi-loy-big__lbl">repeat customer rate</div>
            <div className="safi-loy-big__bar"><div style={{ width: `${D.customers.length ? (D.customers.filter(c => c.orders > 1).length / D.customers.length) * 100 : 0}%` }}/></div>
            <div className="safi-loy-big__meta">
              <div><b>{D.customers.length}</b><span>customers</span></div>
              <div><b>{D.customers.filter(c => c.orders > 1).length}</b><span>repeat</span></div>
              <div><b>{D.customers.filter(c => c.orders === 0).length}</b><span>new</span></div>
            </div>
          </div>
        </Card>

        <Card title="Operations">
          <ul className="safi-ops">
            <li><Icon name="alert" size={14}/><span>Dryer 2 needs service</span></li>
            <li><Icon name="box" size={14}/><span>{D.inventory.filter(i => i.stock < i.reorder).length} items low stock</span></li>
            <li><Icon name="users" size={14}/><span>{D.staff.filter(s => s.active).length} staff on shift</span></li>
            <li><Icon name="package" size={14}/><span>{D.orders.filter(o => o.status === 'ready').length} orders ready</span></li>
            <li><Icon name="check" size={14}/><span>{D.payments.filter(p => !p.verified).length} payments unverified</span></li>
          </ul>
        </Card>
      </div>
    </>
  );
}

// ─── Reports ──────────────────────────────────────────────────────────────
function ReportsScreen({ lang, money }) {
  const D = useStore();
  const [tab, setTab] = useStateOw('daily');
  const todayStr = SAFI_TIME.day();
  const [from, setFrom] = useStateOw(SAFI_TIME.daysAgo(29));
  const [to, setTo] = useStateOw(SAFI_TIME.day());
  const inRange = (d) => { const k = String(d || '').slice(0, 10); return tab === 'custom' ? (k >= from && k <= to) : tab === 'daily' ? k === todayStr : k >= cutoff; };
  const todays = D.orders.filter(o => o.in.startsWith(todayStr));
  const periodDays = tab === 'daily' ? 1 : tab === 'weekly' ? 7 : tab === 'monthly' ? 30 : 36500;
  const cutoff = SAFI_TIME.daysAgo(periodDays - 1);
  const periodOrders = D.orders.filter(o => inRange(o.in));
  const todayRev = periodOrders.reduce((s, o) => s + (o.total || 0), 0);
  // Collected = orders handed over in this period (any intake date), at their total.
  const collectedOrders = D.orders.filter(o => o.status === 'collected' && inRange(window.SAFI_STORE.stageTimes(o.id).collected));
  const periodCollected = collectedOrders.reduce((s, o) => s + (o.total || 0), 0);
  // Each service's share of the order total after discount, so services add up to revenue.
  const periodByService = D.services.map(svc => ({
    label: svc.name,
    value: periodOrders.reduce((s, o) => { const g = o.items.reduce((x, it) => x + (it.price || 0), 0) || 1; return s + Math.round(o.items.filter(it => it.svc === svc.id).reduce((ss, it) => ss + (it.price || 0), 0) * (o.total || 0) / g); }, 0),
  })).filter(r => r.value > 0).sort((a, b) => b.value - a.value);
  const periodExp = (D.expenses || []).filter(e => inRange(e.date));
  const expAll = periodExp.reduce((s, e) => s + (e.amount || 0), 0);
  const expOp = periodExp.filter(e => !window.costGroupOf || window.costGroupOf(D, e) !== 'special').reduce((s, e) => s + (e.amount || 0), 0);
  const servedCustomers = new Set(periodOrders.map(o => o.customer).filter(Boolean)).size;

  const totalsByMethod = ['mpesa', 'bank'].map(m => {
    const list = D.payments.filter(p => p.method === m && inRange(p.date));
    return { m, count: list.length, total: list.reduce((s, p) => s + p.amount, 0), verified: list.filter(p => p.verified).reduce((s, p) => s + p.amount, 0) };
  });
  const totalAll = totalsByMethod.reduce((s, m) => s + m.total, 0);
  const verifiedAll = totalsByMethod.reduce((s, m) => s + m.verified, 0);
  const mpesaPayments = D.payments.filter(p => inRange(p.date)).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const dmt = (s) => { const v = String(s || ''); return v.length >= 16 ? `${v.slice(8, 10)}-${v.slice(5, 7)} ${v.slice(11, 16)}` : v; };
  const vMark = (p) => { if (!p.verified) return <span className="safi-pill safi-pill--amber">⚠ unverified</span>; const d = p.stmtAmount == null ? 0 : Math.round(p.stmtAmount - p.amount); return d === 0 ? <span className="safi-tick safi-tick--full safi-vtick"><svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 6.4l2.3 2.3 4.7-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></span> : <span className={`safi-vres safi-vres--${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '+' : '−'}{Math.abs(d).toLocaleString()}</span>; };

  const headerTitle = tab === 'daily' ? `Daily Close · ${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}` :
                      tab === 'weekly' ? 'This week' : tab === 'monthly' ? 'This month' : `${from} to ${to}`;

  return (
    <>
      <Topbar
        title={t('nav_reports', lang)}
        subtitle="Print-ready summaries for daily close, weekly review, and monthly audit."
        right={<>
          <Button kind="ghost" icon="print" onClick={() => window.print()}>{t('print', lang)}</Button>
          <Button kind="primary" icon="box" onClick={() => window.SAFI_STORE.exportJSON()}>Backup all data</Button>
        </>}
      />

      <div className="safi-tabs safi-tabs--lg">
        {[['daily', 'Daily close'], ['weekly', 'Weekly'], ['monthly', 'Monthly audit'], ['custom', 'Custom range']].map(([id, lbl]) => (
          <button key={id} className={`safi-tabs__btn ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>
      {tab === 'custom' && (
        <div className="safi-range">
          <label>From<input type="date" className="safi-input" value={from} min="2016-01-01" max={to} onChange={e => setFrom(e.target.value || from)}/></label>
          <label>To<input type="date" className="safi-input" value={to} min={from} max={todayStr} onChange={e => setTo(e.target.value || to)}/></label>
          <div className="safi-range__quick">
            {[['This month', SAFI_TIME.day().slice(0, 8) + '01', todayStr], ['Last 90 days', SAFI_TIME.daysAgo(89), todayStr], ['This year', SAFI_TIME.day().slice(0, 4) + '-01-01', todayStr], ['Last year', (Number(todayStr.slice(0, 4)) - 1) + '-01-01', (Number(todayStr.slice(0, 4)) - 1) + '-12-31'], ['All time', '2016-01-01', todayStr]].map(([l, a, b]) => (
              <button key={l} className={`safi-chip ${from === a && to === b ? 'is-active' : ''}`} onClick={() => { setFrom(a); setTo(b); }}>{l}</button>
            ))}
          </div>
        </div>
      )}

      <Card pad={false}>
        <div className="safi-report" id="safi-print-area">
          <div className="safi-receipt__hd" style={{ marginBottom: 8 }}>
            <div className="safi-receipt__logo" style={{ display: 'flex', justifyContent: 'center' }}>
              <image-slot id="shop-logo-full" shape="rect" src="assets/vazi-logo-full.png"
                          placeholder="" style={{ width: '120px', height: '120px' }}>
              </image-slot>
            </div>
          </div>
          <div className="safi-report__hd">
            <div>
              <div className="safi-report__title">{headerTitle}</div>
              <div className="safi-report__sub">Generated {dmyT(new Date())} · Vazi Safi Laundry</div>
            </div>
          </div>

          <div className="safi-report__grid">
            <div className="safi-report__stat">
              <div className="safi-cell-sub">Gross revenue</div>
              <div className="safi-report__big safi-mono">{money(todayRev)}</div>
              <div className="safi-cell-sub">{money(periodCollected)} collected ({collectedOrders.length} orders handed over)</div>
            </div>
            <div className="safi-report__stat">
              <div className="safi-cell-sub">Orders</div>
              <div className="safi-report__big">{periodOrders.length}</div>
            </div>
            <div className="safi-report__stat">
              <div className="safi-cell-sub">Avg order value</div>
              <div className="safi-report__big safi-mono">{money(periodOrders.length ? Math.round(todayRev / periodOrders.length) : 0)}</div>
            </div>
            <div className="safi-report__stat">
              <div className="safi-cell-sub">Customers served</div>
              <div className="safi-report__big">{servedCustomers}</div>
              <div className="safi-cell-sub">{D.customers.length} on file</div>
            </div>
          </div>
          <div className="safi-report__grid safi-report__grid--profit">
            <div className="safi-report__stat"><div className="safi-cell-sub">Expenses</div><div className="safi-report__big safi-mono">{money(expAll)}</div><div className="safi-cell-sub">operational {money(expOp)} · special {money(expAll - expOp)}</div></div>
            <div className="safi-report__stat is-op"><div className="safi-cell-sub">Operating profit</div><div className="safi-report__big safi-mono">{money(todayRev - expOp)}</div><div className="safi-cell-sub">revenue − operational costs</div></div>
            <div className="safi-report__stat is-net"><div className="safi-cell-sub">Net profit</div><div className="safi-report__big safi-mono">{money(todayRev - expAll)}</div><div className="safi-cell-sub">revenue − all expenses</div></div>
          </div>

          <h4 className="safi-report__h4">Payment breakdown</h4>
          <table className="safi-report__table">
            <thead><tr><th>Method</th><th>Transactions</th><th>Gross</th><th>Verified</th><th>Pending</th></tr></thead>
            <tbody>
              {totalsByMethod.map(t => (
                <tr key={t.m}>
                  <td><MethodBadge method={t.m}/></td>
                  <td>{t.count}</td>
                  <td className="safi-mono">{money(t.total)}</td>
                  <td className="safi-mono">{money(t.verified)}</td>
                  <td className="safi-mono">{money(t.total - t.verified)}</td>
                </tr>
              ))}
              <tr className="safi-report__total">
                <td><b>Total</b></td>
                <td><b>{totalsByMethod.reduce((s, t) => s + t.count, 0)}</b></td>
                <td className="safi-mono"><b>{money(totalAll)}</b></td>
                <td className="safi-mono"><b>{money(verifiedAll)}</b></td>
                <td className="safi-mono"><b>{money(totalAll - verifiedAll)}</b></td>
              </tr>
            </tbody>
          </table>

          <h4 className="safi-report__h4">Orders by service band</h4>
          {(() => {
            const bands = [['laundry', 'Laundry', '#38bdf8'], ['drycleaning', 'Dry Cleaning', '#8b5cf6'], ['shoes', 'Shoes', '#f97316']];
            const catOf = (it) => ((D.services.find(s => s.id === it.svc) || {}).category) || 'other';
            const rowsB = bands.map(([k, l, c]) => {
              const os = periodOrders.filter(ord => (ord.items || []).some(it => catOf(it) === k));
              const val = os.reduce((s, ord) => { const g = ord.items.reduce((x, it) => x + (it.price || 0), 0) || 1; return s + Math.round(ord.items.filter(it => catOf(it) === k).reduce((x, it) => x + (it.price || 0), 0) * (ord.total || 0) / g); }, 0);
              return { k, l, c, n: os.length, val };
            });
            const multi = periodOrders.filter(ord => new Set((ord.items || []).map(catOf).filter(x => x !== 'supplies' && x !== 'other')).size > 1).length;
            return (<>
              <div className="safi-bands">
                {rowsB.map(r => <div key={r.k} className="safi-bands__t" style={{ borderTopColor: r.c }}><span>{r.l}</span><b>{r.n}</b><span className="safi-cell-sub">order{r.n === 1 ? '' : 's'} · {money(r.val)}</span></div>)}
              </div>
              <p className="safi-cell-sub" style={{ margin: '6px 0 0' }}>{periodOrders.length} orders in this period{multi ? ` · ${multi} had more than one band, so they count in each` : ''}.</p>
            </>);
          })()}

          <h4 className="safi-report__h4">By service</h4>
          {periodByService.length ? <HBar data={periodByService}/> : <p className="safi-cell-sub">No orders in this period.</p>}

          <h4 className="safi-report__h4">M-Pesa & bank transaction codes (for audit)</h4>
          {mpesaPayments.length === 0 ? (
            <p className="safi-cell-sub">No payments in this period.</p>
          ) : (
            <table className="safi-report__table safi-report__table--mono">
              <thead><tr><th>Date</th><th>Method</th><th>Code</th><th>Order</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {mpesaPayments.map(p => (
                  <tr key={p.id}>
                    <td>{tab === 'daily' ? String(p.date).slice(11, 16) : dmt(p.date)}</td>
                    <td><MethodBadge method={p.method}/></td>
                    <td className="safi-mono">{p.txn || '—'}</td>
                    <td className="safi-mono">{orderNo(p.order)}</td>
                    <td>{p.customer}</td>
                    <td className="safi-mono">{money(p.amount)}</td>
                    <td>{vMark(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="safi-report__sig">
            <div><div className="safi-report__sigline"/><span>Cashier signature</span></div>
            <div><div className="safi-report__sigline"/><span>Manager signature</span></div>
            <div><div className="safi-report__sigline"/><span>Date</span></div>
          </div>
        </div>
      </Card>
      <ExportCenter/>
    </>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────
function PricingScreen({ lang, money }) {
  const D = useStore();
  const [showAdd, setShowAdd] = useStateOw(false);
  const [edit, setEdit] = useStateOw(null);
  const [form, setForm] = useStateOw({ name: '', unit: 'piece', icon: 'shirt', category: 'laundry', student: 0, normal: 0, corporate: 0, subtypes: [] });
  const [newSub, setNewSub] = useStateOw('');

  function submit() {
    if (!form.name) { toast('Name required', 'error'); return; }
    const subtypes = (form.subtypes || [])
      .map(s => (typeof s === 'string' ? { name: s } : s))
      .filter(s => s.name && s.name.trim());
    if (edit) {
      window.SAFI_STORE.updateService(edit, {
        name: form.name, unit: form.unit, icon: form.icon, category: form.category,
        tiers: { student: parseFloat(form.student) || 0, normal: parseFloat(form.normal) || 0, corporate: parseFloat(form.corporate) || 0 },
        subtypes: subtypes.length ? subtypes : undefined,
      });
      toast('Service updated', 'success');
    } else {
      window.SAFI_STORE.addService({
        name: form.name, unit: form.unit, icon: form.icon, category: form.category,
        tiers: { student: parseFloat(form.student) || 0, normal: parseFloat(form.normal) || 0, corporate: parseFloat(form.corporate) || 0 },
        subtypes: subtypes.length ? subtypes : undefined,
      });
      toast('Service added', 'success');
    }
    setShowAdd(false); setEdit(null);
    setForm({ name: '', unit: 'piece', icon: 'shirt', category: 'laundry', student: 0, normal: 0, corporate: 0, subtypes: [] });
  }

  function openEdit(s) {
    setEdit(s.id);
    setForm({ name: s.name, unit: s.unit, icon: s.icon, category: s.category || 'laundry', student: s.tiers.student, normal: s.tiers.normal, corporate: s.tiers.corporate, subtypes: s.subtypes ? [...s.subtypes] : [] });
    setShowAdd(true);
  }

  return (
    <>
      <Topbar
        title={t('nav_pricing', lang)}
        subtitle="Per-tier pricing for each service. Add custom services anytime."
        right={<>
          <Button kind="ghost" icon="print" onClick={() => window.print()}>Print rate card</Button>
          <Button kind="primary" icon="plus" onClick={() => { setEdit(null); setForm({ name: '', unit: 'piece', icon: 'shirt', category: 'laundry', student: 0, normal: 0, corporate: 0 }); setShowAdd(true); }}>Add service</Button>
        </>}
      />
      {window.PriceModels && <window.PriceModels money={money}/>}

      <Card pad={false}>
        <Table
          cols={[
            { label: 'Service', render: r => <div className="safi-cell-cust"><span className="safi-svc-icon"><Icon name={r.icon} size={16}/></span><b>{r.name}</b></div> },
            { label: 'Category', render: r => {
              const labels = { laundry: 'Laundry', drycleaning: 'Dry Cleaning', shoes: 'Shoes', other: 'Other' };
              const colors = { laundry: 'blue', drycleaning: 'violet', shoes: 'amber', other: 'gray' };
              return <span className={`safi-tag safi-tag--${colors[r.category] || 'gray'}`}>{labels[r.category] || 'Other'}</span>;
            }},
            { label: 'Unit', render: r => <span className="safi-tag safi-tag--gray">{r.unit}</span> },
            { label: 'Student', render: r => <span className="safi-mono">{money(r.tiers.student)}</span> },
            { label: 'Normal', render: r => <span className="safi-mono safi-cell-strong">{money(r.tiers.normal)}</span> },
            { label: 'Corporate', render: r => <span className="safi-mono">{money(r.tiers.corporate)}</span> },
            { label: 'Subtypes', render: r => r.subtypes ? <span className="safi-cell-sub">{r.subtypes.length} types</span> : <span className="safi-cell-sub">—</span> },
            { label: '', render: r => <button className="safi-rowlink" onClick={() => openEdit(r)}>Edit →</button> },
          ]}
          rows={D.services.filter(s => !window.SAFI_PRICING.applies(s))}
          empty="No services yet — add your first one."
        />
      </Card>

      <Card title="Customer tiers">
        <div className="safi-tiers">
          {[
            { id: 'student', name: 'Student', desc: 'Discounted rates for students with valid ID', count: D.customers.filter(c => c.group === 'student').length },
            { id: 'normal', name: 'Normal', desc: 'Standard walk-in pricing', count: D.customers.filter(c => c.group === 'normal').length },
            { id: 'corporate', name: 'Corporate', desc: 'Negotiated contract rates for hotels, salons, offices', count: D.customers.filter(c => c.group === 'corporate').length },
          ].map(tier => (
            <div key={tier.id} className="safi-tier">
              <GroupBadge group={tier.id}/>
              <h4>{tier.name}</h4>
              <p>{tier.desc}</p>
              <span>{tier.count} customers</span>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={edit ? 'Edit service' : 'Add service'}
        footer={<>
          <Button kind="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={submit}>{edit ? 'Save changes' : 'Add service'}</Button>
        </>}>
        <div className="safi-form">
          <label>Service name<input className="safi-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Suit alterations"/></label>
          <label>Category — used in analytics
            <div className="safi-seg">
              {[['laundry', 'Laundry'], ['drycleaning', 'Dry Cleaning'], ['shoes', 'Shoes'], ['other', 'Other']].map(([id, lbl]) => (
                <button key={id} className={`safi-seg__btn ${form.category === id ? 'is-active' : ''}`} onClick={() => setForm({ ...form, category: id })}>{lbl}</button>
              ))}
            </div>
          </label>
          <label>Unit
            <div className="safi-seg">
              {['piece', 'kg', 'pair'].map(u => (
                <button key={u} className={`safi-seg__btn ${form.unit === u ? 'is-active' : ''}`} onClick={() => setForm({ ...form, unit: u })}>{u}</button>
              ))}
            </div>
          </label>
          <label>Icon
            <IconPicker value={form.icon} onChange={(ic) => setForm({ ...form, icon: ic })}/>
          </label>
          <div className="safi-form__row">
            <label>Student<input type="number" className="safi-input safi-mono" value={form.student} onChange={e => setForm({ ...form, student: e.target.value })}/></label>
            <label>Normal<input type="number" className="safi-input safi-mono" value={form.normal} onChange={e => setForm({ ...form, normal: e.target.value })}/></label>
            <label>Corporate<input type="number" className="safi-input safi-mono" value={form.corporate} onChange={e => setForm({ ...form, corporate: e.target.value })}/></label>
          </div>

          <label>Subtypes (item variations · optional)
            <div className="safi-subtype-edit">
              {(form.subtypes || []).map((st, i) => {
                const sub = typeof st === 'string' ? { name: st } : st;
                return (
                  <div key={i} className="safi-subtype-row">
                    <input className="safi-input" placeholder="Name (e.g. Shirt)" value={sub.name || ''} onChange={e => {
                      const next = [...form.subtypes]; next[i] = { ...sub, name: e.target.value }; setForm({ ...form, subtypes: next });
                    }}/>
                    <div className="safi-subtype-price">
                      <span>KES</span>
                      <input type="number" className="safi-input safi-mono" placeholder="tier price" value={sub.price ?? ''} onChange={e => {
                        const next = [...form.subtypes];
                        const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                        next[i] = { ...sub, price: v }; setForm({ ...form, subtypes: next });
                      }}/>
                    </div>
                    <button className="safi-items__del" onClick={() => setForm({ ...form, subtypes: form.subtypes.filter((_, j) => j !== i) })}>×</button>
                  </div>
                );
              })}
              <div className="safi-subtype-add">
                <input className="safi-input" value={newSub} placeholder="New subtype name, then press Enter" onChange={e => setNewSub(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newSub.trim()) { setForm({ ...form, subtypes: [...(form.subtypes || []), { name: newSub.trim() }] }); setNewSub(''); e.preventDefault(); } }}/>
                <Button kind="secondary" size="sm" icon="plus" onClick={() => { if (newSub.trim()) { setForm({ ...form, subtypes: [...(form.subtypes || []), { name: newSub.trim() }] }); setNewSub(''); } }}>Add</Button>
              </div>
              <p className="safi-hint">Leave price blank to use the service's tier price. Set a specific price to override (e.g. Suit 3pc = KES 700 even when tier price is 280).</p>
            </div>
          </label>
        </div>
      </Modal>
    </>
  );
}

// ─── Inventory ────────────────────────────────────────────────────────────
function InventoryScreen({ lang }) {
  const D = useStore();
  const [showAdd, setShowAdd] = useStateOw(false);
  const [form, setForm] = useStateOw({ item: '', stock: 0, reorder: 0, unit: 'pc' });

  function submit() {
    if (!form.item) { toast('Item name required', 'error'); return; }
    window.SAFI_STORE.addInventory({ item: form.item, stock: parseFloat(form.stock) || 0, reorder: parseFloat(form.reorder) || 0, unit: form.unit });
    toast('Item added', 'success');
    setShowAdd(false);
    setForm({ item: '', stock: 0, reorder: 0, unit: 'pc' });
  }

  return (
    <>
      <Topbar title={t('nav_inventory', lang)} subtitle="Detergent, hangers, tags — stock & reorder levels."
        right={<Button kind="primary" icon="plus" onClick={() => setShowAdd(true)}>Add item</Button>}/>
      <Card pad={false}>
        <Table
          cols={[
            { label: 'Item', render: r => <b>{r.item}</b> },
            { label: 'In stock', render: r => (
              <div className="safi-stock-edit">
                <input type="number" className="safi-mini-input safi-mono" defaultValue={r.stock}
                  onBlur={e => { const v = parseFloat(e.target.value) || 0; if (v !== r.stock) { window.SAFI_STORE.updateInventory(r.id, { stock: v }); toast('Stock updated'); } }}/>
                <span className="safi-cell-sub">{r.unit}</span>
              </div>
            )},
            { label: 'Reorder at', render: r => <span className="safi-mono safi-cell-sub">{r.reorder} {r.unit}</span> },
            { label: 'Level', render: r => {
              const pct = Math.min(100, (r.stock / (r.reorder * 3 || 1)) * 100);
              return <div className="safi-loy" style={{ width: 200 }}>
                <div className="safi-loy__bar"><div style={{ width: `${pct}%`, background: r.stock < r.reorder ? 'var(--red)' : 'var(--brand)' }}/></div>
              </div>;
            }},
            { label: 'Status', render: r => r.stock < r.reorder ? <span className="safi-pill safi-pill--red">⚠ Low</span> : <span className="safi-pill safi-pill--green"><span className="safi-pill__dot"/>OK</span> },
          ]}
          rows={D.inventory}
          empty="No items yet."
        />
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add inventory item"
        footer={<>
          <Button kind="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button kind="primary" onClick={submit}>Add item</Button>
        </>}>
        <div className="safi-form">
          <label>Item name<input className="safi-input" value={form.item} onChange={e => setForm({ ...form, item: e.target.value })}/></label>
          <div className="safi-form__row">
            <label>Current stock<input type="number" className="safi-input safi-mono" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}/></label>
            <label>Reorder at<input type="number" className="safi-input safi-mono" value={form.reorder} onChange={e => setForm({ ...form, reorder: e.target.value })}/></label>
            <label>Unit<input className="safi-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pc / L / kg"/></label>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ─── Staff ────────────────────────────────────────────────────────────────
function StaffScreen({ lang }) {
  const D = useStore();
  const current = window.SAFI_STORE.getCurrentStaff();
  const [showAdd, setShowAdd] = useStateOw(false);
  const [edit, setEdit] = useStateOw(null);
  const [form, setForm] = useStateOw({ name: '', role: 'Front Desk', shift: 'Morning' });

  function openAdd() {
    setEdit(null);
    setForm({ name: '', role: 'Front Desk', shift: 'Morning' });
    setShowAdd(true);
  }
  function openEdit(s) {
    setEdit(s.id);
    setForm({ name: s.name, role: s.role, shift: s.shift });
    setShowAdd(true);
  }
  function submit() {
    if (!form.name.trim()) { toast('Name required', 'error'); return; }
    if (edit) {
      window.SAFI_STORE.updateStaff(edit, form);
      toast('Staff updated', 'success');
    } else {
      window.SAFI_STORE.addStaff(form);
      toast(`${form.name} added`, 'success');
    }
    setShowAdd(false);
  }
  function remove(s) {
    if (D.staff.length <= 1) { toast('Keep at least one staff member', 'error'); return; }
    window.SAFI_STORE.removeStaff(s.id);
    toast(`${s.name} removed`);
  }

  return (
    <>
      <Topbar
        title={t('nav_staff', lang)}
        subtitle="Add, edit, and toggle who works at the shop. The current attendant signs in from the bottom-left of the sidebar."
        right={<Button kind="primary" icon="plus" onClick={openAdd}>Add staff</Button>}
      />

      <Card title="Current attendant">
        <div className="safi-cust-card">
          <div className="safi-cust-card__avatar">{current.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</div>
          <div>
            <div className="safi-cust-card__name">{current.name}</div>
            <div className="safi-cust-card__phone">{current.role} · {current.shift}</div>
            <p className="safi-cell-sub" style={{ margin: '4px 0 0' }}>This name appears on every new receipt printed.</p>
          </div>
        </div>
      </Card>

      <Card pad={false} title="All staff">
        <Table
          cols={[
            { label: 'Name', render: r => (
              <div className="safi-cell-cust">
                <span className="safi-cust-pick__avatar">{r.name.split(' ').map(x => x[0]).slice(0, 2).join('')}</span>
                <b>{r.name}</b>
                {current.id === r.id && <span className="safi-tag safi-tag--green">Signed in</span>}
              </div>
            )},
            { label: 'Role', render: r => <span>{r.role}</span> },
            { label: 'Shift', render: r => <span className="safi-cell-sub">{r.shift}</span> },
            { label: 'Status', render: r => (
              <label className="safi-toggle">
                <input type="checkbox" checked={r.active} onChange={e => window.SAFI_STORE.updateStaff(r.id, { active: e.target.checked })}/>
                <span/><b>{r.active ? 'Active' : 'Inactive'}</b>
              </label>
            )},
            { label: '', render: r => (
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="safi-rowlink" onClick={() => window.SAFI_STORE.setCurrentStaff(r.id)}>Sign in</button>
                <button className="safi-rowlink" onClick={() => openEdit(r)}>Edit</button>
                <button className="safi-rowlink safi-rowlink--danger" onClick={() => remove(r)}>Remove</button>
              </div>
            )},
          ]}
          rows={D.staff}
          empty="No staff yet — add your first."
        />
      </Card>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={edit ? 'Edit staff' : 'Add staff'}
        footer={<>
          <Button kind="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={submit}>{edit ? 'Save changes' : 'Add staff'}</Button>
        </>}>
        <div className="safi-form">
          <label>Full name<input className="safi-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Grace Wairimu"/></label>
          <label>Role
            <div className="safi-seg">
              {['Front Desk', 'Washer', 'Ironing', 'Rider', 'Manager'].map(r => (
                <button key={r} className={`safi-seg__btn ${form.role === r ? 'is-active' : ''}`} onClick={() => setForm({ ...form, role: r })}>{r}</button>
              ))}
            </div>
          </label>
          <label>Shift
            <div className="safi-seg">
              {['Morning', 'Evening', 'All-day'].map(sh => (
                <button key={sh} className={`safi-seg__btn ${form.shift === sh ? 'is-active' : ''}`} onClick={() => setForm({ ...form, shift: sh })}>{sh}</button>
              ))}
            </div>
          </label>
        </div>
      </Modal>
    </>
  );
}

// ─── Correct order dates (e.g. a till whose clock was wrong) ──────────────
function RedateCard() {
  const D = useStore();
  const [from, setFrom] = useStateOw(SAFI_TIME.day());
  const [to, setTo] = useStateOw(SAFI_TIME.daysAgo(1));
  const [picked, setPicked] = useStateOw({});
  const list = D.orders.filter(o => String(o.in).startsWith(from));
  const n = Object.values(picked).filter(Boolean).length;
  function apply() {
    if (!n || !to || to === from) return;
    for (const o of list) if (picked[o.id]) {
      const time = String(o.in).slice(10);
      const patch = { in: to + time };
      if (o.due && String(o.due).startsWith(from)) patch.due = to + String(o.due).slice(10);
      window.SAFI_STORE.updateOrder(o.id, patch);
      for (const p of D.payments.filter(p => p.order === o.id && String(p.date).startsWith(from)))
        window.SAFI_STORE.get().payments.find(x => x.id === p.id).date = to + String(p.date).slice(10);
    }
    window.SAFI_STORE.updateOrder(list[0].id, {});
    toast(`${n} order${n > 1 ? 's' : ''} moved to ${to}`, 'success');
    setPicked({});
  }
  return (
    <Card title="Correct order dates" action={<span className="safi-cell-sub">Use when a till's clock was set wrong</span>}>
      <div className="safi-redate">
        <div className="safi-redate__row">
          <label>Orders saved on<input type="date" className="safi-input" value={from} onChange={e => { setFrom(e.target.value); setPicked({}); }}/></label>
          <label>Move ticked orders to<input type="date" className="safi-input" value={to} onChange={e => setTo(e.target.value)}/></label>
          <Button kind="ghost" size="sm" onClick={() => setPicked(Object.fromEntries(list.map(o => [o.id, true])))}>Tick all</Button>
          <Button kind="ghost" size="sm" onClick={() => setPicked({})}>Clear</Button>
          <Button kind="primary" icon="check" onClick={apply} disabled={!n || to === from}>Move {n || ''} order{n === 1 ? '' : 's'}</Button>
        </div>
        <div className="safi-redate__list">
          {list.length === 0 && <p className="safi-cell-sub" style={{ padding: 12, margin: 0 }}>No orders saved on {from}.</p>}
          {list.map(o => {
            const c = D.customers.find(x => x.id === o.customer);
            return (
              <label key={o.id} className="safi-redate__item">
                <input type="checkbox" checked={!!picked[o.id]} onChange={e => setPicked({ ...picked, [o.id]: e.target.checked })}/>
                <span className="safi-mono">{orderNo(o.id)}</span>
                <span>{c?.name || orderNo(o.id)}</span>
                <span className="safi-mono safi-cell-sub">{String(o.in).slice(11, 16)}</span>
                <span className="safi-mono">KES {(o.total || 0).toLocaleString('en-KE')}</span>
              </label>
            );
          })}
        </div>
        <p className="safi-hint">Keeps each order's time; only the day changes. Linked payments from that day move too. The change syncs to the other laptop.</p>
      </div>
    </Card>
  );
}

// ─── Data Management ──────────────────────────────────────────────────────
// Monthly export: orders (with client details and each day's total) and customers, CSV or JSON.
function MonthExport({ D }) {
  const [month, setMonth] = useStateOw(SAFI_TIME.day().slice(0, 7));
  const cust = (id) => D.customers.find(c => c.id === id) || {};
  const orders = D.orders.filter(o => String(o.in).startsWith(month)).sort((a, b) => String(a.in).localeCompare(String(b.in)));
  const dayTotal = {};
  for (const o of orders) { const k = String(o.in).slice(0, 10); dayTotal[k] = (dayTotal[k] || 0) + (o.total || 0); }
  const svcName = (id) => (D.services.find(s => s.id === id) || {}).name || id;
  const custIds = new Set([...orders.map(o => o.customer).filter(Boolean), ...D.customers.filter(c => String(c.joined || '').startsWith(month)).map(c => c.id)]);
  const customers = D.customers.filter(c => custIds.has(c.id));
  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const toCSV = (head, rows) => [head.join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\n');
  const save = (name, text, type) => { const b = new Blob([text], { type }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); };
  const orderRows = () => orders.map(o => { const c = cust(o.customer); const day = String(o.in).slice(0, 10); return {
    order: orderNo(o.id), date: day, time: String(o.in).slice(11, 16), customer: c.name || '', phone: c.phone ? `${c.prefix || '+254'} ${c.phone}` : '', tier: c.group || '', residence: c.location || '',
    items: (o.items || []).map(it => `${svcName(it.svc)}${it.subtype ? ' · ' + it.subtype : ''} x${it.qty}`).join('; '),
    total: o.total || 0, paid: o.paid || 0, balance: Math.max(0, (o.total || 0) - (o.paid || 0)), status: o.status, day_total: dayTotal[day] }; });
  const custRows = () => customers.map(c => { const mine = orders.filter(o => o.customer === c.id); return {
    name: c.name, phone: c.phone ? `${c.prefix || '+254'} ${c.phone}` : '', tier: c.group, residence: c.location || '', joined: c.joined || '',
    orders_this_month: mine.length, spend_this_month: mine.reduce((s, o) => s + (o.total || 0), 0), lifetime_orders: c.orders || 0, lifetime_spend: c.spend || 0 }; });
  function ordersCSV() {
    const rows = orderRows(); const head = Object.keys(rows[0] || { order: 0 });
    const lines = []; let last = '';
    for (const r of rows) { if (last && r.date !== last) lines.push(['', last, '', 'DAY TOTAL', '', '', '', '', dayTotal[last]]); lines.push(head.map(h => r[h])); last = r.date; }
    if (last) lines.push(['', last, '', 'DAY TOTAL', '', '', '', '', dayTotal[last]]);
    lines.push(['', month, '', 'MONTH TOTAL', '', '', '', '', orders.reduce((s, o) => s + (o.total || 0), 0)]);
    save(`vazi-safi-orders-${month}.csv`, toCSV(head, lines), 'text/csv');
  }
  const ordersJSON = () => save(`vazi-safi-orders-${month}.json`, JSON.stringify({ month, dayTotals: dayTotal, monthTotal: orders.reduce((s, o) => s + (o.total || 0), 0), orders: orderRows() }, null, 2), 'application/json');
  const custCSV = () => { const rows = custRows(); const head = Object.keys(rows[0] || { name: 0 }); save(`vazi-safi-customers-${month}.csv`, toCSV(head, rows.map(r => head.map(h => r[h]))), 'text/csv'); };
  const custJSON = () => save(`vazi-safi-customers-${month}.json`, JSON.stringify({ month, customers: custRows() }, null, 2), 'application/json');
  return (
    <Card title="Monthly export" action={<span className="safi-cell-sub">{orders.length} orders · {customers.length} customers in {month}</span>}>
      <div className="safi-range">
        <label>Month<input type="month" className="safi-input" value={month} max={SAFI_TIME.day().slice(0, 7)} onChange={e => setMonth(e.target.value || month)}/></label>
        <Button kind="secondary" icon="list" onClick={ordersCSV}>Orders · CSV</Button>
        <Button kind="ghost" icon="box" onClick={ordersJSON}>Orders · JSON</Button>
        <Button kind="secondary" icon="users" onClick={custCSV}>Customers · CSV</Button>
        <Button kind="ghost" icon="box" onClick={custJSON}>Customers · JSON</Button>
      </div>
      <p className="safi-hint">Orders include the client's name, phone, tier and residence, plus a total for each day and the month. CSV opens in Excel.</p>
    </Card>
  );
}

function ClearSectionCard({ D }) {
  const today = SAFI_TIME.day();
  const first = today.slice(0, 8) + '01';
  const [from, setFrom] = useStateOw(first);
  const [to, setTo] = useStateOw(today);
  const [job, setJob] = useStateOw(null); // { k, label, note, n }
  const [step, setStep] = useStateOw(0);
  const [reason, setReason] = useStateOw('');
  const [pin, setPin] = useStateOw('');
  const [err, setErr] = useStateOw('');
  const [backed, setBacked] = useStateOw(false);
  const dateOf = { orders: r => r.in, payments: r => r.date, expenses: r => r.date, dispatch: r => r.slotDate || r.created, messages: r => r.date, issues: r => r.date, approvals: r => r.requestedAt, shifts: r => r.openedAt, customers: r => r.joined, inventory: r => r.date, packages: r => r.created };
  const countIn = (k) => (D[k] || []).filter(r => { const d = String((dateOf[k] || (x => x.date))(r) || '').slice(0, 10); return d && d >= from && d <= to; }).length;
  const realPin = () => String(window.__safiOwnerPin || window.SAFI_OWNER_PIN || (D.settings || {}).ownerPin || '');
  const dm = (v) => v ? `${v.slice(8, 10)}-${v.slice(5, 7)}-${v.slice(2, 4)}` : '';
  function open(k, label, note) { setJob({ k, label, note, n: countIn(k) }); setStep(1); setReason(''); setPin(''); setErr(''); setBacked(false); }
  function next() {
    setErr('');
    if (step === 1) { if (reason.trim().length < 5) { setErr('Write a short reason (at least 5 characters).'); return; } if (!backed) { setErr('Tick that you have downloaded a backup first.'); return; } setStep(2); return; }
    if (pin.trim() !== realPin()) { setErr('Wrong Management PIN.'); setPin(''); return; }
    if (step === 2) { setPin(''); setStep(3); return; }
    const n = window.SAFI_STORE.clearSectionRange(job.k, from, to, reason.trim());
    toast(`${job.label}: ${n} record${n === 1 ? '' : 's'} cleared (${dm(from)} to ${dm(to)})`, 'success');
    setJob(null); setStep(0);
  }
  const rows = [
    ['customers', 'Customers', 'By join date · past orders stay, they just lose the customer link'],
    ['orders', 'Orders', 'By intake date · also clears their payments, handovers and delivery cards'],
    ['payments', 'Payments', ''], ['expenses', 'Expenses', ''],
    ['dispatch', 'Pickups & deliveries', 'Also clears their delivery cards'],
    ['messages', 'SMS log', ''], ['inventory', 'Inventory', ''], ['issues', 'Issues', ''],
    ['approvals', 'Approvals', ''], ['shifts', 'Shifts', ''], ['packages', 'Packages', ''],
  ];
  return (
    <Card title="Clear a section" action={<span className="safi-cell-sub">Management PIN twice · reason required · the audit log is never cleared</span>}>
      <div className="safi-callout" style={{ marginTop: 0, background: '#fff7e8', color: '#8a4b00', borderLeft: '3px solid #ff7a00' }}>
        <Icon name="alert" size={14}/>
        <span><b>Download first.</b> Before clearing, use <b>Download backup (.json)</b> above, or <b>Export reports</b> for the same period. Cleared records can only come back from a backup.</span>
      </div>
      <div className="safi-clear-range">
        <label>From<input type="date" className="safi-input" value={from} max={to} onChange={e => setFrom(e.target.value)}/></label>
        <label>To<input type="date" className="safi-input" value={to} min={from} max={today} onChange={e => setTo(e.target.value)}/></label>
        <span className="safi-cell-sub">Only records dated in this period are cleared ({dm(from)} to {dm(to)}).</span>
      </div>
      <div className="safi-clear-list">
        {rows.map(([k, label, note]) => { const n = countIn(k); return (
          <div key={k} className="safi-clear-row">
            <div><b>{label}</b>{note && <div className="safi-cell-sub">{note}</div>}</div>
            <span className="safi-mono safi-cell-sub">{n} in period · {(D[k] || []).length} total</span>
            <Button kind="ghost" disabled={!n} onClick={() => open(k, label, note)}>Clear</Button>
          </div>); })}
      </div>
      <Modal open={!!job} onClose={() => setJob(null)} title={job ? `Clear ${job.label.toLowerCase()} · ${dm(from)} to ${dm(to)}` : ''} width={480}
        footer={<><Button kind="ghost" onClick={() => setJob(null)}>Cancel</Button><Button kind="primary" icon={step === 3 ? 'alert' : 'check'} onClick={next}>{step === 1 ? 'Continue' : step === 2 ? 'Confirm PIN (1 of 2)' : `Clear ${job ? job.n : ''} record${job && job.n === 1 ? '' : 's'}`}</Button></>}>
        {job && <div className="safi-form">
          <p style={{ margin: 0 }}><b>{job.n}</b> record{job.n === 1 ? '' : 's'} dated {dm(from)} to {dm(to)} will be deleted{job.note ? `. ${job.note}` : ''}. This cannot be undone.</p>
          {step === 1 && <>
            <label>Reason for clearing<textarea className="safi-textarea" autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Test orders from setup week, already backed up"/></label>
            <label className="safi-toggle"><input type="checkbox" checked={backed} onChange={e => setBacked(e.target.checked)}/><span/><b>I have downloaded a backup / export of this data</b></label>
          </>}
          {step >= 2 && <label>{step === 2 ? 'Management PIN' : 'Enter the Management PIN again to confirm'}<input className="safi-input safi-mono" type="password" autoFocus key={step} value={pin} onChange={e => setPin(e.target.value)} onKeyDown={e => e.key === 'Enter' && next()}/></label>}
          {err && <p className="safi-pin__err" style={{ margin: 0 }}>{err}</p>}
        </div>}
      </Modal>
    </Card>
  );
}

function DataScreen({ lang }) {
  const D = useStore();
  const fileRef = useRefOw(null);
  const [confirm, setConfirm] = useStateOw(null);

  function handleImport(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = window.SAFI_STORE.importJSON(reader.result);
      toast(ok ? 'Data restored from backup' : 'Invalid backup file', ok ? 'success' : 'error');
    };
    reader.readAsText(file);
  }

  return (
    <>
      <Topbar title="Data & Backup" subtitle="Your data lives on this laptop — back it up regularly."/>

      <ExportCenter/>
      <MonthExport D={D}/>

      <div className="safi-grid safi-grid--3">
        <StatCard label="Orders" value={D.orders.length} icon="list"/>
        <StatCard label="Customers" value={D.customers.length} icon="users"/>
        <StatCard label="Payments" value={D.payments.length} icon="wallet"/>
      </div>

      <RedateCard/>

      <Card title="Backup">
        <p className="safi-cell-sub" style={{ marginTop: 0 }}>
          Download a JSON file with every order, customer, and payment. Save it to a USB drive or email it to yourself once a week.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="primary" icon="box" onClick={() => { window.SAFI_STORE.exportJSON(); toast('Backup downloaded'); }}>Download backup (.json)</Button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleImport(e.target.files[0]); e.target.value = ''; }}/>
          <Button kind="ghost" icon="arrow-l" onClick={() => fileRef.current?.click()}>Restore from backup</Button>
        </div>
      </Card>

      <Card title="Storage location">
        <div className="safi-store-info">
          <div><span>Where</span><b>This browser, this laptop (localStorage)</b></div>
          <div><span>Persistence</span><b>Survives close, reload, restart</b></div>
          <div><span>Limit</span><b>~5 MB (≈ 50,000 orders)</b></div>
          <div><span>Backup file</span><b>JSON · plain text · portable</b></div>
        </div>
      </Card>

      <Card title="Go live">
        <p className="safi-cell-sub" style={{ marginTop: 0 }}>
          Clears every demo customer, order, payment and expense so the books start at zero.
          Your services, prices, staff and expense categories are kept. Do this once, then import
          your real customer list.
        </p>
        <Button kind="primary" icon="users" onClick={() => setConfirm('golive')}>Clear demo data & start fresh</Button>
      </Card>

      <ClearSectionCard D={D}/>

      <Card title="Danger zone" className="safi-danger">
        <p className="safi-cell-sub" style={{ marginTop: 0 }}>These actions cannot be undone — back up first.</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button kind="ghost" onClick={() => setConfirm('clear')}>Clear orders & payments</Button>
          <Button kind="ghost" onClick={() => setConfirm('reset')}>Reset to sample data</Button>
        </div>
      </Card>

      <Modal open={!!confirm} onClose={() => setConfirm(null)}
        title={confirm === 'golive' ? 'Clear demo data and start fresh?' : confirm === 'clear' ? 'Clear orders & payments?' : 'Reset to sample data?'}
        footer={<>
          <Button kind="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={() => {
            const which = confirm; setConfirm(null);
            window.safiPinConfirm({ title: 'Confirm with Owner PIN', confirmLabel: 'Confirm', onConfirm: () => {
            const confirm = which;
            if (confirm === 'golive') { window.SAFI_STORE.goLive(); toast('Demo data cleared — ready for your real customers'); }
            else if (confirm === 'clear') { window.SAFI_STORE.clearAll(); toast('Orders cleared'); }
            else { window.SAFI_STORE.resetAll(); toast('Reset to sample data'); }
            } });
          }}>{confirm === 'golive' ? 'Clear demo data' : confirm === 'clear' ? 'Clear all orders' : 'Reset everything'}</Button>
        </>}>
        <p>
          {confirm === 'golive'
            ? 'Every demo customer, order, payment, expense and chart figure is removed. Services, prices, staff and expense categories stay. This cannot be undone — download a backup first if you want one.'
            : confirm === 'clear'
            ? 'This will delete every order, payment, and issue. Customers will be kept. Make sure you have a backup.'
            : 'This will replace ALL data on this laptop with the demo sample data. Useful when you first set up — destructive otherwise.'}
        </p>
      </Modal>
    </>
  );
}

Object.assign(window, { OwnerDashboard, ReportsScreen, PricingScreen, InventoryScreen, StaffScreen, DataScreen });
