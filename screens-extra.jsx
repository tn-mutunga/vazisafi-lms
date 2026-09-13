// Vazi Safi — additional screens
// Period summary (dashboard), Settings, Dispatch (pickup/delivery), Messages (SMS)
const { useState: useStateX, useRef: useRefX, useEffect: useEffectX } = React;

// ─── Period Summary (used on Management Dashboard) ────────────────────────
function PeriodSummary({ money }) {
  const D = useStore();
  const [period, setPeriod] = useStateX('today');

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
  };
  const prev = prevMap[period];

  function sumOrdersPaid(from, to) {
    return D.orders.filter(o => {
      const d = new Date(o.in);
      return d >= from && (!to || d <= to);
    }).reduce((s, o) => s + (o.paid || 0), 0);
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

  const revenue = sumOrdersPaid(cur.from);
  const gross   = sumOrdersGross(cur.from);
  const expense = sumExpenses(cur.from);
  const profit  = revenue - expense;
  const orders  = countOrders(cur.from);

  const prevRev = prev ? sumOrdersPaid(prev.from, prev.to) : 0;
  const prevExp = prev ? sumExpenses(prev.from, prev.to) : 0;
  const revDelta = prevRev ? Math.round(((revenue - prevRev) / prevRev) * 100) : null;
  const expDelta = prevExp ? Math.round(((expense - prevExp) / prevExp) * 100) : null;

  // By category
  const catLabels = { laundry: 'Laundry', drycleaning: 'Dry Cleaning', shoes: 'Shoes', other: 'Other' };
  const catColors = { laundry: 'blue', drycleaning: 'violet', shoes: 'amber', other: 'gray' };
  const byCategory = ['laundry', 'drycleaning', 'shoes', 'other'].map(cat => {
    const total = D.orders.filter(o => new Date(o.in) >= cur.from).reduce((s, o) => {
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
        <div className="safi-seg">
          {[['today', 'Today'], ['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year']].map(([k, lbl]) => (
            <button key={k} className={`safi-seg__btn ${period === k ? 'is-active' : ''}`} onClick={() => setPeriod(k)}>{lbl}</button>
          ))}
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
  const setT = (k, v) => window.__safiSetTweak && window.__safiSetTweak(k, v);
  const D = useStore();
  const [tpl, setTpl] = useStateX({ ...(D.smsTemplates || {}) });

  return (
    <>
      <Topbar title="Settings" subtitle="Receipt details, PIN, and SMS templates — all stored on this laptop."/>

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

      <Card title="Owner PIN" action={<span className="safi-cell-sub">Required to enter Management area</span>}>
        <div className="safi-form" style={{ maxWidth: 320 }}>
          <label>PIN<input className="safi-input safi-mono" defaultValue={shop.ownerPin} onBlur={e => setT('ownerPin', e.target.value)}/></label>
          <p className="safi-hint">Keep it private. Change it any time it has been seen by someone you do not trust.</p>
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

      <Card title="SMS templates" action={<span className="safi-cell-sub">{'Tokens: {name} {id} {balance} {rider} {due}'}</span>}>
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

  const filtered = D.dispatch.filter(d => statusFilter === 'all' || d.status === statusFilter);
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
    setForm({ type: d.type, orderId: d.orderId, customerId: d.customerId, address: d.address, area: d.area, rider: d.rider, slotStart: d.slotStart, slotEnd: d.slotEnd, notes: d.notes });
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
    window.SAFI_STORE.updateDispatch(id, { status });
    toast(`Marked ${status}`);

    // Auto-send SMS when en-route
    if (status === 'en-route' && d) {
      const cust = D.customers.find(c => c.id === d.customerId);
      const rider = D.staff.find(s => s.id === d.rider);
      if (cust && cust.phone) {
        const tpl = (D.smsTemplates || {}).delivery || 'Hi {name}, our rider {rider} is on the way with your order {id}.';
        const order = d.orderId ? D.orders.find(o => o.id === d.orderId) : null;
        const body = tpl
          .replace(/\{name\}/g, cust.name.split(' ')[0])
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
          toast(`Order ${d.orderId} marked Collected`);
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

      <Card pad={false} title={`Dispatch board · ${statusFilter === 'all' ? 'all' : statusFilter}`} action={
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
            { label: 'Order', render: r => r.orderId ? <span className="safi-mono">{r.orderId}</span> : <span className="safi-cell-sub">—</span> },
            { label: 'Customer', render: r => {
              const c = D.customers.find(x => x.id === r.customerId);
              return c ? <div><div className="safi-cell-strong">{c.name}</div><div className="safi-cell-sub">{c.prefix} {c.phone}</div></div> : <span className="safi-cell-sub">Walk-in</span>;
            }},
            { label: 'Address', render: r => <div><div>{r.address}</div>{r.area && <div className="safi-cell-sub">{r.area}</div>}</div> },
            { label: 'Slot', render: r => r.slotStart ? <span className="safi-mono">{r.slotStart} – {r.slotEnd}</span> : <span className="safi-cell-sub">—</span> },
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
              <select className="safi-input" value={form.customerId} onChange={e => setForm({ ...form, customerId: e.target.value })}>
                <option value="">— Select —</option>
                {D.customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.prefix} {c.phone}</option>)}
              </select>
            </label>
          </div>
          <label>Address<input className="safi-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Block & house number, gate / landmark"/></label>
          <label>Area / Estate<input className="safi-input" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} placeholder="Kilimani · Karen · Ngong Rd…"/></label>
          <div className="safi-form__row">
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
function MessagesScreen({ lang }) {
  const D = useStore();
  const [tab, setTab] = useStateX('all');
  const rows = D.messages.filter(m => tab === 'all' || m.stage === tab);

  return (
    <>
      <Topbar
        title="Messages"
        subtitle="Every SMS the system has prepared. Real sending requires an SMS gateway (Africa's Talking) — connect that in the cloud upgrade."
      />

      <div className="safi-grid safi-grid--4">
        <StatCard label="Total messages" value={D.messages.length} icon="sms"/>
        <StatCard label="Ready notifications" value={D.messages.filter(m => m.stage === 'ready').length} icon="check"/>
        <StatCard label="Delivery alerts" value={D.messages.filter(m => m.stage === 'delivery').length} icon="truck"/>
        <StatCard label="Last sent" value={D.messages[0]?.date.slice(11) || '—'} icon="clock"/>
      </div>

      <Card pad={false} title="Message log" action={
        <div className="safi-tabs">
          {['all', 'ready', 'washing', 'ironing', 'collected', 'delivery'].map(x => (
            <button key={x} className={`safi-tabs__btn ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>{x}</button>
          ))}
        </div>
      }>
        <Table
          cols={[
            { label: 'Sent', render: r => <span className="safi-cell-sub">{r.date.slice(5, 16)}</span> },
            { label: 'To', render: r => <div><div className="safi-cell-strong">{r.name}</div><div className="safi-cell-sub safi-mono">{r.to}</div></div> },
            { label: 'Stage', render: r => <span className={`safi-tag safi-tag--blue`}>{r.stage}</span> },
            { label: 'Order', render: r => r.orderId ? <span className="safi-mono">{r.orderId}</span> : <span className="safi-cell-sub">—</span> },
            { label: 'Body', render: r => <div className="safi-msg-body">{r.body}</div> },
            { label: 'Status', render: r => <span className="safi-pill safi-pill--green"><Icon name="check" size={10}/> {r.status}</span> },
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
        right={<Button kind="ghost" icon="alert">{pendingCount} pending</Button>}
      />

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
            { label: 'Requested', render: r => <span className="safi-cell-sub">{r.requestedAt.slice(5, 16)}</span> },
            { label: 'Action', render: r => <b>{actionLabel[r.action] || r.action}</b> },
            { label: 'Order', render: r => (
              <button className="safi-mono safi-rowlink" onClick={() => { setActiveOrderId(r.target); setView('order-detail'); }}>{r.target}</button>
            )},
            { label: 'Requested by', render: r => {
              const s = D.staff.find(x => x.id === r.requestedBy);
              return s ? s.name : <span className="safi-cell-sub">—</span>;
            }},
            { label: 'Reason', render: r => <div className="safi-msg-body">{r.reason}</div> },
            { label: 'Status', render: r => <span className={`safi-pill safi-pill--${r.status === 'approved' ? 'green' : r.status === 'rejected' ? 'red' : 'amber'}`}><span className="safi-pill__dot"/>{r.status}</span> },
            { label: '', render: r => r.status === 'pending'
              ? <button className="safi-rowlink" onClick={() => setDecideOn(r)}>Decide →</button>
              : <span className="safi-cell-sub">{r.decidedAt.slice(5, 16)}</span>
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
                <h4 className="safi-section-h">Current order — {orig.id}</h4>
                <div className="safi-approval-meta">
                  <div><span>Customer</span><b>{cust?.name || 'Walk-in'}</b></div>
                  <div><span>Placed</span><b>{orig.in.slice(5, 16)}</b></div>
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
                          <td>{svc?.name || it.svc}{it.free && <span className="safi-tag safi-tag--green" style={{ marginLeft: 4 }}>FREE</span>}</td>
                          <td>{it.qty} {svc?.unit}</td>
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
                              <td>{svc?.name || it.svc}{it.free && <span className="safi-tag safi-tag--green" style={{ marginLeft: 4 }}>FREE</span>}</td>
                              <td>{it.qty} {svc?.unit}</td>
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
  const D = useStore();
  const [granularity, setGranularity] = useStateX('month'); // 'day' | 'month'

  // Build series from real data
  const points = [];
  const now = new Date();
  if (granularity === 'day') {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });
      const rev = D.orders.filter(o => o.in.startsWith(key)).reduce((s, o) => s + (o.paid || 0), 0);
      const exp = D.expenses.filter(e => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0);
      points.push({ label, rev, exp, profit: rev - exp });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString('en-KE', { month: 'short', year: '2-digit' });
      const rev = D.orders.filter(o => o.in.startsWith(key)).reduce((s, o) => s + (o.paid || 0), 0);
      const exp = D.expenses.filter(e => e.date.startsWith(key)).reduce((s, e) => s + e.amount, 0);
      points.push({ label, rev, exp, profit: rev - exp });
    }
  }

  const max = Math.max(1, ...points.map(p => Math.max(p.rev, p.exp)));
  const totalRev = points.reduce((s, p) => s + p.rev, 0);
  const totalExp = points.reduce((s, p) => s + p.exp, 0);
  const totalProfit = totalRev - totalExp;

  return (
    <Card title={`Revenue vs Expenses · ${granularity === 'day' ? 'last 30 days' : 'last 12 months'}`} action={
      <div className="safi-seg">
        <button className={`safi-seg__btn ${granularity === 'day' ? 'is-active' : ''}`} onClick={() => setGranularity('day')}>Daily</button>
        <button className={`safi-seg__btn ${granularity === 'month' ? 'is-active' : ''}`} onClick={() => setGranularity('month')}>Monthly</button>
      </div>
    }>
      <div className="safi-ts-totals">
        <div className="safi-ts-totals__item safi-ts-totals__item--rev">
          <span className="safi-ts-totals__lbl">Revenue</span>
          <span className="safi-ts-totals__val safi-mono">{money(totalRev)}</span>
        </div>
        <div className="safi-ts-totals__item safi-ts-totals__item--exp">
          <span className="safi-ts-totals__lbl">Expenses</span>
          <span className="safi-ts-totals__val safi-mono">— {money(totalExp)}</span>
        </div>
        <div className="safi-ts-totals__item safi-ts-totals__item--profit">
          <span className="safi-ts-totals__lbl">Net profit</span>
          <span className="safi-ts-totals__val safi-mono">{money(totalProfit)}</span>
        </div>
      </div>

      <div className="safi-ts-chart">
        <div className="safi-ts-bars">
          {points.map((p, i) => (
            <div key={i} className="safi-ts-col" title={`${p.label}: revenue ${money(p.rev)}, expenses ${money(p.exp)}`}>
              <div className="safi-ts-stack">
                <div className="safi-ts-bar safi-ts-bar--rev" style={{ height: `${(p.rev / max) * 100}%` }}/>
                <div className="safi-ts-bar safi-ts-bar--exp" style={{ height: `${(p.exp / max) * 100}%` }}/>
              </div>
              <div className="safi-ts-lbl">{p.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="safi-legend" style={{ marginTop: 10 }}>
        <span><i style={{ background: 'var(--brand)' }}/>Revenue</span>
        <span><i style={{ background: 'var(--amber)' }}/>Expenses</span>
      </div>
    </Card>
  );
}

Object.assign(window, { PeriodSummary, SettingsScreen, DispatchScreen, MessagesScreen, ApprovalsScreen, TimeSeries, renderSmsTemplate });
