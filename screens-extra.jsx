// Vazi Safi — additional screens
// Period summary (dashboard), Settings, Dispatch (pickup/delivery), Messages (SMS)
const { useState: useStateX, useRef: useRefX, useEffect: useEffectX } = React;

// ─── Period Summary (used on Management Dashboard) ────────────────────────
function PeriodSummary({ money }) {
  const D = window.safiTrim(useStore());
  const [period, setPeriod] = useStateX('month');
  const [cFrom, setCFrom] = useStateX(SAFI_TIME.day().slice(0, 8) + '01');
  const [cTo, setCTo] = useStateX(SAFI_TIME.day());

  // Returns date strings { from, to } inclusive
  function rangeFor(p) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (p === 'today')   return { from: today, to: now, label: 'Today' };
    if (p === 'week') {
      const d = new Date(today); d.setDate(d.getDate() - 6);
      return { from: d, to: now, label: 'Last 7 days' };
    }
    if (p === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: d, to: now, label: `${today.toLocaleString('en-KE', { month: 'long' })} ${today.getFullYear()}` };
    }
    if (p === 'quarter') {
      const q = Math.floor(today.getMonth() / 3);
      const d = new Date(today.getFullYear(), q * 3, 1);
      return { from: d, to: now, label: `Q${q + 1} ${today.getFullYear()}` };
    }
    if (p === 'year') {
      const d = new Date(today.getFullYear(), 0, 1);
      return { from: d, to: now, label: `${today.getFullYear()}` };
    }
    if (p === 'custom') {
      const f = new Date((cFrom || '2000-01-01') + 'T00:00:00');
      const t2 = new Date((cTo || SAFI_TIME.day()) + 'T23:59:59');
      const dm = (v) => v ? `${v.slice(8, 10)}-${v.slice(5, 7)}-${v.slice(2, 4)}` : '';
      return { from: f, to: t2, label: `${dm(cFrom)} → ${dm(cTo)}` };
    }
    return { from: new Date(2000, 0, 1), to: now, label: 'All-time' };
  }
  function inRange(dateStr, from) {
    return new Date(dateStr) >= from;
  }

  const cur = rangeFor(period);

  // Previous period (for delta)
  const prevMap = {
    today:   { from: new Date(cur.from.getTime() - 86400e3), to: cur.from },
    week:    { from: new Date(cur.from.getTime() - 7 * 86400e3), to: cur.from },
    month:   {
      from: new Date(cur.from.getFullYear(), cur.from.getMonth() - 1, 1),
      to:   cur.from,
    },
    quarter: {
      from: new Date(cur.from.getFullYear(), cur.from.getMonth() - 3, 1),
      to:   cur.from,
    },
    year:    {
      from: new Date(cur.from.getFullYear() - 1, 0, 1),
      to:   cur.from,
    },
    custom:  { from: new Date(cur.from.getTime() - (cur.to.getTime() - cur.from.getTime()) - 1000), to: new Date(cur.from.getTime() - 1000) },
  };
  const prev = prevMap[period];

  function sumOrdersPaid(from, to) {
    return D.orders.filter(o => {
      const d = new Date(o.in);
      return d >= from && (!to || d <= to);
    }).reduce((s, o) => s + (o.total || 0), 0);
  }
  function sumOrdersGross(from, to) {
    return D.orders.filter(o => { const d = new Date(o.in); return d >= from && (!to || d <= to); })
      .reduce((s, o) => s + (o.total || 0), 0);
  }
  function sumExpenses(from, to) {
    return D.expenses.filter(e => { const d = new Date(e.date); return d >= from && (!to || d <= to); })
      .reduce((s, e) => s + (e.amount || 0), 0);
  }
  function countOrders(from, to) {
    return D.orders.filter(o => { const d = new Date(o.in); return d >= from && (!to || d <= to); }).length;
  }

  const revenue = sumOrdersPaid(cur.from, cur.to);
  const gross   = sumOrdersGross(cur.from, cur.to);
  const expense = sumExpenses(cur.from, cur.to);
  const profit  = revenue - expense;
  const opExpense = D.expenses.filter(e => new Date(e.date.replace(' ', 'T')) >= cur.from && new Date(e.date.replace(' ', 'T')) <= cur.to && (!window.costGroupOf || window.costGroupOf(D, e) !== 'special')).reduce((s, e) => s + (e.amount || 0), 0);
  const opProfit = revenue - opExpense;
  const orders  = countOrders(cur.from, cur.to);

  const prevRev = prev ? sumOrdersPaid(prev.from, prev.to) : 0;
  const prevExp = prev ? sumExpenses(prev.from, prev.to) : 0;
  const revDelta = prevRev ? Math.round(((revenue - prevRev) / prevRev) * 100) : null;
  const expDelta = prevExp ? Math.round(((expense - prevExp) / prevExp) * 100) : null;

  // By category
  const catLabels = { laundry: 'Laundry', drycleaning: 'Dry Cleaning', shoes: 'Shoes', other: 'Other' };
  const catColors = { laundry: 'blue', drycleaning: 'violet', shoes: 'amber', other: 'gray' };
  const byCategory = ['laundry', 'drycleaning', 'shoes', 'other'].map(cat => {
    const total = D.orders.filter(o => new Date(o.in) >= cur.from && new Date(o.in) <= cur.to).reduce((s, o) => {
      return s + o.items.reduce((ss, it) => {
        const svc = D.services.find(x => x.id === it.svc);
        return ss + ((svc?.category || 'other') === cat ? it.price : 0);
      }, 0);
    }, 0);
    return { cat, label: catLabels[cat], color: catColors[cat], total };
  });
  const catTotal = byCategory.reduce((s, c) => s + c.total, 0) || 1;

  return (
    <>
      <Card title={`Period summary · ${cur.label}`} action={
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div className="safi-seg">
          {[['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter'], ['custom', 'Custom'], ['all', 'All-time']].map(([k, lbl]) => (
            <button key={k} className={`safi-seg__btn ${period === k ? 'is-active' : ''}`} onClick={() => setPeriod(k)}>{lbl}</button>
          ))}
        </div>
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 10 }}>
            <input type="date" className="safi-input" style={{ width: 'auto' }} value={cFrom} max={cTo || undefined} onChange={e => setCFrom(e.target.value)}/>
            <span className="safi-cell-sub">to</span>
            <input type="date" className="safi-input" style={{ width: 'auto' }} value={cTo} min={cFrom || undefined} onChange={e => setCTo(e.target.value)}/>
          </div>
        )}
        </div>
      }>
        <div className="safi-period-grid">
          <div className="safi-period-card safi-period-card--rev">
            <div className="safi-period-card__lbl">Revenue</div>
            <div className="safi-period-card__val safi-mono">{money(revenue)}</div>
            <div className="safi-period-card__meta">
              {revDelta != null && <span className={revDelta >= 0 ? 'is-up' : 'is-down'}>{revDelta >= 0 ? '↑' : '↓'} {Math.abs(revDelta)}%</span>}
              <span>{orders} orders · gross {money(gross)}</span>
            </div>
          </div>
          <div className="safi-period-card safi-period-card--exp">
            <div className="safi-period-card__lbl">Expenses</div>
            <div className="safi-period-card__val safi-mono">— {money(expense)}</div>
            <div className="safi-period-card__meta">
              {expDelta != null && <span className={expDelta >= 0 ? 'is-down' : 'is-up'}>{expDelta >= 0 ? '↑' : '↓'} {Math.abs(expDelta)}% vs last</span>}
            </div>
          </div>
          <div className="safi-period-card safi-period-card--op">
            <div className="safi-period-card__lbl">Operating profit</div>
            <div className="safi-period-card__val safi-mono">{money(opProfit)}</div>
            <div className="safi-period-card__meta"><span>revenue − operational costs</span></div>
          </div>
          <div className="safi-period-card safi-period-card--profit">
            <div className="safi-period-card__lbl">Net profit</div>
            <div className="safi-period-card__val safi-mono">{money(profit)}</div>
            <div className="safi-period-card__meta">
              <span>{revenue ? Math.round((profit / revenue) * 100) : 0}% margin</span>
            </div>
          </div>
        </div>

        {catTotal > 1 && (
          <div className="safi-period-cats">
            {byCategory.map(c => (
              <div key={c.cat} className={`safi-cat-card safi-cat-card--${c.color}`}>
                <div className="safi-cat-card__lbl">{c.label}</div>
                <div className="safi-cat-card__val safi-mono">{money(c.total)}</div>
                <div className="safi-cat-card__bar"><div style={{ width: `${(c.total / catTotal) * 100}%` }}/></div>
                <div className="safi-cat-card__pct">{Math.round((c.total / catTotal) * 100)}% of revenue</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

// ─── Settings (Management) ────────────────────────────────────────────────
function SettingsScreen({ lang, shop, setShop }) {
  // Saves to this laptop AND to the synced settings, so every laptop gets it.
  const setT = (k, v) => { window.__safiSetTweak && window.__safiSetTweak(k, v); window.SAFI_STORE.setSetting(k, v); };
  const D = useStore();
  const [tpl, setTpl] = useStateX({ ...(D.smsTemplates || {}) });

  return (
    <>
      <Topbar title="Settings" subtitle="Receipt details, PIN, and SMS templates — saved to the cloud and shared by every laptop."/>

      <Card title="Receipt details" action={<span className="safi-cell-sub">Appears at the top and bottom of every printed receipt</span>}>
        <div className="safi-form" style={{ maxWidth: 760 }}>
          <label>Shop name <input className="safi-input" defaultValue={shop.name} onBlur={e => setT('shopName', e.target.value)}/></label>
          <label>Tagline <input className="safi-input" defaultValue={shop.tagline} onBlur={e => setT('shopTagline', e.target.value)}/></label>
          <label>Address & phone <input className="safi-input" defaultValue={shop.address} onBlur={e => setT('shopAddress', e.target.value)}/></label>
          <label>KRA PIN / P.O. Box <input className="safi-input" defaultValue={shop.kra} onBlur={e => setT('shopKRA', e.target.value)}/></label>
          <label>Website <input className="safi-input" defaultValue={shop.web} onBlur={e => setT('shopWeb', e.target.value)}/></label>
          <h4 className="safi-section-h">Payment details (printed on receipt)</h4>
          <label>M-Pesa Till instruction <input className="safi-input" defaultValue={shop.mpesaTill} onBlur={e => setT('shopMpesaTill', e.target.value)} placeholder="Lipa na M-Pesa Till: 123456"/></label>
          <label>Bank account instruction <input className="safi-input" defaultValue={shop.bank} onBlur={e => setT('shopBank', e.target.value)} placeholder="Equity Bank 0000-0000-0000 · Vazi Safi Ltd"/></label>
          <label>Receipt footer message <input className="safi-input" defaultValue={shop.footerMsg} onBlur={e => setT('shopFooterMsg', e.target.value)} placeholder="ASANTE — KARIBU TENA"/></label>
          <label>Receipt terms & conditions
            <textarea className="safi-textarea" defaultValue={shop.terms} onBlur={e => setT('shopTerms', e.target.value)} placeholder="Items uncollected after 30 days are donated…" style={{ minHeight: 80 }}/>
          </label>
          <p className="safi-hint">Changes save when you click out of each field.</p>
        </div>
      </Card>

      <Card title="Receipt integrity" action={<span className="safi-cell-sub">Printed on every receipt and texted to every customer</span>}>
        <div className="safi-form" style={{ maxWidth: 760 }}>
          <label>Official payment destination
            <input className="safi-input safi-mono" defaultValue={D.settings?.payTo || ''}
              onBlur={e => window.SAFI_STORE.setSetting('payTo', e.target.value)}
              placeholder="Till 123456"/>
          </label>
          <label>Account name on that till
            <input className="safi-input" defaultValue={D.settings?.payToName || ''}
              onBlur={e => window.SAFI_STORE.setSetting('payToName', e.target.value)}
              placeholder="Vazi Safi Ltd"/>
          </label>
          <label>Owner number for queries
            <input className="safi-input safi-mono" defaultValue={D.settings?.ownerPhone || ''}
              onBlur={e => window.SAFI_STORE.setSetting('ownerPhone', e.target.value)}
              placeholder="07xx xxx xxx"/>
          </label>
          <p className="safi-hint">
            Both appear on the receipt and in the intake SMS, so a customer asked to pay anywhere
            else can see that it is wrong. Put the same two lines on a sign at the counter.
          </p>
          <h4 className="safi-section-h">Controls</h4>
          <label className="safi-toggle safi-toggle--lg">
            <input type="checkbox" checked={!!D.settings?.requireTag}
              onChange={e => { window.SAFI_STORE.setSetting('requireTag', e.target.checked); toast(`Tag number ${e.target.checked ? 'required' : 'optional'}`); }}/>
            <span/>
            <div>
              <b>Require a tag number on every order</b>
              <p className="safi-cell-sub" style={{ margin: '2px 0 0' }}>Read off a pre-numbered tag book. Numbers that never reach an order show up as gaps.</p>
            </div>
          </label>
          <label>Cash variance worth flagging (KES)
            <input className="safi-input safi-mono" style={{ maxWidth: 140 }} defaultValue={D.settings?.varianceLimit ?? 100}
              onBlur={e => window.SAFI_STORE.setSetting('varianceLimit', Number(e.target.value) || 0)}/>
          </label>
        </div>
      </Card>

      <Card title="Backlog alerts" action={<span className="safi-cell-sub">Front Desk shows a banner and chimes when a list passes its limit</span>}>
        <div className="safi-form" style={{ maxWidth: 420 }}>
          <label className="safi-toggle"><input type="checkbox" defaultChecked={!(D.settings && D.settings.backlogAlertOn === false)} onChange={e => window.SAFI_STORE.setSetting('backlogAlertOn', e.target.checked)}/><span/><b>Show the "Action required" banner on Front Desk</b></label>
          <div className="safi-form__row">
            <label>Overdue orders above<input type="number" min="1" className="safi-input safi-mono" defaultValue={(D.settings && D.settings.overdueAlert) || 20} onBlur={e => window.SAFI_STORE.setSetting('overdueAlert', Math.max(1, parseInt(e.target.value, 10) || 20))}/></label>
            <label>Uncollected orders above<input type="number" min="1" className="safi-input safi-mono" defaultValue={(D.settings && D.settings.uncollectedAlert) || 20} onBlur={e => window.SAFI_STORE.setSetting('uncollectedAlert', Math.max(1, parseInt(e.target.value, 10) || 20))}/></label>
          </div>
          <p className="safi-hint">Saved to the cloud and shared by every laptop. The banner flashes and chimes when the app opens, then every 2 hours while a list is over its limit.</p>
        </div>
      </Card>

      <Card title="Owner PIN" action={<span className="safi-cell-sub">Required to enter Management area</span>}>
        <div className="safi-form" style={{ maxWidth: 320 }}>
          <label>PIN<input className="safi-input safi-mono" defaultValue={shop.ownerPin} onBlur={e => setT('ownerPin', e.target.value)}/></label>
          <p className="safi-hint">Keep it private. Change it any time it has been seen by someone you do not trust.</p>
        </div>
      </Card>

      <MachineTimersCard/>

      {window.StaffSignInCard && <window.StaffSignInCard/>}

      <SoundsCard/>

      <LoyaltyPointsCard/>

      <TrackingCard/>

      {(D.settings || {}).pointsOn === false && <Card title="Loyalty discount" action={<span className="safi-cell-sub">Every Nth order earns a discount on the next one</span>}>
        <div className="safi-form" style={{ maxWidth: 560 }}>
          <label className="safi-toggle safi-toggle--lg">
            <input type="checkbox" checked={(D.settings || {}).loyaltyOn !== false && Number((D.settings || {}).loyaltyPct) > 0} onChange={e => { window.SAFI_STORE.setSetting('loyaltyOn', e.target.checked); if (e.target.checked && !Number((D.settings || {}).loyaltyPct)) window.SAFI_STORE.setSetting('loyaltyPct', 10); }}/><span/>
            <div><b>Loyalty discount on</b><p className="safi-cell-sub" style={{ margin: '2px 0 0' }}>At the {Number((D.settings || {}).loyaltyEvery) || 10}th order the client gets a thank-you SMS; the next order gets the discount automatically and the count restarts.</p></div>
          </label>
          <div className="safi-form__row">
            <label>Orders to earn it<input type="number" min="2" max="50" className="safi-input safi-mono" value={Number((D.settings || {}).loyaltyEvery) || 10} onChange={e => window.SAFI_STORE.setSetting('loyaltyEvery', Math.max(2, Number(e.target.value) || 10))}/></label>
            <label>Discount %<input type="number" min="0" max="100" className="safi-input safi-mono" value={Number((D.settings || {}).loyaltyPct) || 0} onChange={e => window.SAFI_STORE.setSetting('loyaltyPct', Math.min(100, Math.max(0, Number(e.target.value) || 0)))}/></label>
          </div>
          <label>Thank-you SMS (tokens: {'{name} {n} {pct} {since}'})
            <textarea className="safi-textarea" rows="2" defaultValue={(D.smsTemplates || {}).loyalty || 'Hi {name}, thank you for choosing Vazi Safi! This is your {n}th order{since}. Your next order gets {pct}% off. Asante!'} onBlur={e => window.SAFI_STORE.setSmsTemplate && window.SAFI_STORE.setSmsTemplate('loyalty', e.target.value)}/>
          </label>
        </div>
      </Card>}

      <Card title="Closing check" action={<span className="safi-cell-sub">Stops orders being left in Washing / Drying overnight</span>}>
        <div className="safi-form" style={{ maxWidth: 560 }}>
          <label className="safi-toggle safi-toggle--lg">
            <input type="checkbox" checked={(D.settings || {}).closingCheck !== false} onChange={e => window.SAFI_STORE.setSetting('closingCheck', e.target.checked)}/><span/>
            <div><b>Remind Front Desk before closing</b><p className="safi-cell-sub" style={{ margin: '2px 0 0' }}>A window with a chime lists every order still in Washing or Drying until each is moved to Holding, Final Hold or Ready.</p></div>
          </label>
          <CounterLaptopChoice/>
          <div className="safi-form__row">
            <label>Closing time (Mon–Sat)<input type="time" className="safi-input safi-mono" value={(D.settings || {}).closingTime || '20:00'} onChange={e => window.SAFI_STORE.setSetting('closingTime', e.target.value)}/></label>
            <label>Closing time (Sunday)<input type="time" className="safi-input safi-mono" value={(D.settings || {}).closingTimeSun || '17:00'} onChange={e => window.SAFI_STORE.setSetting('closingTimeSun', e.target.value)}/></label>
            
            <label>Chime every
              <div className="safi-seg">{[2, 3, 5, 10, 15].map(m => <button key={m} className={`safi-seg__btn ${(Number((D.settings || {}).closingChimeMin) || 5) === m ? 'is-active' : ''}`} onClick={() => window.SAFI_STORE.setSetting('closingChimeMin', m)}>{m} min</button>)}</div>
            </label>
            <label>Quiet after<input type="time" className="safi-input safi-mono" value={(D.settings || {}).closingQuietAt || '22:00'} onChange={e => window.SAFI_STORE.setSetting('closingQuietAt', e.target.value)}/></label>
            <label>"Remind me" buttons (minutes)
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="safi-input" style={{ width: 'auto' }} value={Number((D.settings || {}).closingSnoozeA) || 10} onChange={e => window.SAFI_STORE.setSetting('closingSnoozeA', Number(e.target.value))}>{[5, 10, 15, 20, 25, 30].map(m => <option key={m} value={m}>{m} min</option>)}</select>
                <select className="safi-input" style={{ width: 'auto' }} value={Number((D.settings || {}).closingSnoozeB) || 15} onChange={e => window.SAFI_STORE.setSetting('closingSnoozeB', Number(e.target.value))}>{[5, 10, 15, 20, 25, 30].map(m => <option key={m} value={m}>{m} min</option>)}</select>
              </div>
            </label>
            <label>Start reminding (minutes before)<input type="number" min="0" max="180" className="safi-input safi-mono" value={(D.settings || {}).closingLeadMin == null ? 25 : (D.settings || {}).closingLeadMin} onChange={e => window.SAFI_STORE.setSetting('closingLeadMin', Number(e.target.value) || 0)}/></label>
          </div>
        </div>
      </Card>

      <Card title="Operations">
        <ul className="safi-form" style={{ gap: 14 }}>
          <li>
            <label className="safi-toggle safi-toggle--lg">
              <input type="checkbox" checked={!!D.settings?.firstTimeBagFree} onChange={e => { window.SAFI_STORE.setSetting('firstTimeBagFree', e.target.checked); toast(`First-time free bag ${e.target.checked ? 'ON' : 'OFF'}`); }}/>
              <span/>
              <div>
                <b>Free laundry bag for first-time customers</b>
                <p className="safi-cell-sub" style={{ margin: '2px 0 0' }}>When ON, every new customer's first order auto-adds a complimentary laundry bag.</p>
              </div>
            </label>
          </li>
        </ul>
      </Card>

      <Card title="Laundry Express Service" action={<span className="safi-cell-sub">Charged on wash, dry & fold items (incl. duvets). Dry cleaning and shoes excluded.</span>}>
        <div className="safi-form" style={{ maxWidth: 320 }}>
          <label>Express charge (% of laundry value)
            <input type="number" min="0" max="200" className="safi-input safi-mono" defaultValue={Number((D.settings && D.settings.expressPct) ?? 50)}
              onBlur={e => { const v = Math.max(0, Math.min(200, Number(e.target.value) || 0)); window.SAFI_STORE.setSetting('expressPct', v); toast(`Express set to ${v}%`); }}/>
          </label>
          <p className="safi-hint">Saved to the cloud; every laptop uses it on the next sync.</p>
        </div>
      </Card>

      <Card title="Stage SMS · on / off" action={<span className="safi-cell-sub">An ON stage always sends; OFF never sends</span>}>
        <div className="safi-smsstages">
          {[['washing', 'Washing'], ['drying', 'Drying'], ['ironing', 'Ironing'], ['drycleaning', 'Dry cleaning'], ['ready', 'Ready'], ['collected', 'Collected']].map(([k, l]) => {
            const DEF = { washing: true, drying: false, ironing: false, drycleaning: true, ready: true, collected: true };
            const cur = { ...DEF, ...((D.settings && D.settings.smsStages) || {}) };
            return (
              <label key={k} className="safi-toggle safi-toggle--lg">
                <input type="checkbox" checked={cur[k] !== false} onChange={e => window.SAFI_STORE.setSetting('smsStages', { ...cur, [k]: e.target.checked })}/>
                <span/><div><b>{l}</b><div className="safi-cell-sub">{cur[k] !== false ? 'SMS sent' : 'No SMS'}</div></div>
              </label>
            );
          })}
        </div>
      </Card>

      <Card title="SMS templates" action={<span className="safi-cell-sub">{'Tokens: {name} {id} {balance} {rider} {due} {track} {points}'}</span>}>
        <div className="safi-form" style={{ maxWidth: 760 }}>
          <h4 className="safi-section-h">Built-in stages (sent automatically when offered)</h4>
          {[
            ['ready',     'Order ready for collection'],
            ['washing',   'Order started washing'],
            ['ironing',   'Order moved to ironing'],
            ['collected', 'Order collected (thank-you)'],
            ['delivery',  'Rider on the way (delivery)'],
          ].map(([key, lbl]) => (
            <label key={key}>{lbl}
              <textarea className="safi-textarea" value={tpl[key] || ''}
                onChange={e => setTpl({ ...tpl, [key]: e.target.value })}
                onBlur={() => window.SAFI_STORE.setSmsTemplate(key, tpl[key])}/>
            </label>
          ))}

          <h4 className="safi-section-h">Your custom messages</h4>
          {Object.keys(tpl).filter(k => !['ready', 'washing', 'ironing', 'collected', 'delivery'].includes(k)).map(key => (
            <label key={key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{key}</span>
                <button className="safi-rowlink safi-rowlink--danger" onClick={() => {
                  const next = { ...tpl }; delete next[key]; setTpl(next);
                  window.SAFI_STORE.setSmsTemplate(key, undefined);
                }}>Delete</button>
              </div>
              <textarea className="safi-textarea" value={tpl[key] || ''}
                onChange={e => setTpl({ ...tpl, [key]: e.target.value })}
                onBlur={() => window.SAFI_STORE.setSmsTemplate(key, tpl[key])}/>
            </label>
          ))}

          <div className="safi-add-tpl">
            <input className="safi-input" placeholder="Template name (e.g. promo, holiday-greeting, reminder)" id="safi-new-tpl-key"/>
            <Button kind="secondary" icon="plus" onClick={() => {
              const inp = document.getElementById('safi-new-tpl-key');
              const k = (inp?.value || '').trim().toLowerCase().replace(/\s+/g, '-');
              if (!k) { toast('Name required', 'error'); return; }
              if (tpl[k]) { toast('Already exists', 'error'); return; }
              const newTpl = { ...tpl, [k]: 'Hi {name}, ' };
              setTpl(newTpl);
              window.SAFI_STORE.setSmsTemplate(k, newTpl[k]);
              inp.value = '';
              toast(`Template "${k}" added`);
            }}>Add custom template</Button>
          </div>

          <p className="safi-hint">Real SMS sending requires connecting an SMS gateway (e.g. Africa's Talking, ~KES 0.80/SMS). The cloud upgrade wires this up. Until then, every message is logged in Messages so you can review or copy them.</p>
        </div>
      </Card>
    </>
  );
}

// ─── Dispatch (Pickup & Delivery) ─────────────────────────────────────────
function DispatchScreen({ lang, money, setView }) {
  const D = useStore();
  const [show, setShow]   = useStateX(false);
  const [editId, setEdit] = useStateX(null);
  const [form, setForm]   = useStateX({ type: 'delivery', orderId: '', customerId: '', address: '', area: '', rider: D.staff.find(s => s.role === 'Rider')?.id || '', slotStart: '', slotEnd: '', notes: '' });
  const [statusFilter, setStatusFilter] = useStateX('all');
  const [dayFilter, setDayFilter] = useStateX('');

  const filtered = D.dispatch.filter(d => (statusFilter === 'all' || d.status === statusFilter) && (!dayFilter || d.slotDate === dayFilter))
    .sort((a, b) => String(a.slotDate || '9999').localeCompare(String(b.slotDate || '9999')) || String(a.slotStart || '').localeCompare(String(b.slotStart || '')));
  const counts = {
    scheduled:  D.dispatch.filter(d => d.status === 'scheduled').length,
    'en-route': D.dispatch.filter(d => d.status === 'en-route').length,
    completed:  D.dispatch.filter(d => d.status === 'completed').length,
  };

  function openAdd(type) {
    setEdit(null);
    setForm({ type: type || 'delivery', orderId: '', customerId: '', address: '', area: '', rider: D.staff.find(s => s.role === 'Rider')?.id || '', slotStart: '', slotEnd: '', notes: '' });
    setShow(true);
  }
  function openEdit(d) {
    setEdit(d.id);
    setForm({ type: d.type, orderId: d.orderId, customerId: d.customerId, address: d.address, area: d.area, rider: d.rider, slotDate: d.slotDate || '', slotStart: d.slotStart, slotEnd: d.slotEnd, notes: d.notes });
    setShow(true);
  }
  function submit() {
    if (!form.address) { toast('Address required', 'error'); return; }
    if (editId) { window.SAFI_STORE.updateDispatch(editId, form); toast('Dispatch updated'); }
    else { window.SAFI_STORE.addDispatch(form); toast('Dispatch scheduled'); }
    setShow(false);
  }
  function changeStatus(id, status) {
    const d = D.dispatch.find(x => x.id === id);
    if (status === 'completed' && d && d.orderId && d.type === 'delivery') {
      const o = D.orders.find(x => x.id === d.orderId);
      const bal = o ? (o.total || 0) - (o.paid || 0) : 0;
      if (bal > 0) { toast(`Order ${orderNo(o.id)} still owes KES ${bal.toLocaleString('en-KE')}. Record the payment before marking delivered.`, 'error'); return; }
    }
    window.SAFI_STORE.updateDispatch(id, { status });
    toast(`Marked ${status}`);

    // Auto-send SMS when en-route
    if (status === 'en-route' && d) {
      const cust = D.customers.find(c => c.id === d.customerId);
      const rider = D.staff.find(s => s.id === d.rider);
      if (cust && cust.phone) {
        const tpl = (D.smsTemplates || {}).delivery || 'Hi {name}, our rider {rider} is on the way with your order {id}.';
        const order = d.orderId ? D.orders.find(o => o.id === d.orderId) : null;
        const body = window.safiTokens(tpl, order, cust)
          .replace(/\{name\}/g, firstName(cust.name))
          .replace(/\{id\}/g, d.orderId || '—')
          .replace(/\{rider\}/g, rider?.name || 'our rider')
          .replace(/\{balance\}/g, order ? `KES ${Math.round(order.total - order.paid).toLocaleString('en-KE')}` : '—')
          .replace(/\{due\}/g, '');
        window.SAFI_STORE.logMessage({
          to: `${cust.prefix || ''} ${cust.phone}`.trim(),
          name: cust.name, body,
          orderId: d.orderId || '', stage: 'delivery',
          method: 'sms',
        });
        toast(`SMS sent to ${cust.name}`);
      }
    }

    // If delivery is completed, also mark the linked order as collected
    if (status === 'completed') {
      if (d && d.orderId && d.type === 'delivery') {
        const order = D.orders.find(o => o.id === d.orderId);
        if (order && order.status === 'ready') {
          window.SAFI_STORE.updateOrder(d.orderId, { status: 'collected' });
          toast(`Order ${orderNo(d.orderId)} marked Collected`);
        }
      }
    }
  }

  // Auto-fill address from customer
  useEffectX(() => {
    if (form.customerId) {
      const c = D.customers.find(x => x.id === form.customerId);
      if (c?.address) setForm(f => ({ ...f, address: c.address }));
    }
  }, [form.customerId]);

  return (
    <>
      <Topbar
        title="Pickup & Delivery"
        subtitle="Schedule pickups from customers and deliveries back to them. Assign a rider, track status."
        right={<>
          <Button kind="ghost" icon="pickup" onClick={() => openAdd('pickup')}>Schedule pickup</Button>
          <Button kind="primary" icon="truck" onClick={() => openAdd('delivery')}>Schedule delivery</Button>
        </>}
      />

      <div className="safi-grid safi-grid--3">
        <button className={`safi-stat safi-stat--issue ${statusFilter === 'scheduled' ? 'is-selected' : ''}`} style={{ borderLeftColor: 'var(--amber)', textAlign: 'left', cursor: 'pointer' }} onClick={() => setStatusFilter('scheduled')}>
          <div className="safi-stat__label">Scheduled</div>
          <div className="safi-stat__value">{counts.scheduled}</div>
        </button>
        <button className="safi-stat safi-stat--issue" style={{ borderLeftColor: 'var(--brand)', textAlign: 'left', cursor: 'pointer' }} onClick={() => setStatusFilter('en-route')}>
          <div className="safi-stat__label">En route</div>
          <div className="safi-stat__value">{counts['en-route']}</div>
        </button>
        <button className="safi-stat safi-stat--issue" style={{ borderLeftColor: 'var(--green)', textAlign: 'left', cursor: 'pointer' }} onClick={() => setStatusFilter('completed')}>
          <div className="safi-stat__label">Completed</div>
          <div className="safi-stat__value">{counts.completed}</div>
        </button>
      </div>

      {window.DispatchCalendar && <window.DispatchCalendar value={dayFilter} onPick={setDayFilter}/>}

      <Card pad={false} title={`Dispatch board · ${statusFilter === 'all' ? 'all' : statusFilter}${dayFilter ? ' · ' + dayFilter : ''}`} action={
        <div className="safi-tabs">
          <button className={`safi-tabs__btn ${statusFilter === 'all' ? 'is-active' : ''}`} onClick={() => setStatusFilter('all')}>All</button>
          {['scheduled', 'en-route', 'completed'].map(s => (
            <button key={s} className={`safi-tabs__btn ${statusFilter === s ? 'is-active' : ''}`} onClick={() => setStatusFilter(s)}>{s}</button>
          ))}
        </div>
      }>
        <Table
          cols={[
            { label: 'Type', render: r => <span className={`safi-pill safi-pill--${r.type === 'pickup' ? 'amber' : 'blue'}`}><Icon name={r.type === 'pickup' ? 'pickup' : 'truck'} size={11}/> {r.type}</span> },
            { label: 'Order', render: r => r.orderId ? <span className="safi-mono">{orderNo(r.orderId)}</span> : <span className="safi-cell-sub">—</span> },
            { label: 'Customer', render: r => {
              const c = D.customers.find(x => x.id === r.customerId);
              return c ? <div><div className="safi-cell-strong">{c.name}</div><div className="safi-cell-sub">{c.prefix} {c.phone}</div></div> : <span className="safi-cell-sub">Walk-in</span>;
            }},
            { label: 'Address', render: r => <div><div>{r.address}</div>{r.area && <div className="safi-cell-sub">{r.area}</div>}</div> },
            { label: 'Slot', render: r => (r.slotDate || r.slotStart) ? <div><span className="safi-mono">{r.slotDate ? dmy(r.slotDate) + ' ' : ''}{r.slotStart}{r.slotEnd ? ' – ' + r.slotEnd : ''}</span>{r.slotDateGuessed && <div className="safi-cell-sub" title="Filled in from the order. Edit to confirm.">date estimated · check</div>}</div> : <span className="safi-cell-sub">—</span> },
            { label: 'Rider', render: r => {
              const s = D.staff.find(x => x.id === r.rider);
              return s ? <span className="safi-cell-cust"><Icon name="rider" size={14}/> &nbsp;<b>{s.name}</b></span> : <span className="safi-cell-sub">Unassigned</span>;
            }},
            { label: 'Status', render: r => <span className={`safi-pill safi-pill--${r.status === 'completed' ? 'green' : r.status === 'en-route' ? 'blue' : 'amber'}`}><span className="safi-pill__dot"/>{r.status}</span> },
            { label: '', render: r => (
              <div style={{ display: 'flex', gap: 4 }}>
                {r.status === 'scheduled' && <button className="safi-rowlink" onClick={() => changeStatus(r.id, 'en-route')}>Start →</button>}
                {r.status === 'en-route' && <button className="safi-rowlink" onClick={() => changeStatus(r.id, 'completed')}>Complete →</button>}
                <button className="safi-rowlink" onClick={() => openEdit(r)}>Edit</button>
              </div>
            )},
          ]}
          rows={filtered}
          empty="No dispatch jobs in this view."
        />
      </Card>

      {/* Add / edit dispatch modal */}
      <Modal open={show} onClose={() => setShow(false)} title={editId ? 'Edit dispatch' : (form.type === 'pickup' ? 'Schedule pickup' : 'Schedule delivery')} width={620}
        footer={<>
          <Button kind="ghost" onClick={() => setShow(false)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={submit}>{editId ? 'Save changes' : 'Schedule'}</Button>
        </>}>
        <div className="safi-form">
          <label>Type
            <div className="safi-seg safi-seg--full">
              <button className={`safi-seg__btn ${form.type === 'pickup' ? 'is-active' : ''}`} onClick={() => setForm({ ...form, type: 'pickup' })}><Icon name="pickup" size={14}/> Pickup</button>
              <button className={`safi-seg__btn ${form.type === 'delivery' ? 'is-active' : ''}`} onClick={() => setForm({ ...form, type: 'delivery' })}><Icon name="truck" size={14}/> Delivery</button>
            </div>
          </label>
          <div className="safi-form__row">
            <label>Order # (optional)<input className="safi-input safi-mono" value={form.orderId} onChange={e => setForm({ ...form, orderId: e.target.value.toUpperCase() })} placeholder="SF-2425"/></label>
            <label>Customer
              <window.CustomerTypeahead value={form.customerId} onChange={id => {
                const lastOrder = id ? D.orders.find(o => o.customer === id && o.status !== 'collected') : null;
                setForm(f => ({ ...f, customerId: id, orderId: f.orderId || (lastOrder ? lastOrder.id : '') }));
              }}/>
            </label>
          </div>
          <label>Address<input className="safi-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Block & house number, gate / landmark"/></label>
          <label>Area / Estate<input className="safi-input" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} placeholder="Kilimani · Karen · Ngong Rd…"/></label>
          <div className="safi-form__row">
            <label>Date<input type="date" className="safi-input safi-mono" value={form.slotDate || ''} onChange={e => setForm({ ...form, slotDate: e.target.value })}/></label>
            <label>Slot start<input type="time" className="safi-input safi-mono" value={form.slotStart} onChange={e => setForm({ ...form, slotStart: e.target.value })}/></label>
            <label>Slot end<input type="time" className="safi-input safi-mono" value={form.slotEnd} onChange={e => setForm({ ...form, slotEnd: e.target.value })}/></label>
          </div>
          <label>Assigned rider
            <select className="safi-input" value={form.rider} onChange={e => setForm({ ...form, rider: e.target.value })}>
              <option value="">— Unassigned —</option>
              {D.staff.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
            </select>
          </label>
          <label>Notes<textarea className="safi-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anything the rider needs to know — gate code, contact, payment on collection…"/></label>
        </div>
      </Modal>
    </>
  );
}

// ─── Messages (SMS log) ───────────────────────────────────────────────────
function MessagesScreen({ lang, role }) {
  const D = useStore();
  const [tab, setTab] = useStateX('all');
  const rows = D.messages.filter(m => tab === 'all' || (tab === 'failed' ? m.status === 'failed' : m.stage === tab));
  const failed = D.messages.filter(m => m.status === 'failed');

  return (
    <>
      <Topbar
        title="Messages"
        subtitle={(D.settings || {}).smsLive ? 'Texts go out through Africa\'s Talking. Offline texts wait in the queue and send when the internet is back.' : 'Real sending is off. Texts are only logged here.'}
      />
      {role === 'owner' && window.SAFI_SMS_READY && window.SmsGatewayCard && <window.SmsGatewayCard/>}
      {role === 'owner' && window.SAFI_SMS_READY && window.SmsCampaignCard && <window.SmsCampaignCard/>}

      <div className="safi-grid safi-grid--4">
        <StatCard label="Total messages" value={D.messages.length} icon="sms"/>
        <StatCard label="Ready notifications" value={D.messages.filter(m => m.stage === 'ready').length} icon="check"/>
        <StatCard label="Delivery alerts" value={D.messages.filter(m => m.stage === 'delivery').length} icon="truck"/>
        <StatCard label="Last sent" value={D.messages[0]?.date.slice(11) || '—'} icon="clock"/>
      </div>
      {window.WinbackCard && <window.WinbackCard readOnly={role !== 'owner'}/>}

      {failed.length > 0 && (D.settings || {}).smsLive && (
        <div className="safi-sms-fail">
          <span><b>{failed.length}</b> text{failed.length === 1 ? '' : 's'} failed to send.</span>
          <Button kind="ghost" size="sm" onClick={() => { window.SAFI_STORE.retryMessages(failed.map(m => m.id)); toast('Retrying'); }}>Retry all</Button>
        </div>
      )}
      <Card pad={false} title="Message log" action={
        <div className="safi-tabs">
          {['all', 'intake', 'ready', 'washing', 'ironing', 'collected', 'delivery', 'winback', 'campaign', 'failed'].map(x => (
            <button key={x} className={`safi-tabs__btn ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>{x}</button>
          ))}
        </div>
      }>
        <Table
          cols={[
            { label: 'Sent', render: r => <span className="safi-cell-sub">{dmy(r.date)}</span> },
            { label: 'To', render: r => <div><div className="safi-cell-strong">{r.name}</div><div className="safi-cell-sub safi-mono">{r.to}</div></div> },
            { label: 'Stage', render: r => <span className={`safi-tag safi-tag--blue`}>{r.stage}</span> },
            { label: 'Order', render: r => r.orderId ? <span className="safi-mono">{orderNo(r.orderId)}</span> : <span className="safi-cell-sub">—</span> },
            { label: 'Body', render: r => <div className="safi-msg-body">{r.body}</div> },
            { label: 'Status', render: r => window.SmsStatus ? <window.SmsStatus m={r}/> : r.status },
          ]}
          rows={rows}
          empty="No messages yet. They appear here when you advance an order's stage."
        />
      </Card>
    </>
  );
}

// ─── Helper: render template with tokens ──────────────────────────────────
function renderSmsTemplate(tpl, ctx) {
  return (tpl || '').replace(/\{(\w+)\}/g, (_, k) => ctx[k] != null ? ctx[k] : '');
}

// ─── Approvals queue (Management) ─────────────────────────────────────────
function ApprovalsScreen({ lang, money, setView, setActiveOrderId }) {
  const D = useStore();
  const [cloud, setCloud] = useStateX(null);
  const [checking, setChecking] = useStateX(false);
  useEffectX(() => window.SAFI_CLOUD ? window.SAFI_CLOUD.subscribe(setCloud) : undefined, []);
  async function checkNow() {
    if (!window.SAFI_CLOUD) return;
    setChecking(true);
    try { await window.SAFI_CLOUD.syncNow(); toast('Requests checked'); }
    catch (e) { toast(e.message || 'Could not reach the cloud', 'error'); }
    finally { setChecking(false); }
  }
  // While this screen is open, look for new requests every 30 seconds.
  useEffectX(() => {
    if (!window.SAFI_CLOUD) return;
    const id = setInterval(() => window.SAFI_CLOUD.syncNow().catch(() => {}), 30000);
    return () => clearInterval(id);
  }, []);
  const cfg = window.SAFI_CLOUD ? window.SAFI_CLOUD.getConfig() : {};
  const [tab, setTab] = useStateX('pending');
  const rows = D.approvals.filter(a => tab === 'all' || a.status === tab);
  const pendingCount = D.approvals.filter(a => a.status === 'pending').length;
  const [decideOn, setDecideOn] = useStateX(null); // approval being decided
  const [note, setNote]         = useStateX('');

  const actionLabel = {
    delete_order: 'Delete order',
    rewash_order: 'Rewash (free)',
    edit_order:   'Edit order items',
    refund_order: 'Refund order',
    reprint_receipt: 'Second receipt print',
  };

  function approve(a) {
    window.SAFI_STORE.decideApproval(a.id, 'approved', note);
    toast('Approved & executed', 'success');
    setDecideOn(null); setNote('');
  }
  function reject(a) {
    window.SAFI_STORE.decideApproval(a.id, 'rejected', note);
    toast('Rejected', 'success');
    setDecideOn(null); setNote('');
  }

  return (
    <>
      <Topbar
        title="Approvals"
        subtitle={pendingCount > 0 ? `${pendingCount} pending request${pendingCount === 1 ? '' : 's'} from staff` : 'No pending requests'}
        right={<>
          <span className="safi-cell-sub">{cfg.lastSync ? 'Last checked ' + SAFI_TIME.stamp(new Date(cfg.lastSync)).slice(11) : 'Not synced yet'}</span>
          <Button kind="primary" icon="arrow" onClick={checkNow} disabled={checking}>{checking ? 'Checking…' : 'Check for new requests'}</Button>
        </>}
      />
      {window.SAFI_CLOUD && !cfg.liveSync && (
        <div className="safi-callout" style={{ background: 'var(--amber-soft)', color: '#92450C', borderLeft: '3px solid var(--amber)' }}>
          <Icon name="alert" size={14}/>
          <span><b>Live sync is off on this laptop.</b> Requests from the other till only arrive when you press Check, or turn Live sync on in Cloud & Updates. It must be on at the front desk too.</span>
        </div>
      )}
      {cloud && cloud.syncError && (
        <div className="safi-callout" style={{ background: 'var(--red-soft)', color: '#99211B', borderLeft: '3px solid var(--red)' }}>
          <Icon name="alert" size={14}/><span>Last sync problem: {cloud.syncError}</span>
        </div>
      )}

      <div className="safi-grid safi-grid--3">
        <button className="safi-stat" style={{ borderLeft: '4px solid var(--amber)', cursor: 'pointer', textAlign: 'left' }} onClick={() => setTab('pending')}>
          <div className="safi-stat__label">Pending</div>
          <div className="safi-stat__value">{D.approvals.filter(a => a.status === 'pending').length}</div>
        </button>
        <button className="safi-stat" style={{ borderLeft: '4px solid var(--green)', cursor: 'pointer', textAlign: 'left' }} onClick={() => setTab('approved')}>
          <div className="safi-stat__label">Approved</div>
          <div className="safi-stat__value">{D.approvals.filter(a => a.status === 'approved').length}</div>
        </button>
        <button className="safi-stat" style={{ borderLeft: '4px solid var(--red)', cursor: 'pointer', textAlign: 'left' }} onClick={() => setTab('rejected')}>
          <div className="safi-stat__label">Rejected</div>
          <div className="safi-stat__value">{D.approvals.filter(a => a.status === 'rejected').length}</div>
        </button>
      </div>

      <Card pad={false} title="Approval queue" action={
        <div className="safi-tabs">
          {['pending', 'approved', 'rejected', 'all'].map(x => (
            <button key={x} className={`safi-tabs__btn ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>{x}</button>
          ))}
        </div>
      }>
        <Table
          cols={[
            { label: 'Requested', render: r => <span className="safi-cell-sub">{dmy(r.requestedAt)}</span> },
            { label: 'Action', render: r => <b>{actionLabel[r.action] || r.action}</b> },
            { label: 'Order', render: r => (
              <button className="safi-mono safi-rowlink" onClick={() => { setActiveOrderId(r.target); setView('order-detail'); }}>{orderNo(r.target)}</button>
            )},
            { label: 'Requested by', render: r => {
              const s = D.staff.find(x => x.id === r.requestedBy);
              return s ? s.name : <span className="safi-cell-sub">—</span>;
            }},
            { label: 'Reason', render: r => <div className="safi-msg-body">{r.reason}</div> },
            { label: 'Status', render: r => <span className={`safi-pill safi-pill--${r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}`}><span className="safi-pill__dot"/>{r.status}</span> },
            { label: '', render: r => r.status === 'pending'
              ? <button className="safi-rowlink" onClick={() => setDecideOn(r)}>Decide →</button>
              : <span className="safi-cell-sub">{dmy(r.decidedAt)}</span>
            },
          ]}
          rows={rows}
          empty="No requests in this view."
        />
      </Card>

      <Modal open={!!decideOn} onClose={() => setDecideOn(null)} title={`Approve or reject — ${decideOn?.target}`} width={640}
        footer={<>
          <Button kind="ghost" onClick={() => setDecideOn(null)}>Cancel</Button>
          <Button kind="ghost" onClick={() => reject(decideOn)}><span style={{ color: 'var(--red)' }}>Reject</span></Button>
          <Button kind="primary" icon="check" onClick={() => approve(decideOn)}>Approve & execute</Button>
        </>}>
        <div className="safi-form">
          <div className="safi-callout">
            <Icon name="alert" size={14}/>
            <span><b>{actionLabel[decideOn?.action]}</b> · approving will run this action immediately and irreversibly.</span>
          </div>

          {decideOn && (() => {
            const orig = D.orders.find(o => o.id === decideOn.target);
            if (!orig) return <p className="safi-cell-sub">Order not found.</p>;
            const cust = D.customers.find(c => c.id === orig.customer);
            return (
              <div className="safi-approval-detail">
                <h4 className="safi-section-h">Current order — {orderNo(orig.id)}</h4>
                <div className="safi-approval-meta">
                  <div><span>Customer</span><b>{cust?.name || orderNo(orig.id)}</b></div>
                  <div><span>Placed</span><b>{dmy(orig.in)}</b></div>
                  <div><span>Status</span><b>{orig.status}</b></div>
                  <div><span>Current total</span><b className="safi-mono">{money(orig.total)}</b></div>
                  <div><span>Paid</span><b className="safi-mono">{money(orig.paid)}</b></div>
                </div>
                <table className="safi-approval-items">
                  <thead><tr><th>Service</th><th>Qty</th><th style={{ textAlign: 'right' }}>Line total</th></tr></thead>
                  <tbody>
                    {orig.items.map((it, i) => {
                      const svc = D.services.find(s => s.id === it.svc);
                      return (
                        <tr key={i}>
                          <td>{it.svc === 'other' && it.subtype ? it.subtype : (svc?.name || it.svc)}{it.free && <span className="safi-tag safi-tag--green" style={{ marginLeft: 4 }}>FREE</span>}</td>
                          <td>{it.qty} {it.unit || svc?.unit}</td>
                          <td className="safi-mono" style={{ textAlign: 'right' }}>{money(it.price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {decideOn.action === 'edit_order' && decideOn.payload && (
                  <>
                    <h4 className="safi-section-h">Proposed changes</h4>
                    <table className="safi-approval-items">
                      <thead><tr><th>Service</th><th>Qty</th><th style={{ textAlign: 'right' }}>Line total</th></tr></thead>
                      <tbody>
                        {(decideOn.payload.items || []).map((it, i) => {
                          const svc = D.services.find(s => s.id === it.svc);
                          return (
                            <tr key={i}>
                              <td>{it.svc === 'other' && it.subtype ? it.subtype : (svc?.name || it.svc)}{it.free && <span className="safi-tag safi-tag--green" style={{ marginLeft: 4 }}>FREE</span>}</td>
                              <td>{it.qty} {it.unit || svc?.unit}</td>
                              <td className="safi-mono" style={{ textAlign: 'right' }}>{money(it.price)}</td>
                            </tr>
                          );
                        })}
                        <tr className="safi-approval-items__total">
                          <td colSpan="2"><b>New total</b></td>
                          <td className="safi-mono" style={{ textAlign: 'right' }}><b>{money(decideOn.payload.total)}</b></td>
                        </tr>
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            );
          })()}

          <div><b>Staff reason:</b> <p style={{ margin: '4px 0 0', color: 'var(--ink-2)' }}>{decideOn?.reason}</p></div>
          <label>Your decision note (saved to log)<textarea className="safi-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="Optional — e.g. confirmed with customer."/></label>
        </div>
      </Modal>
    </>
  );
}

// ─── Time series chart (Revenue vs Expenses) ───────────────────────────────
function TimeSeries({ money }) {
  const D = window.safiTrim(useStore());
  const [granularity, setGranularity] = useStateX('month'); // 'day' | 'month' | 'year'
  const [expMode, setExpMode] = useStateX('total'); // 'total' | 'op' — which expenses the chart shows
  const now = new Date();
  const [monthYear, setMonthYear] = useStateX(now.getFullYear());
  const years = [0, 1, 2, 3, 4].map(i => now.getFullYear() - i);

  // Keys in shop-local time. toISOString() would turn local midnight on the 1st
  // into the previous day in UTC, shifting every Nairobi month back by one.
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

  const isOpEx = (e) => !window.costGroupOf || window.costGroupOf(D, e) !== 'special';
  // Build series from real data
  const points = [];
  if (granularity === 'year') {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      const key = String(y);
      const rev = D.orders.filter(o => String(o.in).startsWith(key)).reduce((s, o) => s + (o.total || 0), 0);
      const ex = D.expenses.filter(e => String(e.date).startsWith(key)); const exp = ex.reduce((s, e) => s + e.amount, 0); const op = ex.filter(isOpEx).reduce((s, e) => s + e.amount, 0);
      points.push({ label: key, rev, exp, op, profit: rev - exp });
    }
  } else if (granularity === 'day') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = dayKey(d);
      const label = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
      const rev = D.orders.filter(o => o.in.startsWith(key)).reduce((s, o) => s + (o.total || 0), 0);
      const ex = D.expenses.filter(e => e.date.startsWith(key)); const exp = ex.reduce((s, e) => s + e.amount, 0); const op = ex.filter(isOpEx).reduce((s, e) => s + e.amount, 0);
      points.push({ label, rev, exp, op, profit: rev - exp });
    }
  } else {
    // Current year: the last 12 months. A past year: January to December.
    const endMonth = monthYear === now.getFullYear() ? now.getMonth() : 11;
    const start = monthYear === now.getFullYear()
      ? new Date(now.getFullYear(), now.getMonth() - 11, 1)
      : new Date(monthYear, 0, 1);
    for (let i = 0; i < 12; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      if (monthYear !== now.getFullYear() && d.getMonth() > endMonth) break;
      const key = monthKey(d);
      const label = d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
      const rev = D.orders.filter(o => o.in.startsWith(key)).reduce((s, o) => s + (o.total || 0), 0);
      const ex = D.expenses.filter(e => e.date.startsWith(key)); const exp = ex.reduce((s, e) => s + e.amount, 0); const op = ex.filter(isOpEx).reduce((s, e) => s + e.amount, 0);
      points.push({ label, rev, exp, op, profit: rev - exp });
    }
  }

  const max = Math.max(1, ...points.map(p => Math.max(p.rev, p.exp)));
  const totalRev = points.reduce((s, p) => s + p.rev, 0);
  const totalExp = points.reduce((s, p) => s + p.exp, 0);
  const totalProfit = totalRev - totalExp;
  const totalOpProfit = totalRev - points.reduce((s, p) => s + (p.op || 0), 0);

  return (
    <Card title={`Revenue vs Expenses · ${
      granularity === 'day' ? 'last 30 days'
      : granularity === 'year' ? `${years[4]}–${years[0]}`
      : monthYear === now.getFullYear() ? 'last 12 months' : String(monthYear)}`} action={
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {granularity === 'month' && (
          <select className="safi-input" style={{ width: 'auto', padding: '6px 10px' }}
            value={monthYear} onChange={e => setMonthYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y === now.getFullYear() ? 'Last 12 months' : y}</option>)}
          </select>
        )}
        <div className="safi-seg" title="Which expenses to show">
          <button className={`safi-seg__btn ${expMode === 'total' ? 'is-active' : ''}`} onClick={() => setExpMode('total')}>Total expenses</button>
          <button className={`safi-seg__btn ${expMode === 'op' ? 'is-active' : ''}`} onClick={() => setExpMode('op')}>Operational</button>
        </div>
        <div className="safi-seg">
          <button className={`safi-seg__btn ${granularity === 'day' ? 'is-active' : ''}`} onClick={() => setGranularity('day')}>Daily</button>
          <button className={`safi-seg__btn ${granularity === 'month' ? 'is-active' : ''}`} onClick={() => setGranularity('month')}>Monthly</button>
          <button className={`safi-seg__btn ${granularity === 'year' ? 'is-active' : ''}`} onClick={() => setGranularity('year')}>Yearly</button>
        </div>
      </div>
    }>
      <div className="safi-ts-totals">
        <div className="safi-ts-totals__item safi-ts-totals__item--rev">
          <span className="safi-ts-totals__lbl">Revenue</span>
          <span className="safi-ts-totals__val safi-mono">{money(totalRev)}</span>
        </div>
        <div className="safi-ts-totals__item safi-ts-totals__item--exp">
          <span className="safi-ts-totals__lbl">{expMode === 'op' ? 'Operational expenses' : 'Total expenses'}</span>
          <span className="safi-ts-totals__val safi-mono">— {money(expMode === 'op' ? totalRev - totalOpProfit : totalExp)}</span>
        </div>
        <div className="safi-ts-totals__item safi-ts-totals__item--op">
          <span className="safi-ts-totals__lbl">Operating profit</span>
          <span className="safi-ts-totals__val safi-mono">{money(totalOpProfit)}</span>
        </div>
        <div className="safi-ts-totals__item safi-ts-totals__item--profit">
          <span className="safi-ts-totals__lbl">Net profit</span>
          <span className="safi-ts-totals__val safi-mono">{money(totalProfit)}</span>
        </div>
      </div>

      <SafiChart labels={points.map(p => p.label)} height={260} yLabel="KES" fmt={money} sparseLabels
        series={[{ name: 'Revenue', color: 'var(--brand)', values: points.map(p => p.rev) }, { name: expMode === 'op' ? 'Operational expenses' : 'Expenses', color: 'var(--amber)', values: points.map(p => expMode === 'op' ? (p.op || 0) : p.exp) }]}/>
    </Card>
  );
}

function SoundsCard() {
  const D = useStore();
  const st = D.settings || {};
  const [here, setHere] = useStateX(localStorage.getItem('safi_request_chime_here') === '1');
  const vol = st.chimeVolume == null ? 70 : Number(st.chimeVolume);
  return (
    <Card title="Sounds" action={<span className="safi-cell-sub">Chimes for approval requests and replies</span>}>
      <div className="safi-form" style={{ maxWidth: 560 }}>
        <label className="safi-toggle safi-toggle--lg">
          <input type="checkbox" checked={st.approvalChime !== false} onChange={e => window.SAFI_STORE.setSetting('approvalChime', e.target.checked)}/><span/>
          <div><b>Chime when a request for approval comes in</b><p className="safi-cell-sub" style={{ margin: '2px 0 0' }}>Plays in Management, and repeats every 2 minutes while a request is waiting.</p></div>
        </label>
        <label className="safi-toggle safi-toggle--lg">
          <input type="checkbox" checked={here} onChange={e => { setHere(e.target.checked); localStorage.setItem('safi_request_chime_here', e.target.checked ? '1' : '0'); }}/><span/>
          <div><b>Also play it on this laptop in Front Desk</b><p className="safi-cell-sub" style={{ margin: '2px 0 0' }}>Tick on your own laptop (not the shop's) so you hear requests without switching to Management.</p></div>
        </label>
        <label className="safi-toggle safi-toggle--lg">
          <input type="checkbox" checked={st.replyChime !== false} onChange={e => window.SAFI_STORE.setSetting('replyChime', e.target.checked)}/><span/>
          <div><b>Chime at Front Desk when Management replies</b><p className="safi-cell-sub" style={{ margin: '2px 0 0' }}>Plays when the "Management replied" message appears.</p></div>
        </label>
        <label>Volume · {vol}%
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="range" min="0" max="100" step="5" value={vol} style={{ flex: 1 }} onChange={e => window.SAFI_STORE.setSetting('chimeVolume', Number(e.target.value))}/>
            <Button kind="ghost" size="sm" onClick={() => window.safiSound && window.safiSound('request')}>Test request</Button>
            <Button kind="ghost" size="sm" onClick={() => window.safiSound && window.safiSound('reply')}>Test reply</Button>
          </div>
        </label>
      </div>
    </Card>
  );
}

Object.assign(window, { SoundsCard, PeriodSummary, SettingsScreen, DispatchScreen, MessagesScreen, ApprovalsScreen, TimeSeries, renderSmsTemplate });

// ─── Washer & dryer timers (Management) ───────────────────────────────────
// Top-level so the input keeps focus while typing; the value commits on blur / Enter.
function TimerDial({ value, label, unit, step = 1, onCommit }) {
  const [draft, setDraft] = useStateX(String(value));
  useEffectX(() => { setDraft(String(value)); }, [value]);
  const commit = (v) => { const n = Math.max(1, Math.round(Number(v) || 0)); setDraft(String(n)); if (n !== value) onCommit(n); };
  return (
    <label className="safi-dial">
      <span>{label}</span>
      <div className="safi-qty">
        <button type="button" onClick={() => commit(value - step)}>−</button>
        <input type="number" min="1" value={draft} onChange={e => setDraft(e.target.value)} onBlur={e => commit(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(e.currentTarget.value); } }}/>
        <span className="safi-qty__unit">{unit}</span>
        <button type="button" onClick={() => commit(value + step)}>+</button>
      </div>
    </label>
  );
}
function MachineTimersCard() {
  const D = useStore();
  const cur = { wash: 60, dry: 90, every: 30, length: 7, flash: 3, ...((D.settings || {}).machineTimers || {}) };
  const set = (k) => (n) => window.SAFI_STORE.setSetting('machineTimers', { ...cur, [k]: n });
  return (
    <Card title="Washer & dryer timers" action={<span className="safi-cell-sub">Green flashing outline on the Washing / Drying badge</span>}>
      <div className="safi-dials">
        <TimerDial value={cur.wash} label="Washing alert after" unit="min" step={5} onCommit={set('wash')}/>
        <TimerDial value={cur.dry} label="Drying alert after" unit="min" step={5} onCommit={set('dry')}/>
        <TimerDial value={cur.every} label="Repeat every" unit="min" step={5} onCommit={set('every')}/>
        <TimerDial value={cur.length} label="Alert lasts" unit="min" onCommit={set('length')}/>
        <TimerDial value={cur.flash} label="Flash every" unit="sec" onCommit={set('flash')}/>
      </div>
      <p className="safi-hint">Now: washing alerts at {cur.wash} min, drying at {cur.dry} min, then every {cur.every} min, each for {cur.length} min, flashing every {cur.flash} s. Saved to the cloud for all laptops.</p>
    </Card>
  );
}
Object.assign(window, { MachineTimersCard });

// ─── Which laptop shows the Closing check (Settings, per laptop) ──────────
function CounterLaptopChoice() {
  const C = window.safiCounter;
  const [mode, setMode] = useStateX(C.mode());
  const pick = (m) => { C.setMode(m); setMode(m); };
  const auto = C.tookOrdersRecently();
  return (
    <label>Show it on this laptop
      <div className="safi-seg">
        {[['auto', 'Auto'], ['on', 'Always'], ['off', 'Never']].map(([k, l]) => (
          <button key={k} type="button" className={`safi-seg__btn ${mode === k ? 'is-active' : ''}`} onClick={() => pick(k)}>{l}</button>
        ))}
      </div>
      <span className="safi-hint" style={{ display: 'block', marginTop: 4 }}>
        {mode === 'auto'
          ? (auto ? 'Auto: shows here, because this laptop took orders this week (it is the counter laptop).' : 'Auto: hidden here, because this laptop has not taken any orders this week.')
          : mode === 'on' ? 'Always shows on this laptop.' : 'Never shows on this laptop.'}
        {' '}Each laptop has its own choice. Laptop code: <span className="safi-mono">{C.code() || '—'}</span>.
      </span>
    </label>
  );
}

// ─── Loyalty points (Settings) ────────────────────────────────────────────
function LoyaltyPointsCard() {
  const D = useStore();
  const st = D.settings || {};
  const P = window.SAFI_POINTS;
  const c = P.cfg();
  const set = (k, v) => window.SAFI_STORE.setSetting(k, v);
  const groups = c.groups;
  const toggleGroup = (g) => set('pointsGroups', groups.includes(g) ? groups.filter(x => x !== g) : [...groups, g]);
  // Shop-wide totals, for a sense of what is owed in points.
  const totals = (() => {
    if (!c.on) return null;
    let bal = 0, holders = 0;
    for (const cu of D.customers || []) { if (!P.eligible(cu)) continue; const b = P.balance(cu.id); if (b > 0) { bal += b; holders++; } }
    return { bal, holders, kes: Math.round(bal * c.value) };
  })();
  const pct = (c.value / c.perKes * 100);
  return (
    <Card title="Loyalty points" action={<span className="safi-cell-sub">Customers earn points on what they pay and use them as money off</span>}>
      <div className="safi-form" style={{ maxWidth: 620 }}>
        <label className="safi-toggle safi-toggle--lg">
          <input type="checkbox" checked={c.on} onChange={e => { set('pointsOn', e.target.checked); if (e.target.checked && !st.pointsStart) set('pointsStart', SAFI_TIME.day()); }}/><span/>
          <div><b>Points on</b><p className="safi-cell-sub" style={{ margin: '2px 0 0' }}>Replaces the every-Nth-order discount. Turn off to go back to it.</p></div>
        </label>
        {c.on && <>
          <div className="safi-form__row">
            <label>KES spent for 1 point<input type="number" min="1" className="safi-input safi-mono" defaultValue={c.perKes} onBlur={e => set('pointsPerKes', Math.max(1, Number(e.target.value) || 100))}/></label>
            <label>1 point is worth (KES)<input type="number" min="0.01" step="0.01" className="safi-input safi-mono" defaultValue={c.value} onBlur={e => set('pointValue', Math.max(0.01, Number(e.target.value) || 1))}/></label>
          </div>
          <div className="safi-form__row">
            <label>Points needed before use<input type="number" min="0" className="safi-input safi-mono" defaultValue={c.minRedeem} onBlur={e => set('pointsMinRedeem', Math.max(0, parseInt(e.target.value, 10) || 0))}/></label>
            <label>Expire after no visit for (months, 0 = never)<input type="number" min="0" className="safi-input safi-mono" defaultValue={c.expiryMonths} onBlur={e => set('pointsExpiryMonths', Math.max(0, parseInt(e.target.value, 10) || 0))}/></label>
          </div>
          <label>Who earns
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {[['normal', 'Normal'], ['student', 'Student'], ['corporate', 'Corporate']].map(([g, l]) => (
                <button key={g} type="button" className={`safi-chip ${groups.includes(g) ? 'is-active' : ''}`} onClick={() => toggleGroup(g)}>{l}</button>
              ))}
            </div>
          </label>
          <p className="safi-hint">
            That is {pct % 1 ? pct.toFixed(1) : pct}% back: a KES {(c.perKes * 10).toLocaleString('en-KE')} order earns 10 points = KES {Math.round(10 * c.value)} off later.
            Points are earned once an order is fully paid, on the amount after discounts. Counting since {c.start || 'today'}.
            Front Desk sees the balance on New Order and ticks <b>Use points</b> to apply it.
          </p>
          {totals && <p className="safi-hint" style={{ marginBottom: 0 }}><b>{totals.bal.toLocaleString('en-KE')} points</b> held by {totals.holders} customer{totals.holders === 1 ? '' : 's'} (KES {totals.kes.toLocaleString('en-KE')} if all used). Add <span className="safi-mono">{'{points}'}</span> to any SMS template to show the customer's balance.</p>}
        </>}
      </div>
    </Card>
  );
}

// ─── Order tracking link (Settings) ───────────────────────────────────────
// The tracking page is a single HTML file. It is generated here with this shop's cloud
// address and public key already in it, so it only needs to be put online once.
function trackPageHtml(url, key) {
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Track your order · Vazi Safi</title>
<style>
:root{--brand:#5C2D91;--accent:#E87722;--ink:#1d1730;--ink2:#5b5670;--line:#e6e2ef;--bg:#f6f4fa;--ok:#1f8a4c}
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;background:var(--bg);color:var(--ink)}
.wrap{max-width:460px;margin:0 auto;padding:20px 16px 40px}
.hd{display:flex;align-items:center;gap:10px;margin-bottom:16px}.logo{width:38px;height:38px;border-radius:50%;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
.hd b{font-size:17px}.hd small{display:block;color:var(--ink2);font-size:12px}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:12px}
h1{font-size:20px;margin:0 0 2px}.sub{color:var(--ink2);font-size:13px;margin:0}
.big{font-size:24px;font-weight:700;color:var(--brand);margin:14px 0 4px}
.steps{list-style:none;margin:14px 0 0;padding:0}.steps li{display:flex;gap:12px;padding:0 0 14px;position:relative;color:var(--ink2)}
.steps li:before{content:"";position:absolute;left:9px;top:20px;bottom:0;width:2px;background:var(--line)}.steps li:last-child:before{display:none}
.dot{width:20px;height:20px;border-radius:50%;border:2px solid var(--line);background:#fff;flex:none;z-index:1}
.done{color:var(--ink)}.done .dot{background:var(--brand);border-color:var(--brand)}.now .dot{background:var(--accent);border-color:var(--accent);box-shadow:0 0 0 4px rgba(232,119,34,.18)}.now{color:var(--ink);font-weight:600}
.t{font-size:12px;color:var(--ink2);font-weight:400}
.row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px}.row b{font-variant-numeric:tabular-nums}
.due{color:#b42318}.paid{color:var(--ok)}
.pay{background:#fff7ef;border-color:#f5d3b3}.btn{display:inline-block;margin-top:10px;padding:10px 14px;border-radius:10px;background:var(--brand);color:#fff;text-decoration:none;font-weight:600;font-size:14px}
.muted{color:var(--ink2);font-size:12px;text-align:center;margin-top:16px}
</style></head><body><div class="wrap">
<div class="hd"><div class="logo">VS</div><div><b id="shop">Vazi Safi Laundry</b><small>Order tracking</small></div></div>
<div id="out"><div class="card"><p class="sub">Loading your order…</p></div></div>
<p class="muted">This page updates by itself every minute.</p>
</div>
<script>
var URL_='${esc(url)}'.replace(/\\/+$/,''), KEY='${esc(key)}';
var q=new URLSearchParams(location.search), code=(q.get('c')||location.hash.slice(1)||'').trim();
var STEPS=[['Received',['intake']],['Washing',['washing','holding']],['Drying',['drying','finalhold']],['Ironing & finishing',['ironing','drycleaning']],['Ready',['ready']],['Collected',['collected']]];
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function when(s){if(!s)return'';var d=new Date(s);if(isNaN(d))return'';return d.toLocaleString('en-KE',{timeZone:'Africa/Nairobi',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
function kes(n){return 'KES '+Math.round(Number(n)||0).toLocaleString('en-KE')}
function show(o){
  var out=document.getElementById('out');out.innerHTML='';
  if(o.shop)document.getElementById('shop').textContent=o.shop;
  var c=el('div','card');c.appendChild(el('h1',null,(o.name?'Hi '+o.name+', ':'')+'order '+o.order));
  c.appendChild(el('p','sub',(o.items?o.items+' item(s) · ':'')+'received '+when(o.received)));
  var idx=0;STEPS.forEach(function(s,i){if(s[1].indexOf(o.status)>=0)idx=i});
  var label=o.status==='drycleaning'?'Dry cleaning':STEPS[idx][0];
  c.appendChild(el('div','big',idx===4?'Ready for collection':idx===5?'Collected · thank you!':label));
  if(o.due&&idx<4)c.appendChild(el('p','sub','Expected ready: '+when(o.due)));
  var ul=el('ul','steps'),st=o.stages||{};
  STEPS.forEach(function(s,i){var li=el('li',i<idx?'done':i===idx?'now':'');li.appendChild(el('span','dot'));var d=el('div',null,i===3&&o.status==='drycleaning'?'Dry cleaning':s[0]);
    var t=i===0?o.received:s[1].map(function(k){return st[k]}).filter(Boolean)[0];if(t&&i<=idx){d.appendChild(el('br'));d.appendChild(el('span','t',when(t)))}li.appendChild(d);ul.appendChild(li)});
  c.appendChild(ul);out.appendChild(c);
  var m=el('div','card');[['Total',kes(o.total)],['Paid',kes(o.paid)]].forEach(function(r){var x=el('div','row');x.appendChild(el('span',null,r[0]));x.appendChild(el('b',null,r[1]));m.appendChild(x)});
  var bx=el('div','row');bx.appendChild(el('span',null,'Balance'));bx.appendChild(el('b',o.balance>0?'due':'paid',o.balance>0?kes(o.balance):'Fully paid'));m.appendChild(bx);out.appendChild(m);
  if(o.balance>0&&o.payTo){var p=el('div','card pay');p.appendChild(el('b',null,'How to pay'));p.appendChild(el('p','sub','Pay '+kes(o.balance)+' ONLY to '+o.payTo+(o.payName?' ('+o.payName+')':'')+'. Use order '+o.order+' as the reference.'));out.appendChild(p)}
  if(o.phone){var h=el('div','card');h.appendChild(el('p','sub','Questions about your order?'));var a=el('a','btn','Call '+o.phone);a.href='tel:'+String(o.phone).replace(/[^0-9+]/g,'');h.appendChild(a);out.appendChild(h)}
}
function fail(msg){document.getElementById('out').innerHTML='';var c=el('div','card');c.appendChild(el('h1',null,'Order not found'));c.appendChild(el('p','sub',msg));document.getElementById('out').appendChild(c)}
function load(){
  if(code.length<10){fail('Open the link from your SMS exactly as it was sent.');return}
  fetch(URL_+'/rest/v1/rpc/track_order',{method:'POST',headers:{'apikey':KEY,'Content-Type':'application/json'},body:JSON.stringify({code:code})})
  .then(function(r){return r.json()}).then(function(o){if(o&&o.order)show(o);else fail('This link has no order. Open the link from your SMS exactly as it was sent.')})
  .catch(function(){fail('Could not reach the shop. Check your internet and try again.')});
}
load();setInterval(load,60000);
</script></body></html>`;
}

function TrackingCard() {
  const D = useStore();
  const st = D.settings || {};
  const [ready, setReady] = useStateX(() => !!(window.SAFI_SYNC && window.SAFI_SYNC.trackingReady && window.SAFI_SYNC.trackingReady()));
  const [checking, setChecking] = useStateX(false);
  const cloud = window.SAFI_CLOUD ? window.SAFI_CLOUD.getConfig() : {};
  const base = window.SAFI_TRACK.base();
  const sample = (D.orders || []).find(o => o.track);
  function download() {
    if (!cloud.url || !cloud.anonKey) { toast('Connect the cloud first (Cloud & Updates)', 'error'); return; }
    const blob = new Blob([trackPageHtml(cloud.url, cloud.anonKey)], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'index.html';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Tracking page saved as index.html', 'success');
  }
  return (
    <Card title="Order tracking link" action={<span className="safi-cell-sub">Customers follow their order on their phone from the SMS link</span>}>
      <div className="safi-form" style={{ maxWidth: 620 }}>
        <div className="safi-store-info">
          <div><span>Cloud ready</span><b>{ready ? 'Yes' : 'Not yet: run supabase/08_tracking_points.sql'}</b></div>
          <div><span>Tracking page</span><b>{base || 'Not set'}</b></div>
        </div>
        {!ready && <div><Button kind="ghost" icon="refresh" disabled={checking} onClick={async () => { setChecking(true); try { setReady(!!(await window.SAFI_SYNC.recheckTracking())); } finally { setChecking(false); } }}>{checking ? 'Checking…' : 'Check again'}</Button></div>}
        <label>Tracking page address
          <input className="safi-input safi-mono" placeholder="https://vazisafi-track.netlify.app" defaultValue={st.trackUrl || ''}
            onBlur={e => window.SAFI_STORE.setSetting('trackUrl', e.target.value.trim())}/>
        </label>
        <label className="safi-toggle">
          <input type="checkbox" checked={st.trackOn !== false} onChange={e => window.SAFI_STORE.setSetting('trackOn', e.target.checked)}/><span/>
          <b>Add the link to SMS and receipts</b>
        </label>
        <ol className="safi-hint" style={{ paddingLeft: 18, margin: '4px 0' }}>
          <li>In Supabase → SQL Editor, run <span className="safi-mono">supabase/08_tracking_points.sql</span> once.</li>
          <li><Button kind="ghost" icon="box" onClick={download}>Download tracking page</Button> (it already holds your cloud address).</li>
          <li>Go to <b>app.netlify.com/drop</b> and drag the downloaded file onto it. Copy the address it gives you into the box above.</li>
        </ol>
        <p className="safi-hint" style={{ marginBottom: 0 }}>
          The link goes wherever an SMS template has <span className="safi-mono">{'{track}'}</span> (the order-received SMS has it already). With no address set, the token is left out.
          The page shows one order only (first name, stage, due time, balance, how to pay) and nothing else from the shop's data. Note: the link makes the received SMS longer than 160 characters, so it goes as 2 SMS.
          {sample && base ? <> Example: <span className="safi-mono">{base}/?c={sample.track}</span></> : null}
        </p>
      </div>
    </Card>
  );
}
Object.assign(window, { LoyaltyPointsCard, TrackingCard });
