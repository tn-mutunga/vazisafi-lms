// Vazi Safi — Front Desk screens (live-data version, backed by SAFI_STORE)
// Weight moves in 0.1 kg; pieces, pairs, bags and hangers in whole numbers.
function qtyStep(svc, q, dir) {
  if (svc?.unit === 'kg') return Math.max(0.1, Math.round(((Number(q) || 0) + dir * 0.1) * 10) / 10);
  return Math.max(1, Math.round(Number(q) || 0) + dir);
}
function qtyClean(svc, raw) {
  const v = Math.max(0, parseFloat(raw) || 0);
  return svc?.unit === 'kg' ? Math.round(v * 10) / 10 : Math.round(v);
}
const { useState: useStateFD, useMemo: useMemoFD, useEffect: useEffectFD, useRef: useRefFD } = React;

// ─── Front Desk Dashboard ─────────────────────────────────────────────────
function FrontDeskDashboard({ setView, setActiveOrderId, lang, money }) {
  const [showRecent, setShowRecent] = useStateFD(false);
  useEffectFD(() => { const h = () => setShowRecent(true); window.addEventListener('safi:recent', h); if (window.__safiOpenRecent) { window.__safiOpenRecent = false; setShowRecent(true); } return () => window.removeEventListener('safi:recent', h); }, []);
  const D = useStore();
  const todayStr = SAFI_TIME.day();
  const todayOrders = D.orders.filter(o => o.in.startsWith(todayStr));
  const revenueToday = todayOrders.reduce((s, o) => s + (o.total || 0), 0);
  // Compared with yesterday (orders taken and their value).
  const yStr = SAFI_TIME.daysAgo(1);
  const yOrders = D.orders.filter(o => String(o.in).startsWith(yStr));
  const ordDiff = todayOrders.length - yOrders.length;
  const revDiff = revenueToday - yOrders.reduce((s, o) => s + (o.total || 0), 0);
  const streamToday = (cat) => todayOrders.reduce((s, o) => { const gross = o.items.reduce((g, it) => g + (it.price || 0), 0) || 1; const part = o.items.reduce((ss, it) => ss + (((D.services.find(x => x.id === it.svc) || {}).category || 'other') === cat ? (it.price || 0) : 0), 0); return s + Math.round(part * (o.total || 0) / gross); }, 0);
  const streams = [['laundry', 'Laundry'], ['drycleaning', 'Dry Cleaning'], ['shoes', 'Shoes'], ['other', 'Other']].map(([k, l]) => ({ k, l, v: streamToday(k) }));
  // Pending collection = every order not yet handed back. Drops as each is collected.
  const readyOrders = D.orders.filter(o => o.status !== 'collected');
  const pending = readyOrders.length;
  const pendingBalance = readyOrders.reduce((s, o) => s + Math.max(0, (o.total || 0) - (o.paid || 0)), 0);
  const todayExpenses = (D.expenses || []).filter(e => String(e.date).startsWith(todayStr));
  const expensesToday = todayExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  // Collected today = orders handed over today (any intake date), valued at their total.
  const collectedOrdersToday = D.orders.filter(o => o.status === 'collected' && String(window.SAFI_STORE.stageTimes(o.id).collected || '').startsWith(todayStr));
  const collectedToday = collectedOrdersToday.reduce((s, o) => s + (o.total || 0), 0);
  const washing = D.orders.filter(o => o.status === 'washing').length;
  const ironing = D.orders.filter(o => o.status === 'ironing').length;

  // Today's intake first, then older work still in the shop.
  const active = D.orders.filter(o => o.status !== 'collected');
  const queue = [...active.filter(o => String(o.in).startsWith(todayStr)), ...active.filter(o => !String(o.in).startsWith(todayStr))];
  const isToday = (o) => String(o.in).startsWith(todayStr);

  const openShift = window.SAFI_STORE.getOpenShift();
  const [shiftModal, setShiftModal] = useStateFD(false);

  return (
    <>
      <Topbar
        title={<>{`${t('today', lang)} · ${new Date().toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long' })}`}<LiveClock/></>}
        subtitle="Karibu Vazi Safi 👋 — here is what's happening at the shop right now."
        right={<>
          <Button kind="ghost" icon="search">Search</Button>
          <Button kind={openShift ? 'ghost' : 'secondary'} icon="clock" onClick={() => setShiftModal(true)}>
            {openShift ? 'Close shift' : 'Open shift'}
          </Button>
          <Button kind="primary" icon="plus" onClick={() => setView('new-order')}>{t('new_order', lang)}</Button>
        </>}
      />

      <ShiftModal open={shiftModal} onClose={() => setShiftModal(false)} money={money}/>

      <BacklogAlert D={D} setView={setView}/>

      <div className="safi-grid safi-grid--4">
        <StatCard label={t('orders_today', lang)} value={todayOrders.length} icon="list" delta={`${D.orders.filter(o => o.status !== 'collected').length} active in the shop`}
          sparkline={<div className="safi-streams">{[['normal', 'Normal'], ['student', 'Student'], ['corporate', 'Corporate']].map(([k, l]) => <span key={k} className={`safi-streams__i safi-streams__i--tier-${k}`}><i/>{l} <b className="safi-mono">{todayOrders.filter(o => ((D.customers.find(c => c.id === o.customer) || {}).group || 'normal') === k).length}</b></span>)}</div>}/>
        <StatCard label={t('revenue_today', lang)} value={money(revenueToday)} icon="wallet" deltaKind="none" delta={<><span className={ordDiff < 0 ? 'safi-delta-dn' : 'safi-delta-up'}>{ordDiff < 0 ? '↓' : '↑'} {ordDiff > 0 ? '+' : ordDiff < 0 ? '−' : '±'}{Math.abs(ordDiff)} orders</span>{' · '}<span className={revDiff < 0 ? 'safi-delta-dn' : 'safi-delta-up'}>{revDiff < 0 ? '↓' : '↑'} {revDiff > 0 ? '+' : revDiff < 0 ? '−' : '±'}{money(Math.abs(revDiff))}</span><span className="safi-cell-sub"> vs yesterday</span></>}
          sparkline={<div className="safi-streams">{streams.map(x => <span key={x.k} className={`safi-streams__i safi-streams__i--${x.k}`}><i/>{x.l} <b className="safi-mono">{money(x.v)}</b></span>)}</div>}/>
        <StatCard label={t('pending_collection', lang)} value={pending} icon="package" delta={`${money(pendingBalance)} to collect · ${D.orders.filter(o => o.status === 'ready').length} orders ready now`}/>
        <StatCard label="Washing → Drying → Ready → Collected" value={<span className="safi-stagecount"><span className="is-w">W-{washing}</span> → {D.orders.some(o => o.status === 'holding') && <><span className="is-h">H-{D.orders.filter(o => o.status === 'holding').length}</span> → </>}<span className="is-d">D-{D.orders.filter(o => o.status === 'drying').length}</span> → {D.orders.some(o => o.status === 'finalhold') && <><span className="is-fh">FH-{D.orders.filter(o => o.status === 'finalhold').length}</span> → </>}<span className="is-r">R-{D.orders.filter(o => o.status === 'ready').length}</span> → <span className="is-c">C-{collectedOrdersToday.length}</span></span>} icon="wash" delta="Today's Orders Stats"/>
      </div>


      <div className="safi-grid safi-grid--2-1">
        <Card title={t('todays_queue', lang)} action={<Button kind="ghost" size="sm" onClick={() => setView('orders')}>View all →</Button>}>
          <div className="safi-queue-scroll"><Table
            cols={[
              { label: '#', render: r => <span className="safi-mono">{orderNo(r.id)}</span> },
              { label: 'Customer', render: r => {
                const c = D.customers.find(x => x.id === r.customer);
                return <div><div className="safi-cell-strong">{c?.name || orderNo(r.id)}{isToday(r) ? <span className="safi-today-pill">Today</span> : <span className="safi-cell-sub" style={{ marginLeft: 6 }}>{String(r.in).slice(8, 10)}-{String(r.in).slice(5, 7)}</span>}</div><div className="safi-cell-sub">{c?.phone || ''}</div></div>;
              }},
              { label: 'Items', render: r => <span className="safi-cell-sub">{r.items.length} {r.items.length === 1 ? 'item' : 'items'}</span> },
              { label: 'Total', render: r => <span className="safi-mono">{money(r.total)}</span> },
              { label: 'Payment', render: r => <PayBadge paid={r.paid} total={r.total}/> },
              { label: 'Status', render: r => <StageTrail order={r}/> },
              { label: '', render: r => <button className="safi-rowlink" onClick={(e) => { e.stopPropagation(); setActiveOrderId(r.id); setView('order-detail'); }}>Open →</button> },
            ]}
            rows={queue}
            rowClass={r => isToday(r) ? 'is-today' : 'is-earlier'}
            onRow={(r) => { setActiveOrderId(r.id); setView('order-detail'); }}
            empty="No active orders. Tap New Order to start one."
          /></div>
        </Card>

        <div className="safi-stack">
          <button className="safi-recent-open" onClick={() => setShowRecent(true)}>
            <span className="safi-recent-open__ico"><Icon name="clock" size={18}/></span>
            <span className="safi-recent-open__txt"><b>{t('recent_orders', lang)}</b></span>
            <span className="safi-recent-open__go">View ›</span>
          </button>
          <Modal open={showRecent} onClose={() => setShowRecent(false)} title={`${t('recent_orders', lang)} · last ${Math.min(50, D.orders.length)}`} width={1100}
            footer={<><Button kind="ghost" onClick={() => setShowRecent(false)}>Close</Button><Button kind="primary" onClick={() => { setShowRecent(false); setView('orders'); }}>All orders →</Button></>}>
            <div className="safi-recent-list is-open safi-recent-list--wide safi-recent-list--scroll">
              {[...D.orders].sort((a, b) => String(b.in).localeCompare(String(a.in))).slice(0, 50).map(o => {
                const c = D.customers.find(x => x.id === o.customer);
                return (
                  <button key={o.id} className="safi-recent-row" onClick={() => { setShowRecent(false); setActiveOrderId(o.id); setView('order-detail'); }}>
                    <span className="safi-recent-row__top"><span className="safi-mono">{orderNo(o.id)}</span><StatusBadge status={o.status} mark={collectMark(o)}/></span>
                    <span className="safi-recent-row__name">{c?.name || orderNo(o.id)}</span>
                    <span className="safi-recent-row__meta"><span className="safi-cell-sub">{String(o.in).slice(8, 10)}-{String(o.in).slice(5, 7)} {String(o.in).slice(11, 16)} · {o.items.length} {o.items.length === 1 ? 'item' : 'items'}</span><b className="safi-mono">{money(o.total)}</b></span>
                  </button>
                );
              })}
              {D.orders.length === 0 && <p className="safi-cell-sub">No orders yet.</p>}
            </div>
          </Modal>
          {window.ServiceClientsToday && <window.ServiceClientsToday/>}
          <Card title={t('quick_actions', lang)}>
            <div className="safi-quick">
              <button className="safi-quick__btn" onClick={() => setView('new-order')}>
                <span className="safi-quick__ico safi-quick__ico--brand"><Icon name="plus" size={20}/></span>
                <span className="safi-quick__lbl">New Order</span>
                <span className="safi-quick__sub">Tag a fresh intake</span>
              </button>
              <button className="safi-quick__btn" onClick={() => setView('payments')}>
                <span className="safi-quick__ico safi-quick__ico--green"><Icon name="mpesa" size={20}/></span>
                <span className="safi-quick__lbl">Record Payment</span>
                <span className="safi-quick__sub">Enter M-Pesa / bank code</span>
              </button>
              <button className="safi-quick__btn" onClick={() => setView('customers')}>
                <span className="safi-quick__ico safi-quick__ico--violet"><Icon name="users" size={20}/></span>
                <span className="safi-quick__lbl">Customers</span>
                <span className="safi-quick__sub">Lookup & history</span>
              </button>
              <button className="safi-quick__btn" onClick={() => setView('issues')}>
                <span className="safi-quick__ico safi-quick__ico--amber"><Icon name="alert" size={20}/></span>
                <span className="safi-quick__lbl">Raise Issue</span>
                <span className="safi-quick__sub">Log a problem</span>
              </button>
            </div>
          </Card>



        </div>
      </div>


      <CollectionReminders D={D} money={money} setView={setView} collectedOrdersToday={collectedOrdersToday} collectedToday={collectedToday}/>



      <OverdueCard D={D} setView={setView} setActiveOrderId={setActiveOrderId} money={money}/>
    </>
  );
}

// ─── Collection reminders (Front Desk dashboard, top row) ─────────────────
// Nudges the attendant to hand over ready laundry, collect the balance and mark it Collected.
function CollectionReminders({ D, money, setView, collectedOrdersToday, collectedToday }) {
  React.useEffect(() => {
    if (window.__safiScrollTo !== 'reminders') return;
    window.__safiScrollTo = null;
    setTimeout(() => { const el = document.getElementById('safi-reminders-deck'); const box = document.querySelector('.safi-main'); if (el) { const top = el.getBoundingClientRect().top - 16; if (box && box.scrollHeight > box.clientHeight) box.scrollBy({ top, behavior: 'smooth' }); else window.scrollBy({ top, behavior: 'smooth' }); } }, 120);
  }, []);
  const now = Date.now();
  const parse = (s) => new Date(String(s || '').replace(' ', 'T')).getTime();
  const open = D.orders.filter(o => o.status !== 'collected');
  const bal = (o) => Math.max(0, (o.total || 0) - (o.paid || 0));
  const old24 = open.filter(o => now - parse(o.in) >= 24 * 3600e3);
  const ready = open.filter(o => o.status === 'ready');
  const readyPaid = ready.filter(o => bal(o) === 0);
  const readyUnpaid = ready.filter(o => bal(o) > 0);
  const today = SAFI_TIME.day();
  const dueToday = (D.dispatch || []).filter(d => d.status !== 'completed' && String(d.slotDate || '').startsWith(today));
  const pickups = dueToday.filter(d => d.type === 'pickup');
  const drops = dueToday.filter(d => d.type !== 'pickup');
  const sum = (arr) => arr.reduce((s, o) => s + bal(o), 0);
  const tiles = [
    { k: 'done', ico: 'income', label: 'Delivered / Collected today', n: collectedOrdersToday.length, sub: money(collectedToday), go: 'payments', preset: { kind: 'collectedToday', ids: collectedOrdersToday.map(o => o.id), label: 'Payments for orders delivered / collected today' }, good: true },
    { k: 'paid', ico: 'package', label: 'Ready & paid · hand over', n: readyPaid.length, sub: 'Mark Collected when it leaves', go: 'orders', preset: { kind: 'readyPaid', label: 'Ready & paid · hand over' } },
    { k: 'old', ico: 'clock', label: '24 hrs+ old orders · not delivered/collected', n: old24.length, sub: `${money(sum(old24))} unpaid`, go: 'orders', preset: { kind: 'old24', label: '24 hrs+ old · not delivered/collected' } },
    { k: 'unpaid', ico: 'wallet', label: 'Ready · balance due', n: readyUnpaid.length, sub: `${money(sum(readyUnpaid))} to collect`, go: 'orders', preset: { kind: 'readyDue', label: 'Ready · balance due' } },
    { k: 'pick', ico: 'phone', label: 'Pick-ups due today', n: pickups.length, sub: pickups.length ? 'Not yet collected from client' : 'None scheduled', go: 'dispatch' },
    { k: 'drop', ico: 'truck', label: 'Deliveries due today', n: drops.length, sub: drops.length ? 'Not yet completed' : 'None scheduled', go: 'dispatch' },
  ];
  return (
    <div className="safi-remind-wrap" id="safi-reminders-deck">
    <h3 className="safi-remind-title">Reminders deck</h3>
    <div className="safi-remind">
      {tiles.map(x => (
        <button key={x.k} className={`safi-remind__t safi-remind__t--${x.k}${!x.good && x.n > 0 ? ' is-hot' : ''}`} onClick={() => { window.__safiPreset = x.preset || null; window.__safiFromDeck = true; setView(x.go); }} title="Open">
          <span className="safi-remind__ico"><Icon name={x.ico} size={16}/></span>
          <span className="safi-remind__lbl">{x.label}</span>
          <b className="safi-remind__n">{x.n}</b>
          <span className="safi-remind__sub">{x.sub}</span>
        </button>
      ))}
    </div>
    </div>
  );
}

// ─── New Order screen ─────────────────────────────────────────────────────
function NewOrder({ setView, setActiveOrderId, lang, money }) {
  const D = useStore();
  const [customerId, setCustomerId] = useStateFD('');
  const [group, setGroup] = useStateFD('normal');
  const [items, setItems] = useStateFD([]);
  const [discountPct, setDiscountPct] = useStateFD(0);
  const [codeId, setCodeId] = useStateFD('');
  const [deposit, setDeposit] = useStateFD(0);
  const [method, setMethod] = useStateFD('mpesa');
  const [txn, setTxn] = useStateFD('');
  const [notes, setNotes] = useStateFD('');
  const [tag, setTag] = useStateFD('');
  const [search, setSearch] = useStateFD('');
  const [walkIn, setWalkIn] = useStateFD(false);
  const [showAdd, setShowAdd] = useStateFD(false);
  const [subtypePicker, setSubtypePicker] = useStateFD(null);
  const [otherForm, setOtherForm] = useStateFD(null);
  const [delForm, setDelForm] = useStateFD(null);

  const [showPreview, setShowPreview] = useStateFD(false);

  const customer = D.customers.find(c => c.id === customerId);
  const effGroup = customer ? customer.group : group;
  const isFirstTime = customer && customer.orders === 0;
  const freeBagEnabled = D.settings?.firstTimeBagFree;

  useEffectFD(() => { if (customer) setGroup(customer.group); }, [customerId]);

  const P = window.SAFI_PRICING;
  // Laundry Express = 50% of the laundry lines (wash/dry/fold, duvets…); dry cleaning, shoes excluded.
  const expressBase = items.reduce((s, it) => {
    if (it.svc === 'express') return s;
    const sv = D.services.find(x => x.id === it.svc);
    return sv && sv.category === 'laundry' ? s + P.line(sv, it.qty, effGroup, it.customPrice) : s;
  }, 0);
  const expressPct = Number((D.settings && D.settings.expressPct) ?? 50);
  // Keep Express priced at expressPct% of the laundry lines, and always as the last line.
  useEffectFD(() => {
    const i = items.findIndex(it => it.svc === 'express');
    if (i < 0) return;
    const want = Math.round(expressBase * expressPct / 100);
    const last = i === items.length - 1;
    if (items[i].customPrice !== want || items[i].qty !== 1 || !last) {
      const ex = { ...items[i], qty: 1, customPrice: want, note: `${expressPct}% of laundry value` };
      setItems([...items.filter((_, j) => j !== i), ex]);
    }
  }, [expressBase, items, expressPct]);
  const subtotal = items.reduce((s, it) => {
    const svc = D.services.find(x => x.id === it.svc);
    return s + P.line(svc, it.qty, effGroup, it.customPrice);
  }, 0);
  const code = (D.discounts || []).find(x => x.id === codeId && x.active !== false);
  const flatOff = code && code.type === 'flat' ? Number(code.value) || 0 : 0;
  const discount = Math.min(subtotal, Math.round(subtotal * (discountPct / 100)) + flatOff);
  const total = Math.max(0, subtotal - discount);
  const balance = total;

  const filteredCust = D.customers
    .filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()) || String(c.phone || '').includes(search))
    .sort((a, b) => {
      // Most frequent clients first (by number of orders), then most recent, then A–Z.
      const n = (c) => D.orders.filter(o => o.customer === c.id).length || c.orders || 0;
      const last = (c) => D.orders.filter(o => o.customer === c.id).reduce((m, o) => (o.in > m ? o.in : m), '');
      return (n(b) - n(a)) || last(b).localeCompare(last(a)) || (a.name || '').localeCompare(b.name || '', 'en', { sensitivity: 'base' });
    });
  // The customer picked for this order stays first until the order is saved.
  { const k = filteredCust.findIndex(c => c.id === customerId); if (k > 0) filteredCust.unshift(filteredCust.splice(k, 1)[0]); }

  function handleSave(thenPrint) {
    if (!customerId) { toast('Pick a customer or add a new one first', 'error'); return; }
    { const cu = D.customers.find(c => c.id === customerId); if (!cu || String(cu.phone || '').replace(/\D/g, '').length < 9) { toast('This customer has no phone number. Add it (Customers → Edit) before saving the order.', 'error'); return; } }
    if (items.length === 0 || subtotal <= 0) {
      toast('Add at least one priced service', 'error');
      return;
    }
    if (D.settings?.requireTag && !String(tag).trim()) {
      toast('Enter the tag number from the tag book', 'error');
      return;
    }
    const linePriced = items.map(it => {
      const svc = D.services.find(s => s.id === it.svc);
      return { svc: it.svc, subtype: it.subtype || '', qty: it.qty, price: P.line(svc, it.qty, effGroup, it.customPrice), ...(it.unit ? { unit: it.unit } : {}) };
    });
    const order = window.SAFI_STORE.createOrder({
      customerId, items: linePriced, total, discount, discountPct, discountCode: code ? code.code : '',
      paid: 0, method: '—', txn: '',
      notes, tag: String(tag).trim(),
    });

    if (code) window.SAFI_STORE.useDiscount(code.id);
    // The customer's copy. This is the control that matters: once they hold a text
    // naming the order and the number to pay, the order cannot quietly not exist.
    if (customer && customer.phone) {
      const st = D.settings || {};
      const tpl = (D.smsTemplates || {}).intake
        || 'Vazi Safi: order {id} received, {items} item(s), total {total}. Tag {tag}. Pay ONLY to {payto}. Queries {owner}.';
      const body = tpl
        .replace(/\{name\}/g, firstName(customer.name))
        .replace(/\{id\}/g, orderNo(order.id))
        .replace(/\{tag\}/g, order.tag || '—')
        .replace(/\{items\}/g, String(items.reduce((n, it) => n + (it.qty || 0), 0)))
        .replace(/\{total\}/g, money(total))
        .replace(/\{payto\}/g, st.payTo || 'the shop till')
        .replace(/\{owner\}/g, st.ownerPhone || '');
      window.SAFI_STORE.logMessage({
        to: `${customer.prefix || ''} ${customer.phone}`.trim(),
        name: customer.name, body, orderId: order.id, stage: 'intake', method: 'sms',
      });
    }

    toast(`Order ${orderNo(order.id)} created`, 'success');
    setActiveOrderId(order.id);
    setView(thenPrint ? 'receipt' : 'order-detail');
  }

  return (
    <>
      <Topbar
        title={t('new_order', lang)}
        subtitle="Tag items, calculate, collect payment, print receipt."
        right={<>
          <Button kind="ghost" onClick={() => setView('dashboard')}>{t('cancel', lang)}</Button>
          <Button kind="ghost" icon="search" onClick={() => setShowPreview(true)}>Preview</Button>
          <Button kind="secondary" icon="check" onClick={() => handleSave(false)}>{t('save', lang)}</Button>
          <Button kind="primary" icon="print" onClick={() => handleSave(true)}>{t('save_and_print', lang)}</Button>
        </>}
      />

      {isFirstTime && (
        <div className="safi-first-banner safi-first-banner--flash">
          <div className="safi-first-banner__icon"><Icon name="bag" size={28}/></div>
          <div className="safi-first-banner__body">
            <b>🎁 FIRST-TIME CUSTOMER · {customer.name}</b>
            <p>
              {freeBagEnabled
                ? 'A complimentary laundry bag will be auto-added to this order. Mention the welcome gift when handing over.'
                : 'New to Vazi Safi! Greet warmly and explain how the process works.'}
            </p>
          </div>
          <div className="safi-first-banner__pill">NEW</div>
        </div>
      )}

      <div className="safi-grid safi-grid--2-1">
        <div className="safi-stack">
          <Card title="1 · Customer">
            <div className="safi-cust-pick">
              <div className="safi-cust-pick__search">
                <Icon name="search" size={16}/>
                <input placeholder="Search by name or phone…" value={search} onChange={e => { setSearch(e.target.value); setWalkIn(false); }}/>
                <button className="safi-cust-pick__walk" onClick={() => setShowAdd(true)}>+ New customer</button>
              </div>
              <div className="safi-cust-pick__list">
                {!walkIn && filteredCust.slice(0, 8).map(c => (
                  <button key={c.id} className={`safi-cust-pick__item ${customerId === c.id ? 'is-active' : ''}`} onClick={() => { setCustomerId(c.id); setWalkIn(false); }}>
                    <span className="safi-cust-pick__avatar">{c.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
                    <span className="safi-cust-pick__name">
                      <b>{c.name}</b>
                      <span>{c.phone}</span>
                    </span>
                    <GroupBadge group={c.group}/>
                  </button>
                ))}
                {!walkIn && filteredCust.length === 0 && <div className="safi-cell-sub" style={{ padding: 12 }}>No match. Tap + New customer.</div>}
                {walkIn && <div className="safi-cell-sub" style={{ padding: 12 }}>Walk-in selected. No customer record will be saved. <button className="safi-rowlink" onClick={() => setWalkIn(false)}>Pick a customer instead</button></div>}
              </div>
              {!customerId && walkIn && (
                <div className="safi-walkin">
                  <label>Walk-in customer · pricing tier</label>
                  <div className="safi-seg">
                    {['student', 'normal', 'corporate'].map(g => (
                      <button key={g} className={`safi-seg__btn ${group === g ? 'is-active' : ''}`} onClick={() => setGroup(g)}>{t(g, lang)}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card title="2 · Items & services" action={<button className="safi-rowlink" onClick={() => setItems([...items, { svc: D.services[0]?.id, qty: 1 }])}>+ Add line</button>}>
            <div className="safi-svc-grid">
              {D.services.map(s => (
                <button key={s.id} className="safi-svc-tile" onClick={() => {
                  if (s.id === 'express') {
                    if (items.some(it => it.svc === 'express')) { toast('Express is already on this order'); return; }
                    setItems([...items, { svc: 'express', qty: 1, customPrice: Math.round(expressBase * expressPct / 100), note: `${expressPct}% of laundry value` }]);
                  } else if (s.id === 'other') {
                    setOtherForm({ desc: '', unit: 'piece', qty: 1, price: '' });
                  } else if (s.id === 'delivery') {
                    if (items.some(it => it.svc === 'delivery')) { toast('Pickup / Delivery is already on this order'); return; }
                    setDelForm({ kind: 'Pickup', price: '' });
                  } else if (s.subtypes && s.subtypes.length) {
                    setSubtypePicker({ svc: s });
                  } else {
                    setItems([...items, { svc: s.id, qty: 1 }]);
                  }
                }}>
                  <span className="safi-svc-tile__ico"><Icon name={s.id === 'wash-piece' ? 'washpiece' : s.icon} size={20}/></span>
                  <span className="safi-svc-tile__lbl">{s.id === 'wash-piece' ? 'Wash & Fold (per piece)' : (s.tileName || s.name)}</span>
                  <span className="safi-svc-tile__price">{s.id === 'other' ? 'Any item · kg or pieces' : s.id === 'delivery' ? 'Price set by attendant' : s.id === 'express' ? `${expressPct}% of order value` : s.tellerPrice ? 'Price set by attendant' : P.ruleFor(s, effGroup) ? P.describe(P.ruleFor(s, effGroup)) : <>{money(s.tiers[effGroup])} / {s.unit}</>}</span>
                  {s.subtypes && s.subtypes.length > 0 && <span className="safi-svc-tile__sub">Pick from {s.subtypes.length} types →</span>}
                </button>
              ))}
            </div>

            <div className="safi-items">
              {items.length === 0 ? (
                <p className="safi-cell-sub" style={{ margin: 0, padding: '18px 4px', textAlign: 'center' }}>No items yet. Tap a service above to add it.</p>
              ) : (
              <div className="safi-items__hd">
                <span>Service / Type</span><span>Qty</span><span>Unit price</span><span>Line total</span><span></span>
              </div>
              )}
              {items.map((it, i) => {
                const svc = D.services.find(x => x.id === it.svc);
                const isOther = it.svc === 'other';
                const isTrip = it.svc === 'delivery';
                const qsvc = it.unit ? { unit: it.unit } : svc;
                const unit = it.customPrice ?? (svc?.tiers[effGroup] || 0);
                const rule = it.customPrice == null ? P.ruleFor(svc, effGroup) : null;
                const upd = patch => { const n = [...items]; n[i] = { ...n[i], ...patch }; setItems(n); };
                return (
                  <div key={i} className="safi-items__row">
                    <div className="safi-items__svc">
                      <select value={it.svc} onChange={e => {
                        const next = [...items];
                        const newSvc = D.services.find(s => s.id === e.target.value);
                        next[i] = e.target.value === 'other'
                          ? { ...next[i], svc: 'other', subtype: '', unit: 'piece', customPrice: next[i].customPrice ?? 0 }
                          : { svc: e.target.value, qty: next[i].qty, subtype: newSvc?.subtypes?.[0] || '' };
                        setItems(next);
                      }}>
                        {D.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      {isOther && (
                        <div className="safi-other-inline">
                          <input className="safi-items__subtype" placeholder="What is it? e.g. Wedding dress" value={it.subtype || ''} onChange={e => upd({ subtype: e.target.value })}/>
                          <select className="safi-items__subtype" value={it.unit || 'piece'} onChange={e => upd({ unit: e.target.value, qty: e.target.value === 'kg' ? it.qty : Math.max(1, Math.round(it.qty || 1)) })}>
                            <option value="piece">Pieces</option><option value="kg">Kg</option>
                          </select>
                        </div>
                      )}
                      {isTrip && (
                        <select className="safi-items__subtype" value={it.subtype || 'Pickup'} onChange={e => upd({ subtype: e.target.value })}>
                          {['Pickup', 'Delivery', 'Pickup & delivery'].map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      )}
                      {!isOther && !isTrip && svc?.subtypes && svc.subtypes.length > 0 && (
                        <select className="safi-items__subtype" value={it.subtype || ''} onChange={e => {
                          const next = [...items]; next[i] = { ...next[i], subtype: e.target.value }; setItems(next);
                        }}>
                          {svc.subtypes.map(st => {
                            const name = typeof st === 'string' ? st : st.name;
                            return <option key={name} value={name}>{name}</option>;
                          })}
                        </select>
                      )}
                    </div>
                    {isTrip ? <span className="safi-cell-sub">1 trip</span> : <div className="safi-qty">
                      <button onClick={() => { const n = [...items]; n[i].qty = qtyStep(qsvc, n[i].qty, -1); setItems(n); }}>−</button>
                      <input type="number" step={qsvc?.unit === 'kg' ? '0.1' : '1'} min="0" value={it.qty} onChange={e => { const n = [...items]; n[i].qty = qtyClean(qsvc, e.target.value); setItems(n); }}/>
                      <span className="safi-qty__unit">{qsvc?.unit}</span>
                      <button onClick={() => { const n = [...items]; n[i].qty = qtyStep(qsvc, n[i].qty, 1); setItems(n); }}>+</button>
                    </div>}
                    {isOther || isTrip
                      ? <input type="number" min="0" className="safi-input safi-mono safi-other-price" placeholder={isTrip ? 'KES charge' : `KES / ${it.unit || 'piece'}`} value={it.customPrice ?? ''} onChange={e => upd({ customPrice: e.target.value === '' ? 0 : Math.max(0, +e.target.value || 0) })}/>
                      : <span className={rule ? 'safi-cell-sub' : 'safi-mono'}>{rule ? P.describe(rule) : money(unit)}</span>}
                    <span className="safi-mono safi-cell-strong">{money(P.line(svc, it.qty, effGroup, it.customPrice))}</span>
                    <button className="safi-items__del" onClick={() => setItems(items.filter((_, j) => j !== i))}>×</button>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="3 · Notes & special instructions">
            <textarea className="safi-textarea" placeholder="e.g. Separate whites, gentle cycle, fragrance-free…" value={notes} onChange={e => setNotes(e.target.value)}/>
            {customer && (
              <div className="safi-residence-row">
                <label>Residence <span className="safi-cell-sub">(optional · saved to customer)</span>
                  <input className="safi-input" defaultValue={customer.location || ''}
                    onBlur={e => {
                      const v = e.target.value.trim();
                      if (v !== (customer.location || '')) {
                        window.SAFI_STORE.updateCustomer(customer.id, { location: v });
                        toast('Residence updated');
                      }
                    }}
                    placeholder="e.g. Karen · Kilimani · Westgate Apt 3B"/>
                </label>
              </div>
            )}
          </Card>
        </div>

        <div className="safi-stack safi-summary-rail">
          <Card title="Summary" className="safi-sticky">
            <div className="safi-sum">
              <div className="safi-sum__row"><span>{t('subtotal', lang)}</span><span className="safi-mono">{money(subtotal)}</span></div>
              <div className="safi-sum__row">
                <span>{t('discount', lang)}</span>
                <div className="safi-inline-input">
                  {(D.discounts || []).some(x => x.active !== false) && (
                    <select className="safi-input safi-input--code" value={codeId} title="Discount code" onChange={e => { const c = (D.discounts || []).find(x => x.id === e.target.value); setCodeId(e.target.value); setDiscountPct(c && c.type === 'pct' ? Number(c.value) || 0 : 0); }}>
                      <option value="">No code</option>
                      {(D.discounts || []).filter(x => x.active !== false).map(x => <option key={x.id} value={x.id}>{x.code} ({x.type === 'pct' ? x.value + '%' : 'KES ' + x.value})</option>)}
                    </select>
                  )}
                  <input type="number" min="0" max="100" value={discountPct} onChange={e => { setCodeId(''); setDiscountPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))); }}/>
                  <span className="safi-pct">%</span>
                  <span className="safi-cell-sub safi-mono" style={{ marginLeft: 6 }}>— {money(discount)}</span>
                </div>
              </div>
              <div className="safi-sum__row safi-sum__row--total"><span>{t('total', lang)}</span><span className="safi-mono">{money(total)}</span></div>

              <div className="safi-sum__divider"/>

              <div className="safi-sum__divider"/>

              <div className="safi-tagentry">
                <label>Tag number{D.settings?.requireTag ? <span className="safi-req">required</span> : <span className="safi-cell-sub" style={{ marginLeft: 6, fontWeight: 400 }}>optional</span>}</label>
                <input className="safi-input safi-mono" value={tag} inputMode="numeric"
                  placeholder="e.g. 10482" onChange={e => setTag(e.target.value.replace(/[^\d-]/g, ''))}/>
                <span className="safi-hint">Read it off the tag you pinned to the bundle.</span>
              </div>

              <div className="safi-callout" style={{ marginBottom: 4 }}>
                <Icon name="wallet" size={14}/>
                <span>Payment is captured later via <b>Collect balance</b> on the order detail (with M-Pesa / Bank code).</span>
              </div>

              {(D.settings?.payTo || '') && (
                <div className="safi-callout safi-callout--lock">
                  <Icon name="lock" size={14}/>
                  <span>M-Pesa goes to <b className="safi-mono">{D.settings.payTo}</b>{D.settings.payToName ? ` (${D.settings.payToName})` : ''} only.</span>
                </div>
              )}

              <div className="safi-sum__divider"/>
              <div className="safi-sum__row safi-sum__row--balance"><span>{t('balance', lang)}</span><span className="safi-mono">{money(balance)}</span></div>

              <div className="safi-sum__actions">
                <Button kind="ghost" full icon="search" onClick={() => setShowPreview(true)}>Preview</Button>
                <Button kind="secondary" full icon="check" onClick={() => handleSave(false)}>{t('save', lang)}</Button>
                <Button kind="primary" full icon="print" onClick={() => handleSave(true)}>{t('save_and_print', lang)}</Button>
              </div>
            </div>
          </Card>

          {customer && (
            <Card title="Customer history">
              <div className="safi-mini-cust">
                <div className="safi-mini-cust__row"><span>Total orders</span><b>{customer.orders}</b></div>
                <div className="safi-mini-cust__row"><span>Lifetime spend</span><b className="safi-mono">{money(customer.spend)}</b></div>
                <div className="safi-mini-cust__row"><span>Loyalty</span><b>{customer.loyalty} / 10</b></div>
                <div className="safi-mini-cust__loy"><div style={{ width: `${customer.loyalty * 10}%` }}/></div>
                {customer.loyalty >= 9 && <div className="safi-mini-cust__bonus">🎉 Next order: KES 500 off!</div>}
              </div>
            </Card>
          )}
        </div>
      </div>

      <AddCustomerModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={(c) => { setCustomerId(c.id); setShowAdd(false); }}/>

      <Modal open={showPreview} onClose={() => setShowPreview(false)} title="Receipt preview" width={420}
        footer={<>
          <Button kind="ghost" onClick={() => setShowPreview(false)}>Close</Button>
          <Button kind="secondary" icon="check" onClick={() => { setShowPreview(false); handleSave(false); }}>Save</Button>
          <Button kind="primary" icon="print" onClick={() => { setShowPreview(false); handleSave(true); }}>Save & print</Button>
        </>}>
        <NewOrderPreview
          items={(() => {
            const bag = D.settings?.freeBagServiceId || 'laundry-bag';
            const hasLaundry = items.some(it => D.services.find(s => s.id === it.svc)?.category === 'laundry');
            return isFirstTime && freeBagEnabled && hasLaundry && !items.some(i => i.svc === bag && i.free)
              ? [...items, { svc: bag, qty: 1, free: true, subtype: 'Free welcome bag', customPrice: 0 }]
              : items;
          })()} subtotal={subtotal} discount={discount} discountPct={discountPct}
          total={total} deposit={deposit} balance={balance}
          method={method} txn={txn} notes={notes}
          customer={customer} effGroup={effGroup}
          services={D.services} money={money}/>
      </Modal>

      <Modal open={!!delForm} onClose={() => setDelForm(null)} title="Pickup / Delivery" width={420}
        footer={<>
          <Button kind="ghost" onClick={() => setDelForm(null)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={() => {
            const p = Math.round(+delForm.price);
            if (!(p >= 0) || delForm.price === '') { toast('Enter the charge (0 if free)', 'error'); return; }
            setItems([...items, { svc: 'delivery', subtype: delForm.kind, unit: 'trip', qty: 1, customPrice: p }]);
            setDelForm(null);
          }}>Add to order</Button>
        </>}>
        {delForm && <div className="safi-form">
          <div className="safi-seg">
            {['Pickup', 'Delivery', 'Pickup & delivery'].map(k => <button key={k} className={`safi-seg__btn ${delForm.kind === k ? 'is-active' : ''}`} onClick={() => setDelForm({ ...delForm, kind: k })}>{k}</button>)}
          </div>
          <label>Charge (KES) — set by attendant<input type="number" min="0" autoFocus className="safi-input safi-mono" placeholder="e.g. 400" value={delForm.price} onChange={e => setDelForm({ ...delForm, price: e.target.value })}/></label>
          <p className="safi-hint">Depends on distance. Enter 0 if the trip is free.</p>
        </div>}
      </Modal>

      <Modal open={!!otherForm} onClose={() => setOtherForm(null)} title="Other item or service" width={460}
        footer={<>
          <Button kind="ghost" onClick={() => setOtherForm(null)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={() => {
            const o = otherForm;
            if (!o.desc.trim()) { toast('Say what the item is', 'error'); return; }
            if (!(+o.price > 0)) { toast('Enter a price', 'error'); return; }
            if (!(+o.qty > 0)) { toast('Enter a quantity', 'error'); return; }
            setItems([...items, { svc: 'other', subtype: o.desc.trim(), unit: o.unit, qty: qtyClean({ unit: o.unit }, o.qty), customPrice: +o.price }]);
            setOtherForm(null);
          }}>Add to order</Button>
        </>}>
        {otherForm && (() => {
          const o = otherForm, set = p => setOtherForm({ ...o, ...p });
          const total = Math.round((+o.qty || 0) * (+o.price || 0));
          return (
            <div className="safi-form">
              <label>What is it?<input className="safi-input" autoFocus placeholder="e.g. Wedding dress, apron, carpet" value={o.desc} onChange={e => set({ desc: e.target.value })}/></label>
              <div>
                <div className="safi-cell-sub" style={{ marginBottom: 6 }}>Charge by</div>
                <div className="safi-seg">
                  <button className={`safi-seg__btn ${o.unit === 'piece' ? 'is-active' : ''}`} onClick={() => set({ unit: 'piece', qty: Math.max(1, Math.round(+o.qty || 1)) })}>Count (pieces)</button>
                  <button className={`safi-seg__btn ${o.unit === 'kg' ? 'is-active' : ''}`} onClick={() => set({ unit: 'kg' })}>Weight (kg)</button>
                </div>
              </div>
              <div className="safi-form__row">
                <label>{o.unit === 'kg' ? 'Weight (kg)' : 'How many'}
                  <div className="safi-qty">
                    <button onClick={() => set({ qty: qtyStep({ unit: o.unit }, o.qty, -1) })}>−</button>
                    <input type="number" step={o.unit === 'kg' ? '0.1' : '1'} min="0" value={o.qty} onChange={e => set({ qty: qtyClean({ unit: o.unit }, e.target.value) })}/>
                    <span className="safi-qty__unit">{o.unit}</span>
                    <button onClick={() => set({ qty: qtyStep({ unit: o.unit }, o.qty, 1) })}>+</button>
                  </div>
                </label>
                <label>Price per {o.unit === 'kg' ? 'kg' : 'piece'} (KES)<input type="number" min="0" className="safi-input safi-mono" value={o.price} onChange={e => set({ price: e.target.value })}/></label>
              </div>
              <div className="safi-other-total"><span>Line total</span><b className="safi-mono">{money(total)}</b></div>
            </div>
          );
        })()}
      </Modal>

      <Modal open={!!subtypePicker} onClose={() => setSubtypePicker(null)}
        title={subtypePicker ? `Choose ${subtypePicker.svc.name} types & quantities` : ''} width={560}
        footer={<>
          <Button kind="ghost" onClick={() => setSubtypePicker(null)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={() => {
            const picked = (subtypePicker.qty || {});
            const toAdd = [];
            for (const [name, q] of Object.entries(picked)) {
              if (q > 0) {
                const sub = subtypePicker.svc.subtypes.find(s => (typeof s === 'string' ? s : s.name) === name);
                const subObj = typeof sub === 'string' ? { name: sub } : sub;
                if (subtypePicker.svc.tellerPrice) {
                  const pr = Number((subtypePicker.price || {})[name]) || 0;
                  if (pr <= 0) { toast(`Enter a price for ${name}`, 'error'); return; }
                  toAdd.push({ svc: subtypePicker.svc.id, subtype: name, qty: q, customPrice: pr });
                  continue;
                }
                toAdd.push({
                  svc: subtypePicker.svc.id, subtype: name, qty: q,
                  // store override price if subtype has explicit price, else fall back to tier
                  customPrice: window.SAFI_PRICING.subPrice(subtypePicker.svc, subObj, effGroup).price,
                  note: window.SAFI_PRICING.subPrice(subtypePicker.svc, subObj, effGroup).promo || undefined,
                });
              }
            }
            if (!toAdd.length) { toast('Pick at least one with quantity', 'error'); return; }
            setItems([...items, ...toAdd]);
            setSubtypePicker(null);
            toast(`${toAdd.length} item${toAdd.length > 1 ? 's' : ''} added`);
          }}>Add to order</Button>
        </>}>
        {subtypePicker && (
          <div className="safi-subtype-multi">
            <p className="safi-cell-sub" style={{ marginTop: 0 }}>Set quantity for each type. Items with quantity 0 are skipped.</p>
            {subtypePicker.svc.subtypes.map((st, i) => {
              const sub = typeof st === 'string' ? { name: st } : st;
              const tier = subtypePicker.svc.tiers[effGroup] || 0;
              const tp = !!subtypePicker.svc.tellerPrice;
              const sp = tp ? { price: Number((subtypePicker.price || {})[sub.name]) || 0, promo: '' } : window.SAFI_PRICING.subPrice(subtypePicker.svc, sub, effGroup);
              const price = sp.price;
              const q = (subtypePicker.qty && subtypePicker.qty[sub.name]) || 0;
              const setQ = (newQ) => setSubtypePicker({ ...subtypePicker, qty: { ...(subtypePicker.qty || {}), [sub.name]: Math.max(0, newQ) }});
              return (
                <div key={i} className={`safi-subtype-multi__row ${q > 0 ? 'is-picked' : ''}`}>
                  <Icon name={subtypePicker.svc.icon} size={16}/>
                  <span className="safi-subtype-multi__name">{sub.name}</span>
                  {tp ? <input type="number" min="0" className="safi-input safi-mono" style={{ width: 90 }} placeholder="KES" value={(subtypePicker.price || {})[sub.name] ?? ''} onChange={e => setSubtypePicker({ ...subtypePicker, price: { ...(subtypePicker.price || {}), [sub.name]: e.target.value } })}/>
                  : <span className="safi-subtype-multi__price safi-mono">{money(price)}{sub.price != null && sub.price !== tier ? ' *' : ''}</span>}
                  {sp.promo && <span className="safi-tag safi-tag--green" style={{ fontSize: 10 }}>{sp.promo}</span>}
                  <div className="safi-qty">
                    <button onClick={() => setQ(q - 1)}>−</button>
                    <input type="number" value={q} min="0" onChange={e => setQ(parseInt(e.target.value) || 0)}/>
                    <button onClick={() => setQ(q + 1)}>+</button>
                  </div>
                  <span className="safi-subtype-multi__line safi-mono safi-cell-strong">{q > 0 ? money(price * q) : '—'}</span>
                </div>
              );
            })}
            <p className="safi-hint">* indicates a price specific to this subtype (override from Management).</p>
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── Receipt preview (used in New Order before saving) ────────────────────
function NewOrderPreview({ items, subtotal, discount, discountPct, total, deposit, balance, method, txn, customer, effGroup, services, money }) {
  // Group by service
  const groups = [];
  const seen = new Map();
  for (const it of items) {
    if (!seen.has(it.svc)) { seen.set(it.svc, groups.length); groups.push({ svc: it.svc, lines: [] }); }
    groups[seen.get(it.svc)].lines.push(it);
  }
  return (
    <div className="safi-preview">
      <div className="safi-receipt" style={{ width: '100%', boxShadow: 'none', padding: 12 }}>
        <div className="safi-receipt__rule" style={{ marginTop: 0 }}/>
        <div className="safi-receipt__cust">
          <span className="safi-receipt__cname">{firstName(customer?.name || 'Walk-in customer')}</span><br/>
          {customer?.phone || ''}
          {customer && <div><span className="safi-receipt__tag">{customer.group} tier</span></div>}
        </div>
        <div className="safi-receipt__rule"/>
        <table className="safi-receipt__items">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
          <tbody>
            {groups.flatMap((g, gi) => {
              const s = services.find(x => x.id === g.svc);
              const PR = window.SAFI_PRICING;
              const subSum = g.lines.reduce((sum, l) => sum + PR.line(s, l.qty, effGroup, l.customPrice), 0);
              if (g.lines.length === 1 && !g.lines[0].subtype) {
                const l = g.lines[0];
                const unit = l.customPrice ?? s?.tiers[effGroup] ?? 0;
                const rule = l.customPrice == null ? PR.ruleFor(s, effGroup) : null;
                return [<tr key={gi}><td><b>{s?.name}</b></td><td>{l.qty} {(l.unit || s?.unit) === 'piece' ? 'pc' : (l.unit || s?.unit)}</td><td className="safi-mono">{rule ? PR.describe(rule) : (v => Math.round(v || 0).toLocaleString('en-KE'))(unit)}</td><td className="safi-mono">{money(PR.line(s, l.qty, effGroup, l.customPrice))}</td></tr>];
              }
              return [
                <tr key={`gh${gi}`} className="safi-receipt__items-group"><td colSpan="4"><b>{s?.name}</b></td></tr>,
                ...g.lines.map((l, li) => {
                  const unit = l.customPrice ?? s?.tiers[effGroup] ?? 0;
                  return <tr key={`g${gi}l${li}`} className="safi-receipt__items-sub">
                    <td>{l.subtype || s?.name}</td><td>{l.qty} {(l.unit || s?.unit) === 'piece' ? 'pc' : (l.unit || s?.unit)}</td>
                    <td className="safi-mono">{(v => Math.round(v || 0).toLocaleString('en-KE'))(unit)}</td><td className="safi-mono">{money(PR.line(s, l.qty, effGroup, l.customPrice))}</td>
                  </tr>;
                }),
                g.lines.length > 1 && <tr key={`gs${gi}`} className="safi-receipt__items-subtotal"><td colSpan="3" style={{ textAlign: 'right' }}>Subtotal</td><td className="safi-mono"><b>{money(subSum)}</b></td></tr>,
              ].filter(Boolean);
            })}
          </tbody>
        </table>
        <div className="safi-receipt__rule"/>
        <dl className="safi-receipt__totals">
          <div><dt>Subtotal</dt><dd className="safi-mono">{money(subtotal)}</dd></div>
          {discountPct > 0 && <div><dt>Discount ({discountPct}%)</dt><dd className="safi-mono">— {money(discount)}</dd></div>}
          <div className="safi-receipt__grand"><dt>TOTAL</dt><dd className="safi-mono">{money(total)}</dd></div>
          {deposit > 0 && <div><dt>Paid ({method.toUpperCase()})</dt><dd className="safi-mono">{money(deposit)}</dd></div>}
          {txn && <div><dt>Txn</dt><dd className="safi-mono">{txn}</dd></div>}
          {balance > 0 && <div><dt>Balance</dt><dd className="safi-mono">{money(balance)}</dd></div>}
        </dl>
        {balance > 0 && (
          <div className="safi-receipt__balance">
            <div className="safi-receipt__balance-lbl">BALANCE DUE ON COLLECTION</div>
            <div className="safi-receipt__balance-amt safi-mono">{money(balance)}</div>
          </div>
        )}
      </div>
      <p className="safi-cell-sub" style={{ textAlign: 'center', marginTop: 12 }}>This is a preview — order not yet saved.</p>
    </div>
  );
}

// ─── Add Customer Modal (reusable) ────────────────────────────────────────
function AddCustomerModal({ open, onClose, onCreated }) {
  const [name, setName]     = useStateFD('');
  const [prefix, setPrefix] = useStateFD('+254');
  const [phone, setPhone]   = useStateFD('');
  const [group, setGroup]   = useStateFD('normal');
  const [residence, setResidence] = useStateFD('');

  useEffectFD(() => { if (open) { setName(''); setPrefix('+254'); setPhone(''); setGroup('normal'); setResidence(''); } }, [open]);

  function submit() {
    if (!name.trim()) { toast('Name required', 'error'); return; }
    if (String(phone || '').replace(/\D/g, '').replace(/^0+/, '').length < 9) { toast('Phone number is required (9 digits, e.g. 712 345 678)', 'error'); return; }
    const fullPhone = phone ? phone.trim() : '';
    const c = window.SAFI_STORE.addCustomer({
      name: name.trim(), phone: fullPhone, prefix, group,
      location: residence.trim(),
    });
    toast(`${c.name} added`, 'success');
    onCreated?.(c);
  }

  return (
    <Modal open={open} onClose={onClose} title="Add customer"
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" icon="check" onClick={submit}>Add customer</Button>
      </>}>
      <div className="safi-form">
        <label>Name<input className="safi-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jane Wanjiku"/></label>
        <label>Phone <span className="safi-req-inline">required</span>
          <PhoneInput prefix={prefix} phone={phone} onChange={(v) => { setPrefix(v.prefix); setPhone(v.phone); }}/>
        </label>
        <label>Pricing tier
          <div className="safi-seg">
            {['student', 'normal', 'corporate'].map(g => (
              <button key={g} className={`safi-seg__btn ${group === g ? 'is-active' : ''}`} onClick={() => setGroup(g)}>{g[0].toUpperCase() + g.slice(1)}</button>
            ))}
          </div>
        </label>
        <label>Residence <span className="safi-cell-sub">(optional)</span>
          <input className="safi-input" value={residence} onChange={e => setResidence(e.target.value)} placeholder="e.g. Karen · Kilimani · Westgate Apt 3B"/>
        </label>
      </div>
    </Modal>
  );
}


// ─── dd-mm hh:mm for order dates ──────────────────────────────────────────
function dm(s) { s = String(s || ''); return s.length >= 10 ? `${s.slice(8, 10)}-${s.slice(5, 7)}${s.length >= 16 ? ' ' + s.slice(11, 16) : ''}` : s; }
// ─── Stage trail: each stage entered, its time, washing/drying durations ─────
const STAGE_LBL = { intake: 'Intake', washing: 'Washing', drying: 'Drying', ironing: 'Ironing', drycleaning: 'Dry cleaning', ready: 'Ready', collected: 'Collected' };
function durTxt(ms) { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)}hr ${m % 60}min`; }
// Washer / dryer alert timings come from Management → Settings (synced to every laptop).
function machineTimers() { const t = (window.SAFI_STORE.get().settings || {}).machineTimers || {}; return { wash: +t.wash || 60, dry: +t.dry || 90, every: +t.every || 30, length: +t.length || 7, flash: +t.flash || 3 }; }
function stageAlert(stage, mins) { const T = machineTimers(); const start = stage === 'washing' ? T.wash : stage === 'drying' ? T.dry : null; return start != null && mins >= start && ((mins - start) % T.every) < T.length; }
function hmOf(iso) { const d = new Date(iso); return isNaN(d) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
// One stage at a time: the current badge, the time it was entered, and for washing /
// drying a running minute timer (green dot blinks after 1hr / 1hr30, every 30 min).
function StageTrail({ order }) {
  useStore();
  const times = window.SAFI_STORE.stageTimes(order.id);
  const at = times[order.status];
  const timed = order.status === 'washing' || order.status === 'drying' || order.status === 'holding' || order.status === 'finalhold';
  const [, tick] = useStateFD(0);
  useEffectFD(() => { if (!timed || !at) return; const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, [timed, at]);
  const mins = at ? (Date.now() - new Date(at)) / 60000 : 0;
  const alert = timed && at && stageAlert(order.status, mins);
  return (
    <div className="safi-stage1">
      <span className={`safi-stage1__b${alert ? ' is-alert' : ''}`} style={alert ? { '--safi-flash': machineTimers().flash + 's' } : null}><StatusBadge status={order.status} mark={collectMark(order)}/></span>
      {order.status !== 'collected' && <span className="safi-stage1__t safi-mono">{at ? hmOf(at) : '—'}</span>}
      {timed && at && <span className="safi-stage1__d">{durTxt(Date.now() - new Date(at))}</span>}
    </div>
  );
}

// ─── Orders queue ─────────────────────────────────────────────────────────
function OrdersQueue({ setView, setActiveOrderId, lang, money, role }) {
  const D = useStore();
  const [filter, setFilter] = useStateFD('all'); // default: every order for the chosen day, collected included
  const [q, setQ] = useStateFD('');
  const [preset, setPreset] = useStateFD(() => { const p = window.__safiPreset; window.__safiPreset = null; return p && p.kind !== 'collectedToday' ? p : null; });
  const [dateFilter, setDateFilter] = useStateFD(() => preset ? '' : SAFI_TIME.day()); // default: today; empty = any date

  const [payFilter, setPayFilter] = useStateFD('any');
  const nowMs = Date.now();
  const filtered = D.orders.filter(o => {
    // Reminders-deck shortcut
    if (preset) {
      const b = (o.total || 0) - (o.paid || 0);
      if (preset.kind === 'readyPaid' && !(o.status === 'ready' && b <= 0)) return false;
      if (preset.kind === 'readyDue' && !(o.status === 'ready' && b > 0)) return false;
      if (preset.kind === 'old24' && !(o.status !== 'collected' && nowMs - new Date(String(o.in || '').replace(' ', 'T')).getTime() >= 24 * 3600e3)) return false;
    }
    // Status filter
    if (filter === 'active') { if (o.status === 'collected') return false; }
    else if (filter !== 'all' && o.status !== filter) return false;
    // Date filter
    if (dateFilter && !o.in.startsWith(dateFilter)) return false;
    // Payment / collection filter
    const bal = (o.total || 0) - (o.paid || 0);
    if (payFilter === 'unpaid' && !((o.paid || 0) === 0 && (o.total || 0) > 0)) return false;
    if (payFilter === 'partial' && !((o.paid || 0) > 0 && bal > 0)) return false;
    if (payFilter === 'paid' && bal > 0) return false;
    if (payFilter === 'uncollected' && o.status === 'collected') return false;
    if (payFilter === 'waiting' && o.status !== 'ready') return false;
    // Search
    if (q) {
      const c = D.customers.find(x => x.id === o.customer);
      const hay = (o.id + ' ' + (c?.name || '') + ' ' + (c?.phone || '')).toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  // Counts follow the chosen day (Today / Yesterday / a date); Any date = everything.
  const dateOrders = dateFilter ? D.orders.filter(o => String(o.in).startsWith(dateFilter)) : D.orders;
  const statusCounts = ['intake', 'washing', 'holding', 'drying', 'finalhold', 'ironing', 'drycleaning', 'ready', 'collected'].map(s => ({ s, n: dateOrders.filter(o => o.status === s).length }));
  const activeCount = dateOrders.filter(o => o.status !== 'collected').length;
  const tierOf = (o) => (D.customers.find(c => c.id === o.customer) || {}).group || 'normal';
  const tierN = (g) => dateOrders.filter(o => tierOf(o) === g).length;
  const tierLine = `${tierN('student')} student${tierN('student') === 1 ? '' : 's'} · ${tierN('normal')} normal · ${tierN('corporate')} corporate`;
  const dayTellers = [...new Set(dateOrders.map(o => (D.staff.find(s => s.id === o.cashier) || {}).name).filter(Boolean))];

  const todayStr = SAFI_TIME.day();
  const yesterdayStr = SAFI_TIME.day(new Date(Date.now() - 86400e3));
  // Attendant shifts for the chosen day, from the synced duty log.
  const dutyShifts = (() => {
    if (!dateFilter) return [];
    const log = (((D.settings || {}).dutyLog) || []).slice().sort((x, y) => String(x.at).localeCompare(String(y.at)));
    const before = log.filter(e => String(e.at).slice(0, 10) < dateFilter).pop();
    const day = log.filter(e => String(e.at).slice(0, 10) === dateFilter);
    const isAtt = (id) => { const s = D.staff.find(x => x.id === id); return s && !/director|manager|owner/i.test(s.role || ''); };
    let seq = (before ? [{ id: before.id, at: dateFilter + ' 00:00', carried: true }] : []).concat(day).filter(e => isAtt(e.id));
    // Collapse repeats of the same person.
    seq = seq.filter((e, k) => k === 0 || seq[k - 1].id !== e.id);
    // No log yet (e.g. never switched since updating): show who is on duty now.
    if (!seq.length && dateFilter === todayStr) { const cur = window.SAFI_STORE.getCurrentStaff(); if (cur && cur.id) seq = [{ id: cur.id, at: dateFilter + ' 00:00', carried: true }]; }
    const nm = (id) => (D.staff.find(x => x.id === id) || {}).name || '—';
    const endOfDay = dateFilter === todayStr ? 'now' : '23:59';
    return seq.map((e, k) => ({ name: nm(e.id), from: e.carried ? 'start of day' : String(e.at).slice(11, 16), to: seq[k + 1] ? String(seq[k + 1].at).slice(11, 16) : endOfDay }));
  })();

  return (
    <>
      <Topbar
        title={t('nav_orders', lang)}
        subtitle={`${dateFilter ? `${dateOrders.length} orders on ${dateFilter.split('-').reverse().join('-')} · ` : ''}${activeCount} active · ${tierLine}${dateFilter && dayTellers.length ? ` · Orders taken by: ${dayTellers.join(', ')}` : ''}${dateFilter === SAFI_TIME.day() ? ` · On duty now: ${window.SAFI_STORE.getCurrentStaff().name}` : ''}`}
        right={<>
          {role === 'owner' && <Button kind="ghost" icon="print" onClick={() => window.print()}>{t('print', lang)}</Button>}
          <Button kind="primary" icon="plus" onClick={() => setView('new-order')}>{t('new_order', lang)}</Button>
        </>}
      />

      {dutyShifts.length > 0 && (
        <div className="safi-duty">
          <Icon name="staff" size={15}/>
          <b>Attendant on duty</b>
          {dutyShifts.map((d, k) => <span key={k} className="safi-duty__s"><b>{d.name}</b> {d.from} – {d.to}</span>)}
        </div>
      )}

      <div className="safi-status-strip">
        <button className={`safi-status-strip__btn ${filter === 'active' ? 'is-active' : ''}`} onClick={() => setFilter('active')}>
          <span>Active</span><b>{activeCount}</b>
        </button>
        <button className={`safi-status-strip__btn ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
          <span>{dateFilter ? 'All' : 'All time'}</span><b>{dateOrders.length}</b>
        </button>
        {statusCounts.map(({ s, n }) => (
          <button key={s} className={`safi-status-strip__btn ${filter === s ? 'is-active' : ''}`} onClick={() => setFilter(s)}>
            <StatusBadge status={s}/><b>{n}</b>
          </button>
        ))}
      </div>

      {preset && <div className="safi-preset"><Icon name="tag" size={14}/><span>Showing: <b>{preset.label}</b> · {filtered.length} order{filtered.length === 1 ? '' : 's'} · {money(filtered.reduce((s, o) => s + Math.max(0, (o.total || 0) - (o.paid || 0)), 0))} unpaid</span><button className="safi-rowlink" onClick={() => { setPreset(null); setDateFilter(SAFI_TIME.day()); }}>Show all orders</button></div>}
      <Card pad={false}>
        <div className="safi-toolbar safi-toolbar--pay">
          <span className="safi-cell-sub">Show</span>
          {[['any', 'All'], ['unpaid', 'Unpaid'], ['partial', 'Part-paid'], ['paid', 'Paid'], ['uncollected', 'Uncollected'], ['waiting', 'Ready, not collected']].map(([k, l]) => (
            <button key={k} className={`safi-chip ${payFilter === k ? 'is-active' : ''}`} onClick={() => setPayFilter(k)}>{l}</button>
          ))}
        </div>
        <div className="safi-toolbar">
          <div className="safi-cust-pick__search safi-cust-pick__search--inline">
            <Icon name="search" size={16}/>
            <input placeholder="Search order #, customer name or phone…" value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div className="safi-toolbar__filters">
            <button className={`safi-chip ${dateFilter === todayStr ? 'is-active' : ''}`} onClick={() => setDateFilter(todayStr)}>Today</button>
            <button className={`safi-chip ${dateFilter === yesterdayStr ? 'is-active' : ''}`} onClick={() => setDateFilter(yesterdayStr)}>Yesterday</button>
            <button className={`safi-chip ${!dateFilter ? 'is-active' : ''}`} onClick={() => setDateFilter('')}>Any date</button>
            <label className="safi-input safi-input--inline safi-datepick" title="Pick a date">
              <span className="safi-mono">{dateFilter ? dateFilter.split('-').reverse().join('-') : 'dd-mm-yyyy'}</span>
              <Icon name="calendar" size={14}/>
              <input type="date" className="safi-datepick__native" value={dateFilter} onChange={e => setDateFilter(e.target.value)} max={todayStr} title="Pick a specific date"/>
            </label>
          </div>
        </div>

        <Table
          cols={[
            { label: t('order_id', lang), render: r => <span className="safi-mono safi-cell-strong">{orderNo(r.id)}</span> },
            { label: t('customer', lang), render: r => {
                const c = D.customers.find(x => x.id === r.customer);
                return <div><div className="safi-cell-strong">{c?.name || orderNo(r.id)}</div><div className="safi-cell-sub">{c?.phone || ''}</div></div>;
              }},
            { label: 'In', render: r => <span className="safi-cell-sub">{dm(r.in)}</span> },
            { label: 'Due', render: r => <span className="safi-cell-sub">{dm(r.due)}</span> },
            { label: 'Items', render: r => {
              // One entry per service, its types in brackets: "Ironing (Shirt, Trouser)".
              const g = [];
              for (const i of r.items) {
                const nm = (D.services.find(s => s.id === i.svc)?.name || i.svc || '').split(' ')[0];
                let e = g.find(x => x.nm === nm); if (!e) { e = { nm, subs: [] }; g.push(e); }
                if (i.subtype && !e.subs.includes(i.subtype)) e.subs.push(i.subtype);
              }
              return <span>{g.map(e => e.subs.length ? `${e.nm} (${e.subs.join(', ')})` : e.nm).join(', ')}</span>;
            } },
            { label: t('total', lang), render: r => <span className="safi-mono">{money(r.total)}</span> },
            { label: t('paid', lang), render: r => <PayBadge paid={r.paid} total={r.total}/> },
            { label: t('method', lang), render: r => <MethodBadge method={r.method}/> },
            { label: t('status', lang), render: r => <StageTrail order={r}/> },
            { label: '', render: r => <button className="safi-rowlink" onClick={(e) => { e.stopPropagation(); setActiveOrderId(r.id); setView('order-detail'); }}>Open →</button> },
          ]}
          rows={filtered}
          onRow={r => { setActiveOrderId(r.id); setView('order-detail'); }}
          empty={dateFilter ? `No orders on ${dateFilter.split('-').reverse().join('-')}.` : "No orders match your filter."}
        />
      </Card>
    </>
  );
}

// ─── Order Detail ─────────────────────────────────────────────────────────
function OrderDetail({ orderId, setView, lang, money, role }) {
  const D = useStore();
  const o = D.orders.find(x => x.id === orderId) || D.orders[0];
  const [showPay, setShowPay] = useStateFD(false);
  const [showRewash, setShowRewash] = useStateFD(false);
  const [showDelete, setShowDelete] = useStateFD(false);
  const [showAdvance, setShowAdvance] = useStateFD(false);
  const [showEdit, setShowEdit] = useStateFD(false);
  const isManagement = role === 'owner';
  if (!o) return <div style={{ padding: 40 }}><h2>No order selected.</h2><Button onClick={() => setView('orders')}>Back to orders</Button></div>;
  const c = D.customers.find(x => x.id === o.customer);
  const stages = window.SAFI_STORE.stagesFor(o);
  const curIdx = o.status === 'holding' ? stages.indexOf('washing') : o.status === 'finalhold' ? stages.indexOf('drying') : stages.indexOf(o.status);
  const parent = o.rewashOf ? D.orders.find(x => x.id === o.rewashOf) : null;
  const rewashChild = o.rewashedBy ? D.orders.find(x => x.id === o.rewashedBy) : null;

  function markCollected() {
    const balance = (o.total || 0) - (o.paid || 0);
    if (balance > 0) { toast(`Balance ${money(balance)} still due. Collect payment before marking Collected.`, 'error'); return; }
    window.SAFI_STORE.updateOrder(o.id, { status: 'collected' });
    window.SAFI_STORE.logRelease({
      orderId: o.id, tag: o.tag || '',
      releasedTo: c?.name || o.id, balanceAtRelease: balance,
    });
    toast('Order marked Collected', 'success');
    // Mandatory SMS for collection
    if (c && c.phone && (((D.settings && D.settings.smsStages) || {}).collected !== false)) {
      const tpl = (D.smsTemplates || {}).collected || 'Hi {name}, your order {id} has been collected. Asante, karibu tena!';
      const body = tpl
        .replace(/\{name\}/g, firstName(c.name))
        .replace(/\{id\}/g, orderNo(o.id))
        .replace(/\{balance\}/g, `KES ${Math.round(o.total - o.paid).toLocaleString('en-KE')}`)
        .replace(/\{due\}/g, '')
        .replace(/\{rider\}/g, '—');
      window.SAFI_STORE.logMessage({
        to: `${c.prefix || ''} ${c.phone}`.trim(),
        name: c.name, body,
        orderId: o.id, stage: 'collected',
        method: 'sms',
      });
      toast(`SMS sent to ${c.name}`);
    }
  }

  return (
    <>
      <Topbar
        title={<><span className="safi-back" onClick={() => setView('orders')}><Icon name="arrow-l" size={16}/></span> Order <span className="safi-mono">{orderNo(o.id)}</span>{o.rewashOf && <span className="safi-tag safi-tag--violet" style={{ marginLeft: 8 }}>REWASH</span>}{o.rewashedBy && <span className="safi-tag safi-tag--amber" style={{ marginLeft: 8 }}>Has rewash</span>}</>}
        subtitle={`${c?.name || orderNo(o.id)} · placed ${dm(o.in)} · due ${dm(o.due)}${parent ? ` · rewash of ${parent.id}` : ''}`}
        right={<>
          <Button kind="ghost" icon="wrench" onClick={() => setShowRewash(true)}>Rewash (free)</Button>
          <Button kind="ghost" icon="pen" onClick={() => setShowEdit(true)}>Edit</Button>
          <Button kind="ghost" icon="alert" onClick={() => setView('issues')}>Issue</Button>
          <Button kind="ghost" icon="print" onClick={() => setView('receipt')}>{t('print', lang)}</Button>
          {o.status === 'washing' && <Button kind="ghost" icon="clock" onClick={() => { window.SAFI_STORE.holdOrder(o.id); toast('Moved to Holding (waiting for a dryer)'); }}>Hold (dryers busy)</Button>}
          {o.status === 'drying' && <span className="safi-fhbtn"><Button kind="ghost" icon="clock" onClick={() => { window.SAFI_STORE.finalHoldOrder(o.id); toast('Moved to Final hold (air drying, unfolded)'); }}>Final hold (air drying, unfolded etc)</Button></span>}
          {curIdx >= 0 && curIdx < stages.length - 1 && stages[curIdx + 1] !== 'collected' && <Button kind="primary" icon="arrow" onClick={() => { setShowAdvance(true); }}>Advance → {stages[curIdx + 1]}</Button>}
          <Button kind="ghost" onClick={() => setShowDelete(true)} icon="alert"><span style={{ color: 'var(--red)' }}>Delete</span></Button>
        </>}
      />

      <Card>
        <div className={`safi-stepper${(o.status === 'holding' || o.status === 'finalhold' || window.SAFI_STORE.stageTimes(o.id).holding || window.SAFI_STORE.stageTimes(o.id).finalhold) ? ' has-hold' : ''}`}>
          {stages.map((s, i) => (
            <div key={s} className={`safi-stepper__node ${i < curIdx ? 'is-done' : i === curIdx ? 'is-cur' : ''} ${(s === 'collected' && o.status === 'ready') ? 'is-clickable' : ''}`}
                 onClick={() => { if (s === 'collected' && o.status === 'ready') markCollected(); }}
                 title={s === 'collected' && o.status === 'ready' ? 'Click to mark as Collected' : ''}>
              <div className="safi-stepper__dot">
                {i < curIdx ? <Icon name="check" size={14} stroke="#fff"/> : <span>{i + 1}</span>}
              </div>
              <div className="safi-stepper__lbl">{t(s, lang)}</div>
              {(() => { const tm = window.SAFI_STORE.stageTimes(o.id); const at = tm[s]; if (!at) return null; const nx = (s === 'washing' && tm.holding) ? tm.holding : (s === 'drying' && tm.finalhold) ? tm.finalhold : stages.slice(i + 1).map(x => tm[x]).find(Boolean); const dur = (s === 'washing' || s === 'drying') ? durTxt((nx ? new Date(nx) : (s === o.status ? new Date() : null)) - new Date(at)) : null; const total = (s === 'ready' && tm.washing) ? durTxt(new Date(at) - new Date(tm.washing)) : null; return <div className="safi-stepper__at"><span className="safi-mono">{hmOf(at)}</span>{dur && (nx || s === o.status) ? <span>{nx ? dur : `${dur} so far`}</span> : null}{total ? <span className="safi-stepper__total" title="Order duration: start of washing to Ready"><Icon name="clockface" size={16}/>{total}</span> : null}</div>; })()}
              {i < stages.length - 1 && <div className={`safi-stepper__line ${i < curIdx ? 'is-done' : ''}`}/>}
              {s === 'washing' && (() => { const tm = window.SAFI_STORE.stageTimes(o.id); if (!tm.holding && o.status !== 'holding') return null; const cur = o.status === 'holding'; const end = tm.drying ? new Date(tm.drying) : (cur ? new Date() : null); return (
                <div className={`safi-stepper__hold${cur ? ' is-cur' : ''}`} title="Holding: washed, waiting for a free dryer">
                  <span className="safi-stepper__holddot">H</span>
                  <span><b>Holding</b> <span className="safi-mono">{tm.holding ? hmOf(tm.holding) : ''}</span>{tm.holding && end ? <span> · {durTxt(end - new Date(tm.holding))}{cur ? ' so far' : ''}</span> : null}</span>
                </div>); })()}
              {s === 'drying' && (() => { const tm = window.SAFI_STORE.stageTimes(o.id); if (!tm.finalhold && o.status !== 'finalhold') return null; const cur = o.status === 'finalhold'; const after = stages.slice(i + 1).map(x => tm[x]).find(Boolean); const end = after ? new Date(after) : (cur ? new Date() : null); return (
                <div className={`safi-stepper__hold safi-stepper__hold--fh${cur ? ' is-cur' : ''}`} title="Final hold: air-drying, unfolded, still on the rack">
                  <span className="safi-stepper__holddot">FH</span>
                  <span><b>Final hold</b> <span className="safi-mono">{tm.finalhold ? hmOf(tm.finalhold) : ''}</span>{tm.finalhold && end ? <span> · {durTxt(end - new Date(tm.finalhold))}{cur ? ' so far' : ''}</span> : null}</span>
                </div>); })()}
            </div>
          ))}
        </div>
        {o.status === 'ready' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <Button kind="primary" icon="check" onClick={markCollected}>Mark as Delivered/Collected</Button>
            <div className={`safi-collect-hint${(o.paid || 0) >= (o.total || 0) && (o.total || 0) > 0 ? ' is-paid' : ''}`}>
              <Icon name="alert" size={14}/>
              <span>
                {(o.paid || 0) >= (o.total || 0) && (o.total || 0) > 0
                  ? <><b>Paid in full.</b> Mark as Delivered/Collected only once the clothes have left the shop with the customer, or the rider has delivered them.</>
                  : <><b>Mark as Delivered/Collected</b> only once the clothes have left the shop with the customer, or the rider has delivered them, and payment is complete. Balance due: {`KES ${Math.max(0, (o.total || 0) - (o.paid || 0)).toLocaleString('en-KE')}`}.</>}
              </span>
            </div>
          </div>
        )}
      </Card>

      <div className="safi-grid safi-grid--2-1">
        <div className="safi-stack">
          <Card title="Items">
            <Table
              cols={[
                { label: 'Service', render: r => {
                    const s = D.services.find(x => x.id === r.svc);
                    return <span><Icon name={s?.icon} size={14}/> <b style={{ marginLeft: 6 }}>{s?.name}{r.subtype ? ` · ${r.subtype}` : ''}</b>{r.free && <span className="safi-tag safi-tag--green" style={{ marginLeft: 6 }}>FREE</span>}{r.note && <div className="safi-cell-sub">{r.note}</div>}</span>;
                  }},
                { label: 'Qty', render: r => <span>{r.qty} {D.services.find(x => x.id === r.svc)?.unit}</span> },
                { label: 'Unit price', render: r => <span className="safi-mono">{money(r.qty ? r.price / r.qty : 0)}</span> },
                { label: 'Line total', render: r => <span className={`safi-mono ${r.price > 0 ? 'safi-cell-strong' : 'safi-cell-sub'}`}>{r.price > 0 ? money(r.price) : '—'}</span> },
              ]}
              rows={o.items}
            />
            <div className="safi-sum safi-sum--inline">
              <div className="safi-sum__row"><span>{t('subtotal', lang)}</span><span className="safi-mono">{money(o.total + (o.discount || 0))}</span></div>
              <div className="safi-sum__row"><span>{t('discount', lang)}</span><span className="safi-mono">— {money(o.discount || 0)}</span></div>
              <div className="safi-sum__row safi-sum__row--total"><span>{t('total', lang)}</span><span className="safi-mono">{money(o.total)}</span></div>
            </div>
          </Card>
          <OrderNotes order={o}/>
        </div>

        <div className="safi-stack">
          <Card title="Customer" action={c ? <span className="safi-cell-sub">Tap to view / edit</span> : null}>
            <div className={`safi-cust-card${c ? ' is-link' : ''}`} role={c ? 'button' : undefined} tabIndex={c ? 0 : undefined}
              title={c ? 'Open in Customers to edit' : ''}
              onClick={() => { if (!c) return; window.__safiOpenCustomer = c.id; setView('customers'); }}
              onKeyDown={e => { if (c && e.key === 'Enter') { window.__safiOpenCustomer = c.id; setView('customers'); } }}>
              <div className="safi-cust-card__avatar">{(c?.name || 'WI').split(' ').map(s => s[0]).slice(0, 2).join('')}</div>
              <div>
                <div className="safi-cust-card__name">{c?.name || orderNo(o.id)}</div>
                {c && <div className="safi-cust-card__phone"><Icon name="phone" size={12}/> {c.phone}</div>}
                <div className="safi-cust-card__meta">
                  {c && <GroupBadge group={c.group}/>}
                  {c && <span className="safi-cell-sub">· {c.orders} orders · {money(c.spend)} lifetime</span>}
                </div>
              </div>
            </div>
          </Card>

          {isManagement && <PrintPermissions o={o}/>}
          <Card title="Payment">
            <div className="safi-paybox">
              <div className="safi-paybox__row"><span>{t('total', lang)}</span><b className="safi-mono">{money(o.total)}</b></div>
              <div className="safi-paybox__row"><span>{t('paid', lang)}</span><b className="safi-mono">{money(o.paid)}</b></div>
              <div className="safi-paybox__row safi-paybox__row--balance"><span>{t('balance', lang)}</span><b className="safi-mono">{money(o.total - o.paid)}</b></div>
              {(() => { const ps = D.payments.filter(p => p.order === o.id); return ps.length ? (
                <div className="safi-paylist">
                  {ps.map(p => <div key={p.id} className="safi-paylist__r"><button className="safi-paylist__m" title={p.verified ? 'Verified — cannot change' : 'Wrong method? Tap to switch M-Pesa / Bank'} disabled={p.verified} onClick={() => { const m = p.method === 'bank' ? 'mpesa' : 'bank'; window.SAFI_STORE.setPaymentMethod(p.id, m); toast(`Changed to ${m === 'bank' ? 'Bank' : 'M-Pesa'}`); }}><MethodBadge method={p.method}/>{!p.verified && <span className="safi-paylist__sw">⇄</span>}</button><span className="safi-mono">{p.txn || '—'}</span><span className="safi-cell-sub">{dm(p.date)}</span><b className="safi-mono">{money(p.amount)}</b></div>)}
                </div>
              ) : <div className="safi-paybox__meta"><span className="safi-cell-sub">No payments yet</span></div>; })()}
              {o.total - o.paid > 0 && <Button kind="primary" full icon="wallet" onClick={() => setShowPay(true)}>Collect balance · {money(o.total - o.paid)}</Button>}
            </div>
          </Card>

        </div>
      </div>

      <PaymentModal open={showPay} onClose={() => setShowPay(false)}
        orderId={o.id} suggested={o.total - o.paid}
        customerName={c?.name || orderNo(o.id)}/>

      <ApprovalRequestModal
        open={showRewash} onClose={() => setShowRewash(false)}
        action="rewash_order" target={o.id}
        title="Rewash items free of charge"
        description={`Items from ${orderNo(o.id)} will be re-processed at no charge as a new linked order.`}
        confirmLabel={isManagement ? 'Create rewash now' : 'Request approval'}
        isManagement={isManagement}
        onDirectApprove={() => {
          const r = window.SAFI_STORE.createRewash(o.id);
          toast(`Rewash ${orderNo(r.id)} created (free)`);
          setView('orders');
        }}/>

      <ApprovalRequestModal
        open={showDelete} onClose={() => setShowDelete(false)}
        action="delete_order" target={o.id}
        title={`Delete order ${orderNo(o.id)}?`}
        description="This permanently removes the order and any linked payments. The customer's order count is reversed."
        confirmLabel={isManagement ? 'Delete permanently' : 'Request approval to delete'}
        isManagement={isManagement}
        danger
        onDirectApprove={() => {
          window.SAFI_STORE.deleteOrder(o.id);
          toast(`Order ${orderNo(o.id)} deleted`);
          setView('orders');
        }}/>

      <AdvanceModal
        open={showAdvance} onClose={() => setShowAdvance(false)}
        order={o} customer={c} stages={stages} curIdx={curIdx}/>

      <EditOrderModal
        open={showEdit} onClose={() => setShowEdit(false)}
        order={o} isManagement={isManagement}/>
    </>
  );
}

// ─── Payment Modal ────────────────────────────────────────────────────────
function PaymentModal({ open, onClose, orderId, suggested = 0, customerName = '' }) {
  const [method, setMethod] = useStateFD('mpesa');
  const [amount, setAmount] = useStateFD(suggested);
  const [txn, setTxn]       = useStateFD('');
  const [note, setNote]     = useStateFD('');
  const partial = amount > 0 && amount < suggested;

  useEffectFD(() => { if (open) { setAmount(suggested); setTxn(''); setMethod('mpesa'); setNote(''); } }, [open, suggested]);

  function submit() {
    if (amount <= 0) { toast('Enter amount', 'error'); return; }
    if (String(txn || '').trim().length < 5) { toast('Transaction code needs at least 5 characters (ideally the last 5)', 'error'); return; }
    if (partial && !note.trim()) { toast('Part payment: note what was collected / what is left', 'error'); return; }
    window.SAFI_STORE.recordPayment({ orderId, method, amount, txn, customer: customerName });
    if (partial) {
      const o = window.SAFI_STORE.get().orders.find(x => x.id === orderId);
      const line = `[${dm(SAFI_TIME.stamp())}] Part payment KES ${Math.round(amount).toLocaleString('en-KE')} (${String(txn).toUpperCase()}): ${note.trim()}`;
      window.SAFI_STORE.updateOrder(orderId, { notes: o && o.notes ? `${o.notes}\n${line}` : line });
    }
    toast(partial ? 'Part payment recorded' : 'Payment recorded', 'success');
    onClose();
  }

  const txnLabel = method === 'cash' ? 'Cash Deposit Reference'
                : method === 'mpesa' ? 'M-Pesa transaction code'
                : 'Bank reference';
  const txnPlaceholder = method === 'cash' ? 'e.g. internal slip #'
                       : method === 'mpesa' ? 'TGW8KL2M91'
                       : 'BNK-554210';

  return (
    <Modal open={open} onClose={onClose} title={`Record payment · ${orderNo(orderId)}`}
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" icon="check" onClick={submit}>Record payment</Button>
      </>}>
      <div className="safi-form">
        <label>Method
          <div className="safi-seg safi-seg--full">
            {['mpesa', 'bank'].map(m => (
              <button key={m} className={`safi-seg__btn ${method === m ? 'is-active' : ''}`} onClick={() => setMethod(m)}>
                <Icon name={m === 'mpesa' ? 'mpesa' : 'wallet'} size={14}/>
                {m === 'mpesa' ? 'M-Pesa' : m === 'cash' ? 'Cash' : 'Bank'}
              </button>
            ))}
          </div>
        </label>
        <label>Amount (KES)<input type="number" className="safi-input safi-mono" value={amount} onChange={e => setAmount(parseFloat(e.target.value) || 0)}/></label>
        <label>{txnLabel} <span className="safi-cell-sub">(min. 5, ideally last 5)</span><input className={`safi-input safi-mono ${txn && txn.length < 5 ? 'is-error' : ''}`} maxLength={20} value={txn} onChange={e => setTxn(e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="Last 5, e.g. KL2M9"/>
          {txn && txn.length < 5 && <span className="safi-hint safi-hint--err">Expecting at least 5 characters ({txn.length} entered)</span>}</label>
        {partial && (
          <label><span>Part payment note <span className="safi-req">required</span></span>
            <textarea className="safi-textarea" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Collected 3 shirts & 1 trouser, travelling. Duvet & coat to be collected and paid later."/>
            <span className="safi-hint">KES {Math.round(suggested - amount).toLocaleString('en-KE')} will still be owed. The rest can be paid later with another code.</span>
          </label>
        )}
        <p className="safi-hint">Saved to ledger for monthly audit. <b>Verified by Management</b> against M-Pesa/bank statements.</p>
      </div>
    </Modal>
  );
}

// Order search with autocomplete (order no. or customer name). Hides the laptop suffix.
function OrderPicker({ D, value, onPick }) {
  const [q, setQ] = useStateFD('');
  const [open, setOpen] = useStateFD(false);
  const cur = value ? D.orders.find(o => o.id === value) : null;
  const cname = (o) => (D.customers.find(c => c.id === o.customer) || {}).name || '';
  const qq = q.trim().toUpperCase().replace(/^SF-?/, '');
  const hits = !q.trim() ? [] : D.orders.filter(o => orderNo(o.id).toUpperCase().replace(/^SF-?/, '').startsWith(qq) || cname(o).toUpperCase().includes(q.trim().toUpperCase())).slice(0, 8);
  if (cur) return <div className="safi-multi"><span className="safi-multi__chip safi-mono">{orderNo(cur.id)} · {cname(cur) || '—'}<button type="button" onClick={() => { onPick(null); setQ(''); }}>×</button></span></div>;
  return (
    <div className="safi-multi">
      <input className="safi-multi__input safi-mono" placeholder="Order no. or name" value={q}
        onChange={e => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={e => { if (e.key === 'Enter' && hits[0]) { e.preventDefault(); onPick(hits[0]); setQ(''); } }}/>
      {open && hits.length > 0 && (
        <div className="safi-multi__menu">
          {hits.map(o => <button type="button" key={o.id} onMouseDown={() => { onPick(o); setQ(''); setOpen(false); }}><b className="safi-mono">{orderNo(o.id)}</b><span>{cname(o)}</span><span className="safi-cell-sub">bal {Math.max(0, (o.total || 0) - (o.paid || 0)).toLocaleString()}</span></button>)}
        </div>
      )}
    </div>
  );
}

// Overdue (past due, not collected), oldest first, red → amber. Second tab lists every
// uncollected order with name, number and days waiting — the month-end list (printable).
function OverdueCard({ D, setView, setActiveOrderId, money }) {
  const [tab, setTab] = useStateFD('overdue');
  const [more, setMore] = useStateFD(false);
  const [newest, setNewest] = useStateFD(true);
  const now = Date.now();
  const ts = (s) => { const t = new Date(String(s || '').replace(' ', 'T')).getTime(); return isNaN(t) ? now : t; };
  const open = D.orders.filter(o => o.status !== 'collected');
  // Newest first by default so yesterday's late orders are visible straight away; Oldest puts the worst at the top.
  const dir = newest ? -1 : 1;
  const overdue = open.filter(o => o.due && ts(o.due) < now).sort((a, b) => dir * (ts(a.due) - ts(b.due)));
  const uncollected = [...open].sort((a, b) => dir * (ts(a.in) - ts(b.in)));
  const list = tab === 'overdue' ? overdue : uncollected;
  const cname = (o) => (D.customers.find(c => c.id === o.customer) || {}).name || '—';
  const due = (o) => Math.max(0, (o.total || 0) - (o.paid || 0));
  const outstanding = list.reduce((s, o) => s + due(o), 0);
  const fmt = (n) => (money ? money(n) : 'KES ' + Math.round(n).toLocaleString('en-KE'));
  const days = (o) => Math.max(0, Math.floor((now - ts(tab === 'overdue' ? o.due : o.in)) / 86400e3));
  // Uncollected: up to 7 days old is yellow, older is red. Overdue: red 7d+, orange 3-6d, green under 3d.
  const shade = (d) => tab === 'all' ? (d <= 7 ? 'is-new' : 'is-old') : (d >= 7 ? 'is-old' : d >= 3 ? 'is-mid' : 'is-fresh');
  const monthEnd = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() - d.getDate() <= 2; })();
  const shown = more ? list.slice(0, 50) : list.slice(0, 12);
  function downloadPdf() {
    const title = tab === 'overdue' ? 'Overdue orders' : 'Uncollected orders';
    const tone = (d) => { const s = shade(d); return s === 'is-old' ? '#fee2e2' : s === 'is-mid' ? '#ffedd5' : s === 'is-fresh' ? '#dcfce7' : '#fef9c3'; };
    const rows = list.map(o => { const d = days(o); return `<tr style="background:${tone(d)}"><td>${orderNo(o.id)}</td><td>${cname(o)}</td><td>${String(o.in).slice(0, 10)}</td><td><b>${d === 0 ? (tab === 'overdue' ? 'today' : 'new') : d + ' days'}</b></td><td>${o.status}</td><td style="text-align:right">${fmt(due(o))}</td></tr>`; }).join('');
    const legend = tab === 'overdue' ? '<span style="background:#fee2e2">7+ days</span><span style="background:#ffedd5">3–6 days</span><span style="background:#dcfce7">under 3 days</span>' : '<span style="background:#fef9c3">up to 7 days</span><span style="background:#fee2e2">over 7 days</span>';
    const html = `<!doctype html><html><head><title>${title}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111}h2{margin:0 0 4px}p{margin:0 0 10px;font-size:13px}.lg span{display:inline-block;padding:2px 8px;margin-right:6px;border-radius:4px;font-size:11px}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border-bottom:1px solid #ddd;padding:5px 6px;text-align:left;font-size:11.5px}th{background:#f3f4f6}tfoot td{font-weight:700;border-top:2px solid #111;background:#fff}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body><h2>${title} · ${new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</h2><p>${list.length} orders · ${fmt(outstanding)} outstanding</p><div class="lg">${legend}</div><table><thead><tr><th>Order</th><th>Customer</th><th>In</th><th>${tab === 'overdue' ? 'Days late' : 'Days waiting'}</th><th>Stage</th><th style="text-align:right">Amount due</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="5">Total outstanding</td><td style="text-align:right">${fmt(outstanding)}</td></tr></tfoot></table></body></html>`;
    // A hidden frame prints reliably in the desktop app (pop-up windows are blocked there).
    const old = document.getElementById('safi-list-frame'); if (old) old.remove();
    const fr = document.createElement('iframe');
    fr.id = 'safi-list-frame';
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(fr);
    const doc = fr.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { toast('Could not open the print dialog', 'error'); } }, 300);
  }

  return (
    <div id="safi-backlog-list">
    <Card title={tab === 'overdue' ? `Overdue · ${overdue.length}` : `Uncollected · ${uncollected.length}`} action={
      <div className="safi-tabs">
        <button className={`safi-tabs__btn ${tab === 'overdue' ? 'is-active' : ''}`} onClick={() => { setTab('overdue'); setMore(false); }}>Overdue</button>
        <button className={`safi-tabs__btn ${tab === 'all' ? 'is-active' : ''}`} onClick={() => { setTab('all'); setMore(false); }}>Uncollected{monthEnd ? ' · month end' : ''}</button>
      </div>
    }>
      {!list.length ? <p className="safi-cell-sub">{tab === 'overdue' ? 'Nothing overdue. 🎉' : 'No uncollected orders.'}</p> : (
        <div className={more ? 'safi-overdue-scroll' : ''}>
          <ul className="safi-overdue">
            {shown.map(o => { const d = days(o); return (
              <li key={o.id} className={shade(d)} onClick={() => { setActiveOrderId(o.id); setView('order-detail'); }}>
                <b className="safi-mono">{orderNo(o.id)}</b>
                <span>{tab === 'all' ? cname(o) : String(cname(o)).split(' ')[0]}{more && <small className="safi-mono">{fmt(due(o))}</small>}</span>
                <em>{d === 0 ? (tab === 'overdue' ? 'today' : 'new') : `${d}d`}</em>
              </li>
            ); })}
          </ul>
        </div>
      )}
      {list.length > 0 && (
        <div className="safi-overdue-foot">
          {more && <span>Total outstanding <b className="safi-mono">{fmt(outstanding)}</b>{list.length > 50 ? ` · showing 50 of ${list.length}, download for all` : ''}</span>}
          <span style={{ flex: 1 }}/>
          <div className="safi-seg"><button className={`safi-seg__btn ${newest ? 'is-active' : ''}`} onClick={() => setNewest(true)}>Newest first</button><button className={`safi-seg__btn ${!newest ? 'is-active' : ''}`} onClick={() => setNewest(false)}>Oldest first</button></div>
          {list.length > 12 && <Button kind="ghost" size="sm" onClick={() => setMore(!more)}>{more ? 'Show less' : `Show more (${Math.min(50, list.length)})`}</Button>}
          {more && <Button kind="ghost" size="sm" icon="print" onClick={downloadPdf}>Download PDF</Button>}
        </div>
      )}
    </Card>
    </div>
  );
}

// Banner + chime when the backlog passes the limits set in Settings (default 20 each).
function BacklogAlert({ D, setView }) {
  const now = Date.now();
  const ts = (s) => { const t = new Date(String(s || '').replace(' ', 'T')).getTime(); return isNaN(t) ? now : t; };
  const open = D.orders.filter(o => o.status !== 'collected');
  const nOver = open.filter(o => o.due && ts(o.due) < now).length;
  const nUnc = open.length;
  const lim = D.settings || {};
  const on = lim.backlogAlertOn !== false;
  const limOver = Number(lim.overdueAlert) || 20, limUnc = Number(lim.uncollectedAlert) || 20;
  const over = nOver > limOver, unc = nUnc > limUnc;
  const hit = on && (over || unc);
  const [flash, setFlash] = useStateFD(false);
  // Chime + flash on open, then every 2 hours while a list is over its limit.
  useEffectFD(() => {
    if (!hit) return;
    const ring = () => { try { window.safiChime && window.safiChime(true); } catch (e) {} setFlash(true); setTimeout(() => setFlash(false), 30000); };
    ring();
    const t = setInterval(ring, 2 * 60 * 60 * 1000);
    return () => clearInterval(t);
  }, [hit]);
  if (!hit) return null;
  const parts = [over && `${nOver} overdue orders`, unc && `${nUnc} uncollected orders`].filter(Boolean).join(' · ');
  return (
    <div className={`safi-backlog${flash ? ' is-flash' : ''}`}>
      <Icon name="alert" size={20}/>
      <div>
        <b>Action required</b>
        <span>{parts}. Team, let's make every effort to clear the backlog — call the customers and arrange collection or delivery.</span>
      </div>
      <Button kind="ghost" size="sm" onClick={() => { const el = document.getElementById('safi-backlog-list'); if (!el) return; const se = document.scrollingElement || document.documentElement; se.scrollTo({ top: se.scrollTop + el.getBoundingClientRect().top - 16, behavior: 'smooth' }); }}>View list</Button>
    </div>
  );
}

// ─── Order notes: running log on the order (who, when, what). Saved in the order's notes so it syncs.
function OrderNotes({ order }) {
  const [text, setText] = useStateFD('');
  const lines = String(order.notes || '').split('\n').map(s => s.trim()).filter(Boolean);
  function add() {
    const v = text.trim(); if (!v) return;
    const who = (window.SAFI_STORE.getCurrentStaff() || {}).name || 'Staff';
    const line = `[${dm(SAFI_TIME.stamp())} · ${who}] ${v}`;
    const cur = window.SAFI_STORE.get().orders.find(x => x.id === order.id);
    window.SAFI_STORE.updateOrder(order.id, { notes: cur && cur.notes ? `${cur.notes}\n${line}` : line });
    setText(''); toast('Note added');
  }
  return (
    <Card title="Order notes" action={<span className="safi-cell-sub">{lines.length ? `${lines.length} note${lines.length > 1 ? 's' : ''}` : ''}</span>}>
      {lines.length > 0 && (
        <ul className="safi-onotes">
          {lines.map((l, i) => { const m = l.match(/^\[([^\]]+)\]\s*(.*)$/); return <li key={i}>{m ? <><span className="safi-onotes__at">{m[1]}</span><span>{m[2]}</span></> : <span>{l}</span>}</li>; })}
        </ul>
      )}
      <div className="safi-onotes__add">
        <textarea className="safi-textarea" rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Add a note — e.g. Dry cleaning will be ready on Monday. Client has been informed by phone."
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }}/>
        <Button kind="primary" size="sm" icon="plus" onClick={add} disabled={!text.trim()}>Add note</Button>
      </div>
      <p className="safi-hint" style={{ margin: '6px 0 0' }}>Enter adds the note · Shift+Enter for a new line. Saved with your name and the time.</p>
    </Card>
  );
}

// ─── Advance modal (advance + optional SMS) ───────────────────────────────
function AdvanceModal({ open, onClose, order, customer, stages, curIdx }) {
  const D = useStore();
  const nextStage = stages[curIdx + 1];
  // Allow skipping ironing if next stage is ironing
  // Only washed orders (coming from Drying) may skip ironing; ironing-only orders always iron.
  const canSkipIroning = stages[curIdx] === 'drying' && nextStage === 'ironing' && stages[curIdx + 2] === 'ready';
  // Default: SKIP ironing. Toggle ON = include ironing
  const [includeIroning, setIncludeIroning] = useStateFD(false);
  const targetStage = (canSkipIroning && !includeIroning) ? 'ready' : nextStage;
  // SMS is mandatory for washing & collected, optional for others
  const SMS_DEF = { washing: true, drying: false, ironing: false, drycleaning: true, ready: true, collected: true };
  const smsStageOn = ({ ...SMS_DEF, ...((D.settings && D.settings.smsStages) || {}) })[targetStage] !== false;
  const smsMandatory = smsStageOn;

  const [sendSms, setSendSms] = useStateFD(true);
  const [body, setBody]       = useStateFD('');
  const [whichKey, setWhich]  = useStateFD(targetStage);
  const [editing, setEditing] = useStateFD(false);

  // Build template list (built-in stages + custom)
  const templates = D.smsTemplates || {};
  const allKeys = Object.keys(templates);
  const customKeys = allKeys.filter(k => !['ready', 'washing', 'ironing', 'drying', 'collected', 'delivery'].includes(k));

  function renderTpl(key) {
    const tpl = templates[key] || '';
    if (!customer) return tpl;
    return tpl
      .replace(/\{name\}/g, firstName(customer.name))
      .replace(/\{id\}/g, orderNo(order.id))
      .replace(/\{balance\}/g, `KES ${Math.round(order.total - order.paid).toLocaleString('en-KE')}`)
      .replace(/\{due\}/g, dmy(order.due || ''))
      .replace(/\{rider\}/g, '—');
  }

  useEffectFD(() => {
    if (open) {
      setBody(renderTpl(targetStage));
      setSendSms(true);
      setIncludeIroning(false);
    }
  }, [open]);

  useEffectFD(() => {
    setBody(renderTpl(targetStage));
    if (smsMandatory) setSendSms(true);
  }, [includeIroning, targetStage]);

  function doAdvance(includeSms) {
    if (smsStageOn && includeSms && customer && customer.phone && !body.trim()) { toast('Write the SMS first; this stage always sends one', 'error'); return; }
    if (canSkipIroning && !includeIroning) {
      // Skip ironing: advance from drying directly to ready (advance twice)
      window.SAFI_STORE.setStatus(order.id, 'ready'); // drying → ready, ironing skipped
    } else {
      window.SAFI_STORE.advanceStatus(order.id);
    }
    toast(`Moved to ${targetStage}`);
    if (smsStageOn && includeSms && customer && customer.phone && body.trim()) {
      window.SAFI_STORE.logMessage({
        to: `${customer.prefix || ''} ${customer.phone}`.trim(),
        name: customer.name, body: body.trim(),
        orderId: order.id, stage: targetStage,
        method: 'sms',
      });
    }
    onClose();
  }

  if (!order || !nextStage) return null;

  return (
    <Modal open={open} onClose={onClose} title={`Advance order`} width={560}
      footer={<>
        <Button kind="primary" icon="check" onClick={() => doAdvance(smsStageOn)}>Advance{smsStageOn && customer && customer.phone ? ' & send SMS' : ''}</Button>
      </>}>
      <div className="safi-form">
        <div className="safi-callout">
          <Icon name="arrow" size={14}/>
          <span>Stage: <b>{stages[curIdx]}</b> → <b>{targetStage}</b></span>
        </div>

        {canSkipIroning && (
          <label className="safi-toggle">
            <input type="checkbox" checked={includeIroning} onChange={e => setIncludeIroning(e.target.checked)}/>
            <span/>
            <b>Include ironing for this order</b>
          </label>
        )}

        {!smsStageOn ? (
          <p className="safi-cell-sub">SMS for {t(targetStage, 'en')} is switched off in Settings → Stage SMS.</p>
        ) : customer && customer.phone ? (
          <>
            {smsMandatory ? (
              <div className="safi-callout" style={{ background: 'var(--green-bg)', color: 'var(--green)', borderLeft: '3px solid var(--green)' }}>
                <Icon name="sms" size={14}/>
                <span><b>SMS will be sent</b> — mandatory for {targetStage} stage</span>
              </div>
            ) : (
              <label className="safi-toggle">
                <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)}/>
                <span/>
                <b>Send SMS notification to {customer.name} ({customer.prefix} {customer.phone})</b>
              </label>
            )}

            {(sendSms || smsMandatory) && (
              <label>SMS message
                <textarea className="safi-textarea" value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 100 }}/>
                <p className="safi-hint">Edit freely before sending. Logged to Messages screen.</p>
              </label>
            )}
          </>
        ) : (
          <p className="safi-cell-sub">No phone number on file for {customer?.name || 'this customer'}. {smsMandatory ? '⚠ SMS is mandatory for this stage — please add a phone number first.' : 'Add one in Customers to enable SMS.'}</p>
        )}
      </div>
    </Modal>
  );
}

// ─── Management PIN re-entry for edits and deletes ────────────────────────
function MgmtPinField({ value, onChange }) {
  if (!window.__safiOwnerPin) return null;
  return (
    <label className="safi-mgmt-pin">
      <span><Icon name="lock" size={13}/> Management PIN</span>
      <input className="safi-input safi-mono" type="password" inputMode="numeric" maxLength={6} autoComplete="off"
        value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••"/>
    </label>
  );
}

// ─── Approval request modal ───────────────────────────────────────────────
function ApprovalRequestModal({ open, onClose, action, target, title, description, confirmLabel, isManagement, danger, onDirectApprove }) {
  const [reason, setReason] = useStateFD('');
  const [pin, setPin] = useStateFD('');

  useEffectFD(() => { if (open) setReason(''); }, [open]);

  function submit() {
    if (isManagement) {
      if (window.__safiOwnerPin && pin !== window.__safiOwnerPin) { toast('Wrong Management PIN', 'error'); return; }
      onDirectApprove();
      setPin('');
      onClose();
      return;
    }
    if (!reason.trim()) { toast('Reason required', 'error'); return; }
    window.SAFI_STORE.requestApproval({ action, target, reason: reason.trim() });
    toast('Sent to Management for approval');
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={title} width={460}
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind={danger ? 'primary' : 'primary'} icon="check" onClick={submit}>{confirmLabel}</Button>
      </>}>
      <p className="safi-cell-sub" style={{ marginTop: 0 }}>{description}</p>
      {isManagement && <MgmtPinField value={pin} onChange={setPin}/>}
      {!isManagement && (
        <div className="safi-form">
          <div className="safi-callout">
            <Icon name="lock" size={14}/>
            <span>Only Management can confirm this. Your request will appear in their Approvals queue.</span>
          </div>
          <label>Reason / context<textarea className="safi-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this needed? Customer complaint, mistake, duplicate…"/></label>
        </div>
      )}
    </Modal>
  );
}

// ─── Edit Order modal (with approval if not management) ──────────────────
function EditOrderModal({ open, onClose, order, isManagement }) {
  const D = useStore();
  const [pin, setPin] = useStateFD('');
  const [custId, setCustId] = useStateFD('');
  const [items, setItems]   = useStateFD([]);
  const [notes, setNotes]   = useStateFD('');
  const [reason, setReason] = useStateFD('');

  useEffectFD(() => {
    if (open && order) {
      setItems(order.items.map(it => ({ ...it })));
      setNotes(order.notes || '');
      setReason('');
      setCustId(order.customer || '');
    }
  }, [open, order]);

  if (!order) return null;
  const cust = D.customers.find(c => c.id === order.customer);
  const group = cust?.group || 'normal';

  // Recompute total from items
  const newTotal = items.reduce((s, it) => s + (it.price || 0), 0);

  function changeQty(idx, qty) {
    const next = [...items];
    next[idx].qty = qty;
    const svc = D.services.find(s => s.id === next[idx].svc);
    if (svc && !next[idx].free) {
      next[idx].price = window.SAFI_PRICING.line(svc, qty, group, next[idx].customPrice);
    }
    setItems(next);
  }
  function removeItem(idx) { setItems(items.filter((_, i) => i !== idx)); }
  function addItem() {
    const svc = D.services[0];
    setItems([...items, { svc: svc.id, qty: 1, price: window.SAFI_PRICING.line(svc, 1, group), free: false }]);
  }

  function submit() {
    const payload = { items, total: newTotal, notes, customer: custId };
    if (isManagement) {
      if (window.__safiOwnerPin && pin !== window.__safiOwnerPin) { toast('Wrong Management PIN', 'error'); return; }
      setPin('');
      window.SAFI_STORE.updateOrder(order.id, payload);
      toast('Order updated', 'success');
      onClose();
    } else {
      if (!reason.trim()) { toast('Reason required', 'error'); return; }
      window.SAFI_STORE.requestApproval({
        action: 'edit_order', target: order.id, reason: reason.trim(), payload,
      });
      toast('Edit sent to Management for approval');
      onClose();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit order ${orderNo(order.id)}`} width={680}
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" icon="check" onClick={submit}>{isManagement ? 'Save changes' : 'Request approval'}</Button>
      </>}>
      <div className="safi-form">
        {isManagement && order.status === 'collected' && <div className="safi-callout"><Icon name="alert" size={14}/><span>This order has already been collected. Edit only to correct a mistake.</span></div>}
        <label>Customer
          <select className="safi-input" value={custId} onChange={e => setCustId(e.target.value)}>
            <option value="">— No customer —</option>
            {[...D.customers].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>)}
          </select>
        </label>
        {isManagement && <MgmtPinField value={pin} onChange={setPin}/>}
        {!isManagement && (
          <div className="safi-callout">
            <Icon name="lock" size={14}/>
            <span>Only Management can confirm an order edit. Your changes will appear in the Approvals queue.</span>
          </div>
        )}

        <h4 className="safi-section-h">Items</h4>
        <div className="safi-items" style={{ marginTop: 0 }}>
          <div className="safi-items__hd">
            <span>Service</span><span>Qty</span><span>Unit price</span><span>Line total</span><span></span>
          </div>
          {items.map((it, i) => {
            const svc = D.services.find(s => s.id === it.svc);
            const unit = it.customPrice ?? (svc?.tiers[group] || 0);
            const subs = (svc?.subtypes || []).map(x => typeof x === 'string' ? { name: x } : x);
            return (
              <div key={i} className="safi-items__row">
                <div className="safi-items__svc">
                <select value={it.svc} onChange={e => {
                  const next = [...items];
                  const newSvc = D.services.find(s => s.id === e.target.value);
                  const first = (newSvc?.subtypes || []).map(x => typeof x === 'string' ? { name: x } : x)[0];
                  next[i] = { ...next[i], svc: e.target.value, subtype: first ? first.name : '', customPrice: first && first.price != null ? first.price : undefined };
                  next[i].price = it.free ? 0 : window.SAFI_PRICING.line(newSvc, it.qty, group, next[i].customPrice);
                  setItems(next);
                }}>
                  {D.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {subs.length > 0 && (
                  <select className="safi-items__subtype" value={it.subtype || ''} onChange={e => {
                    const next = [...items];
                    const sub = subs.find(x => x.name === e.target.value);
                    next[i] = { ...next[i], subtype: e.target.value, customPrice: sub && sub.price != null ? sub.price : undefined };
                    next[i].price = it.free ? 0 : window.SAFI_PRICING.line(svc, it.qty, group, next[i].customPrice);
                    setItems(next);
                  }}>
                    {!it.subtype && <option value="">— choose type —</option>}
                    {subs.map(x => <option key={x.name} value={x.name}>{x.name}{x.price != null ? ` · KES ${x.price}` : ''}</option>)}
                  </select>
                )}
                </div>
                <div className="safi-qty">
                  <button onClick={() => changeQty(i, qtyStep(it.unit ? { unit: it.unit } : svc, it.qty, -1))}>−</button>
                  <input type="number" step={(it.unit || svc?.unit) === 'kg' ? '0.1' : '1'} min="0" value={it.qty} onChange={e => changeQty(i, qtyClean(it.unit ? { unit: it.unit } : svc, e.target.value))}/>
                  <span className="safi-qty__unit">{it.unit || svc?.unit}</span>
                  <button onClick={() => changeQty(i, qtyStep(it.unit ? { unit: it.unit } : svc, it.qty, 1))}>+</button>
                </div>
                <span className="safi-mono">{it.free ? 'FREE' : `KES ${unit}`}</span>
                <span className="safi-mono safi-cell-strong">{it.free ? '—' : `KES ${(it.price || 0).toLocaleString()}`}</span>
                <button className="safi-items__del" onClick={() => removeItem(i)}>×</button>
              </div>
            );
          })}
        </div>
        <button className="safi-rowlink" onClick={addItem}>+ Add line</button>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'var(--paper)', borderRadius: '10px', fontWeight: 700 }}>
          <span>New total</span>
          <span className="safi-mono">KES {newTotal.toLocaleString()}</span>
        </div>

        <label>Notes
          <textarea className="safi-textarea" value={notes} onChange={e => setNotes(e.target.value)}/>
        </label>

        {!isManagement && (
          <label>Reason for edit (required)
            <textarea className="safi-textarea" value={reason} onChange={e => setReason(e.target.value)} placeholder="Customer added items, wrong quantity, etc."/>
          </label>
        )}
      </div>
    </Modal>
  );
}

// One print per receipt. A second needs Management approval (Approvals queue); never more than two.
function ReceiptPrintButton({ D, o, lang }) {
  const used = window.SAFI_STORE.printCount('receipt', o.id);
  const allowed = window.SAFI_STORE.printsAllowed('receipt', o.id);
  const can = used < allowed;
  return <Button kind={can ? 'secondary' : 'ghost'} icon="print" disabled={!can}
    onClick={() => { if (can) window.printDoc('receipt', o.id); }}>{t('print', lang)}</Button>;
}

// Management only: allow one more print of this order's receipt or delivery note.
function PrintPermissions({ o }) {
  useStore();
  const row = (kind, label) => {
    const used = window.SAFI_STORE.printCount(kind, o.id);
    const allowed = window.SAFI_STORE.printsAllowed(kind, o.id);
    return (
      <div className="safi-printperm__row">
        <span>{label}</span>
        <span className="safi-cell-sub">printed {used} · allowed {allowed}</span>
        {kind !== 'jobcard' && used >= allowed
          ? <Button kind="ghost" size="sm" onClick={() => { window.SAFI_STORE.grantPrint(kind, o.id); toast(`One more ${label.toLowerCase()} print allowed`); }}>Allow 1 more</Button>
          : <span className="safi-cell-sub">{used < allowed ? 'can print' : 'max reached'}</span>}
      </div>
    );
  };
  return <Card title="Print permissions"><div className="safi-printperm">{row('receipt', 'Receipt')}{row('delivery', 'Delivery note')}{row('jobcard', 'Job card')}</div></Card>;
}

// ─── Receipt (printable) ──────────────────────────────────────────────────
function Receipt({ orderId, setView, lang, money, shop }) {
  const D = useStore();
  const o = D.orders.find(x => x.id === orderId) || D.orders[0];
  if (!o) return <div style={{ padding: 40 }}>No order.</div>;
  const c = D.customers.find(x => x.id === o.customer);

  return (
    <>
      <Topbar
        title="Receipt"
        subtitle="80mm thermal-printer optimized. Print this, then print the job card & delivery note."
        right={<>
          <Button kind="ghost" onClick={() => setView('order-detail')}><Icon name="arrow-l" size={14}/> Back</Button>
          <ReceiptPrintButton D={D} o={o} lang={lang}/>
          <Button kind="primary" icon="card" onClick={() => setView('job-card')}>Job card &amp; delivery note →</Button>
        </>}
      />

      <div className="safi-receipt-wrap">
        <div className="safi-receipt" id="safi-print-area">
          <div className="safi-receipt__hd">
            <div className="safi-receipt__logo">
              {window.VAZI_LOGO_PRINT && <img className="safi-receipt__logo-print" src={window.VAZI_LOGO_PRINT} alt=""/>}
              <img className="safi-receipt__letterhead" src={window.VAZI_LOGO_LETTERHEAD || window.VAZI_LOGO_LOCKUP} alt="Vazi Safi Laundry & Executive Dry Cleaners — We do laundry. You do life."/>
            </div>
            <div className="safi-receipt__addr">{shop?.address || ''}</div>
            <div className="safi-receipt__addr">{shop?.kra || ''}</div>
          </div>

          <div className="safi-receipt__rule"/>

          <div className="safi-receipt__meta">
            <div><span>Receipt #</span><b className="safi-mono">{orderNo(o.id)}</b></div>
            <div><span>Date</span><b>{(() => { const v = String(o.in || ''); return v.length >= 16 ? `${v.slice(8, 10)}-${v.slice(5, 7)}-${v.slice(2, 4)} ${v.slice(11, 16)}` : v; })()}</b></div>
            {o.queueNo && <div><span>Client #</span><b className="safi-mono">{String(o.queueNo).padStart(2, '0')}</b></div>}
            {o.tag && <div><span>Tag #</span><b className="safi-mono">{o.tag}</b></div>}
            <div><span>Attendant</span><b>{(D.staff.find(s => s.id === (o.cashier || ((D.settings || {}).currentStaffId) || D.currentStaffId)) || window.SAFI_STORE.getCurrentStaff())?.name || '—'}</b></div>
          </div>

          <div className="safi-receipt__rule"/>

          <div className="safi-receipt__cust">
            <span className="safi-receipt__cname">{firstName(c?.name || 'Walk-in customer')}</span><br/>
            {c?.phone || ''}<br/>
            {c && <span className="safi-receipt__tag">{c.group} tier</span>}
          </div>

          <div className="safi-receipt__rule safi-receipt__rule--dash"/>

          <table className="safi-receipt__items">
            <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
            <tbody>
              {(() => {
                // Group items by service id, preserving insertion order
                const groups = [];
                const seen = new Map();
                for (const it of o.items) {
                  if (!seen.has(it.svc)) { const idx = groups.length; seen.set(it.svc, idx); groups.push({ svc: it.svc, lines: [] }); }
                  groups[seen.get(it.svc)].lines.push(it);
                }
                return groups.flatMap((g, gi) => {
                  const s = D.services.find(x => x.id === g.svc);
                  const groupSubtotal = g.lines.reduce((sum, l) => sum + (l.price || 0), 0);
                  // If only one line and no subtype, render flat (no header / subtotal)
                  if (g.lines.length === 1 && !g.lines[0].subtype) {
                    const l = g.lines[0];
                    return [
                      <tr key={`g${gi}`}>
                        <td><b>{s?.name}</b>{l.free && ' (free)'}</td>
                        <td>{l.qty} {(l.unit || s?.unit) === 'piece' ? 'pc' : (l.unit || s?.unit)}</td>
                        <td className="safi-mono">{(v => Math.round(v || 0).toLocaleString('en-KE'))(l.qty ? l.price / l.qty : 0)}</td>
                        <td className="safi-mono">{money(l.price)}</td>
                      </tr>
                    ];
                  }
                  return [
                    <tr key={`gh${gi}`} className="safi-receipt__items-group">
                      <td colSpan="4"><b>{s?.name}</b></td>
                    </tr>,
                    ...g.lines.map((l, li) => (
                      <tr key={`g${gi}l${li}`} className="safi-receipt__items-sub">
                        <td>{l.subtype || s?.name}{l.free && ' (free)'}</td>
                        <td>{l.qty} {(l.unit || s?.unit) === 'piece' ? 'pc' : (l.unit || s?.unit)}</td>
                        <td className="safi-mono">{(v => Math.round(v || 0).toLocaleString('en-KE'))(l.qty ? l.price / l.qty : 0)}</td>
                        <td className="safi-mono">{money(l.price)}</td>
                      </tr>
                    )),
                    g.lines.length > 1 && (
                      <tr key={`gs${gi}`} className="safi-receipt__items-subtotal">
                        <td colSpan="3" style={{ textAlign: 'right' }}>Subtotal</td>
                        <td className="safi-mono"><b>{money(groupSubtotal)}</b></td>
                      </tr>
                    ),
                  ].filter(Boolean);
                });
              })()}
            </tbody>
          </table>

          <div className="safi-receipt__rule safi-receipt__rule--dash"/>

          <dl className="safi-receipt__totals">
            <div><dt>Subtotal</dt><dd className="safi-mono">{money(o.total + (o.discount || 0))}</dd></div>
            <div><dt>Discount</dt><dd className="safi-mono">— {money(o.discount || 0)}</dd></div>
            <div className="safi-receipt__grand"><dt>TOTAL</dt><dd className="safi-mono">{money(o.total)}</dd></div>
            <div><dt>Paid ({(o.method || '—').toUpperCase()})</dt><dd className="safi-mono">{money(o.paid)}</dd></div>
            {o.txn && <div><dt>Txn code</dt><dd className="safi-mono">{o.txn}</dd></div>}
            <div><dt>Balance</dt><dd className="safi-mono">{money(o.total - o.paid)}</dd></div>
          </dl>

          <div className="safi-receipt__rule"/>

          {(shop?.mpesaTill || shop?.bank) && (
            <div className="safi-receipt__pay">
              <div className="safi-receipt__pay-title">HOW TO PAY THE BALANCE</div>
              {shop?.mpesaTill && <div className="safi-receipt__pay-line">M-Pesa Paybill: {String(shop.mpesaTill).replace(/^.*?paybill\s*:?\s*/i, '')}</div>}
              {shop?.mpesaTill && shop?.bank && <div className="safi-receipt__pay-line safi-receipt__pay-line--sub">OR</div>}
              {shop?.bank && <div className="safi-receipt__pay-line">Send Money: {String(shop.bank).replace(/^.*?send money\s*:?\s*/i, '')}</div>}
            </div>
          )}

          {o.total - o.paid > 0 && (
            <div className="safi-receipt__balance">
              <div className="safi-receipt__balance-lbl">BALANCE DUE ON COLLECTION</div>
              <div className="safi-receipt__balance-amt safi-mono">KES {Math.round(o.total - o.paid).toLocaleString('en-KE')}</div>
            </div>
          )}

          <p className="safi-receipt__terms">
            {shop?.terms || 'Items uncollected after 30 days are donated. Claims must be made within 24 hrs of collection. Keep this receipt — required for pickup. Asante sana!'}
          </p>

          {(D.settings?.ownerPhone || D.settings?.payTo) && (
            <div className="safi-receipt__notice">
              {D.settings?.payTo && <div><b>Pay only to {D.settings.payTo}</b>{D.settings.payToName ? ` — ${D.settings.payToName}` : ''}. Never to a personal number.</div>}
              {D.settings?.ownerPhone && <div>No SMS from us within 10 minutes? Call {D.settings.ownerPhone}.</div>}
            </div>
          )}

          <div className="safi-receipt__foot">
            <b>{shop?.footerMsg || 'ASANTE — KARIBU TENA'}</b><br/>
            {shop?.web || 'vazisafi.co.ke'}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Customers ────────────────────────────────────────────────────────────
// Tier badge that doubles as a picker — e.g. a student who graduates becomes normal.
function TierCell({ customer, lang }) {
  const [open, setOpen] = useStateFD(false);
  const [pos, setPos] = useStateFD(null);
  const btnRef = useRefFD(null);
  const TIERS = ['normal', 'student', 'corporate'];
  // The table scrolls inside overflow:hidden ancestors, so the menu is fixed-
  // positioned off the button's rect and flips up when it would run off-screen.
  function toggle() {
    if (open) { setOpen(false); return; }
    const r = btnRef.current.getBoundingClientRect();
    const H = 120;
    const up = r.bottom + H > window.innerHeight;
    setPos({ left: Math.min(r.left, window.innerWidth - 160), top: up ? r.top - H - 6 : r.bottom + 6 });
    setOpen(true);
  }
  return (
    <div className="safi-tiercell">
      <button ref={btnRef} className="safi-tiercell__btn" title="Change tier" onClick={toggle}>
        <GroupBadge group={customer.group}/>
        <Icon name="chevron-down" size={12}/>
      </button>
      {open && (
        <>
          <div className="safi-tiercell__scrim" onClick={() => setOpen(false)} onWheel={() => setOpen(false)}/>
          <div className="safi-tiercell__menu" style={{ left: pos.left, top: pos.top }}>
            {TIERS.map(g => (
              <button key={g} className={`safi-tiercell__opt ${g === customer.group ? 'is-active' : ''}`}
                onClick={() => {
                  setOpen(false);
                  if (g === customer.group) return;
                  window.SAFI_STORE.updateCustomer(customer.id, { group: g });
                  toast(`${customer.name} moved to ${t(g, lang)}`, 'success');
                }}>
                <GroupBadge group={g}/>
                {g === customer.group && <Icon name="check" size={13}/>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CustomersScreen({ lang, money, setView, role }) {
  const D = useStore();
  const [q, setQ] = useStateFD('');
  const [group, setGroup] = useStateFD('all');
  const [sort, setSort] = useStateFD(() => localStorage.getItem('safi_cust_sort') || 'name');
  const [showAdd, setShowAdd] = useStateFD(false);
  const [sel, setSel] = useStateFD([]);
  const [editC, setEditC] = useStateFD(null);
  const fileRef = useRefFD(null);
  const owner = role === 'owner';
  // Opened from an order's Customer card: jump straight to that customer's edit form.
  useEffectFD(() => {
    const id = window.__safiOpenCustomer; if (!id) return;
    window.__safiOpenCustomer = null;
    const c = D.customers.find(x => x.id === id); if (!c) return;
    setQ(c.name || '');
    setEditC({ ...c, name: c.name || '', phone: c.phone || '', prefix: c.prefix || '+254', location: c.location || '', group: c.group || 'normal' });
  }, []);

  function saveEdit() {
    const e = editC;
    const name = e.name.trim(), phone = String(e.phone || '').replace(/\D/g, '').replace(/^0+/, '');
    if (!name) { toast('Name is required', 'error'); return; }
    if (phone.length < 9) { toast('Phone number looks too short', 'error'); return; }
    const clash = D.customers.find(c => c.id !== e.id && String(c.phone).replace(/\D/g, '').slice(-9) === phone.slice(-9));
    if (clash) { toast(`That number already belongs to ${clash.name}`, 'error'); return; }
    const before = D.customers.find(c => c.id === e.id) || {};
    const patch = { name, phone, prefix: e.prefix || '+254', location: e.location.trim(), group: e.group };
    const changed = Object.keys(patch).filter(k => String(before[k] ?? '') !== String(patch[k] ?? ''));
    if (!changed.length) { setEditC(null); return; }
    window.SAFI_STORE.updateCustomer(e.id, patch);
    window.SAFI_STORE.audit && window.SAFI_STORE.audit('customer.edit', e.id,
      changed.map(k => `${k}: ${before[k] ?? '—'} → ${patch[k] || '—'}`).join('; '));
    setEditC(null);
    toast('Customer updated', 'success');
  }

  function del(ids, label) {
    window.safiPinConfirm({
      title: `Delete ${label}?`,
      body: 'They are removed from this laptop and, when sync is on, from the cloud and the other laptops. Their past orders and payments stay in the books. This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: () => { const n = window.SAFI_STORE.removeCustomers(ids); setSel([]); toast(`Deleted ${n} customer${n === 1 ? '' : 's'}`, 'success'); },
    });
  }

  const joinedTs = c => { const t = Date.parse(c.joined); return isNaN(t) ? 0 : t; };
  const ordersOf = c => Number(c.orders) || 0;
  const spendOf = c => Number(c.spend) || 0;
  const rows = D.customers.filter(c => {
    if (group !== 'all' && c.group !== group) return false;
    if (q && !(c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))) return false;
    return true;
  }).sort((a, b) =>
    sort === 'name-desc' ? b.name.localeCompare(a.name, undefined, { sensitivity: 'base' })
    : sort === 'joined-new' ? joinedTs(b) - joinedTs(a)
    : sort === 'joined-old' ? joinedTs(a) - joinedTs(b)
    : sort === 'orders-high' ? ordersOf(b) - ordersOf(a)
    : sort === 'orders-low' ? ordersOf(a) - ordersOf(b)
    : sort === 'spend-high' ? spendOf(b) - spendOf(a)
    : sort === 'spend-low' ? spendOf(a) - spendOf(b)
    : sort === 'loyalty-high' ? (b.loyalty || 0) - (a.loyalty || 0)
    : sort === 'loyalty-low' ? (a.loyalty || 0) - (b.loyalty || 0)
    : a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  function handleImport(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      const rows = parseCSV(text);
      if (!rows.length) { toast('No rows parsed', 'error'); return; }
      const added = window.SAFI_STORE.importCustomers(rows);
      toast(`Imported ${added} customers`, 'success');
    };
    reader.readAsText(file);
  }

  return (
    <>
      <Topbar
        title={t('nav_customers', lang)}
        subtitle={`${D.customers.length} customers · imported records saved locally`}
        right={<>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleImport(e.target.files[0]); e.target.value = ''; }}/>
          {role === 'owner' && <Button kind="ghost" icon="box" onClick={() => fileRef.current?.click()}>Import CSV</Button>}
          {role === 'owner' && <Button kind="ghost" icon="print" onClick={() => exportCustomersCSV(D.customers)}>Export CSV</Button>}
          {owner && sel.length > 0 && <Button kind="danger" onClick={() => del(sel, `${sel.length} selected customer${sel.length === 1 ? '' : 's'}`)}>Delete selected ({sel.length})</Button>}
          {owner && sel.length === 0 && D.customers.length > 0 && <Button kind="ghost" onClick={() => del(D.customers.map(c => c.id), `all ${D.customers.length} customers`)}>Delete all</Button>}
          <Button kind="primary" icon="plus" onClick={() => setShowAdd(true)}>{t('add_customer', lang)}</Button>
        </>}
      />

      <div className="safi-grid safi-grid--4">
        <StatCard label="Total customers" value={D.customers.length} icon="users"/>
        <StatCard label="Students" value={D.customers.filter(c => c.group === 'student').length}/>
        <StatCard label="Normal" value={D.customers.filter(c => c.group === 'normal').length}/>
        <StatCard label="Corporate accounts" value={D.customers.filter(c => c.group === 'corporate').length}/>
      </div>

      <Card pad={false}>
        <div className="safi-toolbar">
          <div className="safi-cust-pick__search safi-cust-pick__search--inline">
            <Icon name="search" size={16}/>
            <input placeholder="Search name or phone…" value={q} onChange={e => setQ(e.target.value)}/>
          </div>
          <div className="safi-toolbar__filters">
            {['all', 'student', 'normal', 'corporate'].map(g => (
              <button key={g} className={`safi-chip ${group === g ? 'is-active' : ''}`} onClick={() => setGroup(g)}>{g === 'all' ? 'All' : t(g, lang)}</button>
            ))}
          </div>
          <label className="safi-sort">Sort
            <select className="safi-input" value={sort} onChange={e => { setSort(e.target.value); localStorage.setItem('safi_cust_sort', e.target.value); }}>
              <option value="name">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="joined-new">Newest joined</option>
              <option value="joined-old">Oldest joined</option>
              <optgroup label="Orders">
                <option value="orders-high">Most orders</option>
                <option value="orders-low">Fewest orders</option>
              </optgroup>
              <optgroup label="Lifetime spend">
                <option value="spend-high">Highest spend</option>
                <option value="spend-low">Lowest spend</option>
              </optgroup>
              <optgroup label="Loyalty">
                <option value="loyalty-high">Most loyal</option>
                <option value="loyalty-low">Least loyal</option>
              </optgroup>
            </select>
          </label>
        </div>
        <Table
          cols={[
            ...(owner ? [{ style: { width: 36 }, label: <input type="checkbox" aria-label="Select all shown"
                checked={rows.length > 0 && rows.every(r => sel.includes(r.id))}
                onChange={e => setSel(e.target.checked ? [...new Set([...sel, ...rows.map(r => r.id)])] : sel.filter(id => !rows.some(r => r.id === id)))}/>,
              render: r => <input type="checkbox" aria-label={`Select ${r.name}`} checked={sel.includes(r.id)}
                onChange={e => setSel(e.target.checked ? [...sel, r.id] : sel.filter(x => x !== r.id))}/> }] : []),
            { label: 'Name', render: r => (
              <div className="safi-cell-cust">
                <span className="safi-cust-pick__avatar">{r.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>
                <div><div className="safi-cell-strong">{r.name}</div><div className="safi-cell-sub">{r.phone}</div></div>
              </div>
            )},
            { label: 'Tier', render: r => <TierCell customer={r} lang={lang}/> },
            { label: 'Joined', render: r => <span className="safi-cell-sub">{r.joined}</span> },
            { label: 'Orders', render: r => <b>{r.orders}</b> },
            { label: 'Lifetime spend', render: r => <span className="safi-mono safi-cell-strong">{money(r.spend)}</span> },
            { label: 'Loyalty', render: r => (
              <div className="safi-loy">
                <div className="safi-loy__bar"><div style={{ width: `${r.loyalty * 10}%` }}/></div>
                <span>{r.loyalty}/10</span>
              </div>
            )},
            { label: 'Residence', render: r => r.location ? <span className="safi-cell-sub">{r.location}</span> : <span className="safi-cell-sub">—</span> },
            { label: '', render: r => (
              <div className="safi-rowacts">
                <button className="safi-rowlink" onClick={() => setEditC({ id: r.id, name: r.name, prefix: r.prefix || '+254', phone: r.phone, location: r.location || '', group: r.group })}>Edit</button>
                {owner && <button className="safi-rowlink safi-rowlink--danger" onClick={() => del([r.id], r.name)}>Delete</button>}
              </div>
            )},
          ]}
          rows={rows}
          empty="No customers yet — tap Add Customer or Import CSV."
        />
      </Card>

      <AddCustomerModal open={showAdd} onClose={() => setShowAdd(false)} onCreated={() => setShowAdd(false)}/>

      <Modal open={!!editC} onClose={() => setEditC(null)} title="Edit customer" width={460}
        footer={<>
          <Button kind="ghost" onClick={() => setEditC(null)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={saveEdit}>Save changes</Button>
        </>}>
        {editC && (
          <div className="safi-form">
            <label>Name<input className="safi-input" autoFocus value={editC.name} onChange={e => setEditC({ ...editC, name: e.target.value })}/></label>
            <div className="safi-form__row safi-form__row--phone">
              <label>Code<input className="safi-input safi-mono" value={editC.prefix} onChange={e => setEditC({ ...editC, prefix: e.target.value })}/></label>
              <label>Phone<input className="safi-input safi-mono" inputMode="tel" placeholder="729 480 592" value={editC.phone} onChange={e => setEditC({ ...editC, phone: formatPhone(e.target.value, editC.prefix) })}/></label>
            </div>
            <label>Residence<input className="safi-input" placeholder="e.g. Qwetu, Ruaraka" value={editC.location} onChange={e => setEditC({ ...editC, location: e.target.value })}/></label>
            <div>
              <div className="safi-cell-sub" style={{ marginBottom: 6 }}>Tier</div>
              <div className="safi-seg">
                {['student', 'normal', 'corporate'].map(g => (
                  <button key={g} className={`safi-seg__btn ${editC.group === g ? 'is-active' : ''}`} onClick={() => setEditC({ ...editC, group: g })}>{t(g, lang)}</button>
                ))}
              </div>
            </div>
            <p className="safi-cell-sub" style={{ margin: 0 }}>Past orders and receipts keep their history. Changes are recorded in the audit log.</p>
          </div>
        )}
      </Modal>
    </>
  );
}

// CSV helpers
function parseCSV(text) {
  // Tiny CSV parser supporting quoted fields
  function parseLine(line) {
    const out = []; let cur = ''; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else {
        if (ch === ',') { out.push(cur); cur = ''; }
        else if (ch === '"') q = true;
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map(c => c.trim());
  }
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const header = parseLine(lines[0]).map(h => h.toLowerCase());
  const nameIdx     = header.findIndex(h => /name/.test(h));
  const prefixIdx   = header.findIndex(h => /prefix|country/.test(h));
  const phoneIdx    = header.findIndex(h => /phone|mobile|tel/.test(h));
  const groupIdx    = header.findIndex(h => /group|tier|category/.test(h));
  const locationIdx = header.findIndex(h => /location|address|area|estate/.test(h));
  const useHeader = nameIdx >= 0;
  const start = useHeader ? 1 : 0;
  const rows = [];
  for (let i = start; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    const r = useHeader
      ? {
          name: cells[nameIdx] || '',
          prefix: (cells[prefixIdx] || '+254').trim(),
          phone: cells[phoneIdx] || '',
          group: cells[groupIdx] || 'normal',
          location: locationIdx >= 0 ? cells[locationIdx] || '' : '',
        }
      : { name: cells[0] || '', prefix: '+254', phone: cells[1] || '', group: cells[2] || 'normal', location: cells[3] || '' };
    if (r.name) rows.push(r);
  }
  return rows;
}
function exportCustomersCSV(customers) {
  const csv = ['name,prefix,phone,group,location,joined,orders,spend',
    ...customers.map(c => [c.name, c.prefix || '+254', c.phone, c.group, c.location || '', c.joined, c.orders, c.spend]
      .map(v => /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g,'""')}"` : v).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `vazi-safi-customers-${SAFI_TIME.day()}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Small 24-hour clock beside the date (this computer's time), ticks every second.
function LiveClock() {
  const [now, setNow] = useStateFD(new Date());
  useEffectFD(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const p = (n) => String(n).padStart(2, '0');
  return <span className="safi-liveclock">{p(now.getHours())}:{p(now.getMinutes())}<span className="safi-liveclock__s">:{p(now.getSeconds())}</span></span>;
}

// ─── Statement reconcile: upload an M-Pesa or bank statement, match codes, verify ───
// Reads PDF (pdf.js, loaded on first use) or CSV/TXT. A payment matches when its code's
// last 5 characters equal the last 5 of a code-like word in the statement (or the whole
// code, when staff typed the full code). Matched payments are verified automatically.
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'; s.onload = res; s.onerror = () => rej(new Error('Could not load the PDF reader (check the internet)')); document.head.appendChild(s); });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  return window.pdfjsLib;
}
async function statementText(file) {
  if (!/\.pdf$/i.test(file.name)) return await file.text();
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let t = '';
  for (let i = 1; i <= doc.numPages; i++) { const pg = await doc.getPage(i); const tc = await pg.getTextContent(); t += tc.items.map(x => x.str).join(' ') + '\n'; }
  return t;
}
// Pull "code + amount (+ date)" lines out of statement text, for month-end reconciliation.
// M-Pesa codes are 10 letters/digits; bank refs vary, so take any code-like word followed
// within ~160 characters by an amount like 1,050.00.
function parseStatementEntries(text) {
  const T = String(text || '').toUpperCase().replace(/\s+/g, ' ');
  const out = {};
  // Money like 1,302.00 or 1302.00, never part of a date such as 21.10.2026.
  const AMT = /(?<![\d.,])(\d{1,3}(?:,\d{3})+|\d+)\.\d{2}(?![\d.])/g;
  const DATE = /\b\d{2}[./-]\d{2}[./-]20\d{2}\b|\b20\d{2}-\d{2}-\d{2}\b/g;
  const amts = (str) => (str.match(AMT) || []).map(a => parseFloat(a.replace(/,/g, ''))).filter(n => n > 0);
  const re = /\b([A-Z0-9]{8,14})\b/g; let m;
  while ((m = re.exec(T))) {
    const code = m[1];
    if (!/\d/.test(code) || !/[A-Z]/.test(code)) continue;
    // M-Pesa statements: "Receipt No. | 2026-10-21 14:05:12 | Details | Completed | Paid In | Withdrawn | Balance".
    // The code is followed straight away by its date; read only that row's amounts (Paid In first).
    const rest = T.slice(m.index + code.length);
    if (/^ ?20\d{2}-\d{2}-\d{2}/.test(rest)) {
      const nx = rest.slice(1).search(/\b[A-Z0-9]{8,12} 20\d{2}-\d{2}-\d{2}/);
      const seg = rest.slice(0, nx > 0 ? nx + 1 : 400);
      const list = amts(seg);
      if (list.length && !out[code]) {
        const dd = seg.match(/(20\d{2})-(\d{2})-(\d{2})/);
        out[code] = { code, amount: list[0], date: dd ? `${dd[1]}-${dd[2]}-${dd[3]}` : '', cands: list.slice(0, 2) };
      }
      continue;
    }
    // Bank statements put the amounts BEFORE the code (… 21.10.2026 PAYBILL CREDIT 0.00 1,302.00 169,514.99 UJKQJB42CZ …).
    const back = T.slice(Math.max(0, m.index - 240), m.index);
    let lastDate = -1; let dm; DATE.lastIndex = 0; while ((dm = DATE.exec(back))) lastDate = dm.index + dm[0].length;
    const behind = lastDate >= 0 ? amts(back.slice(lastDate)) : [];
    // M-Pesa statements put them AFTER the code.
    const ahead = amts(T.slice(m.index + code.length, m.index + 160));
    let amount = 0;
    if (behind.length >= 2) amount = behind[0];
    else if (behind.length === 1 && !ahead.length) amount = behind[0];
    else if (ahead.length) amount = ahead[0];
    else if (behind.length) amount = behind[0];
    if (!amount) continue;
    const around = T.slice(Math.max(0, m.index - 240), m.index + 160);
    const d1 = around.match(/(20\d{2})-(\d{2})-(\d{2})/), d2 = around.match(/(\d{2})[\/.](\d{2})[\/.](20\d{2})/);
    const date = d1 ? `${d1[1]}-${d1[2]}-${d1[3]}` : d2 ? `${d2[3]}-${d2[2]}-${d2[1]}` : '';
    if (!out[code]) out[code] = { code, amount, date, cands: behind.length >= 2 ? behind : [...new Set([...behind, ...ahead])] };
  }
  return out;
}
function saveStatementEntries(text, fileLabel) {
  const prev = (window.SAFI_STORE.get().settings || {}).statementEntries || {};
  const got = parseStatementEntries(text);
  const at = SAFI_TIME.stamp();
  const next = { ...prev };
  for (const [k, v] of Object.entries(got)) next[k] = { ...v, file: fileLabel, at };
  window.SAFI_STORE.setSetting('statementEntries', next);
}

// Month-end check: matched, money with no order, paid with no money. Cash is not part of it.
function ReconcilePeriod() {
  const D = useStore();
  const now = new Date();
  const [open, setOpen] = useStateFD(false);
  const [month, setMonth] = useStateFD(SAFI_TIME.day(new Date(now.getFullYear(), now.getMonth(), 1)).slice(0, 7));
  const st = D.settings || {};
  const entries = Object.values(st.statementEntries || {});
  const ignored = st.statementIgnored || {};
  const closed = (st.reconciled || {})[month];
  const tail = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-5);
  const pays = (D.payments || []).filter(p => String(p.date).startsWith(month) && (p.method === 'mpesa' || p.method === 'bank'));
  const matched = pays.filter(p => p.verified);
  const noMoney = pays.filter(p => !p.verified);
  const known = new Set([...(D.payments || []).map(p => tail(p.txn)), ...(D.expenses || []).map(e => tail(e.txn))].filter(Boolean));
  const noOrder = entries.filter(e => (!e.date || e.date.startsWith(month)) && !known.has(tail(e.code)) && !ignored[e.code]);
  const sum = (a) => a.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const byM = (m) => matched.filter(p => p.method === m);
  const label = new Date(month + '-01T00:00').toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
  const ignore = (code) => { window.SAFI_STORE.setSetting('statementIgnored', { ...ignored, [code]: true }); toast('Marked as not a customer payment'); };
  function closeMonth() {
    window.SAFI_STORE.setSetting('reconciled', { ...(st.reconciled || {}), [month]: { by: 'Management', at: SAFI_TIME.stamp(), matched: sum(matched), mpesa: sum(byM('mpesa')), bank: sum(byM('bank')), noMoney: noMoney.length, noOrder: noOrder.length } });
    toast(`${label} reconciled`, 'success');
  }
  function download() {
    const rows = [['Section', 'Order', 'Customer', 'Method', 'Code', 'Amount', 'Date']];
    matched.forEach(p => rows.push(['Matched', orderNo(p.order), p.customer || '', p.method, p.txn, p.amount, p.date]));
    noMoney.forEach(p => rows.push(['Paid, no money found', orderNo(p.order), p.customer || '', p.method, p.txn, p.amount, p.date]));
    noOrder.forEach(e => rows.push(['Money, no order', '', '', '', e.code, e.amount, e.date]));
    const csv = rows.map(r => r.map(v => /[,"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `vazi-safi-reconcile-${month}.csv`; a.click();
  }
  const T = ({ rows, cols }) => rows.length ? <table className="safi-approval-items"><thead><tr>{cols.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows}</tbody></table> : <p className="safi-cell-sub" style={{ margin: 0 }}>None.</p>;
  return (
    <>
      <Button kind="ghost" icon="check" onClick={() => setOpen(true)}>Reconcile period</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Reconcile ${label}`} width={820}
        footer={<>
          <Button kind="ghost" icon="box" onClick={download}>Download summary (CSV)</Button>
          <Button kind="ghost" onClick={() => setOpen(false)}>Close</Button>
          {!closed && <Button kind="primary" icon="check" onClick={closeMonth}>Mark {label} reconciled</Button>}
        </>}>
        <div className="safi-form">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>Month <input type="month" className="safi-input" style={{ width: 170 }} value={month} max={SAFI_TIME.day().slice(0, 7)} onChange={e => e.target.value && setMonth(e.target.value)}/></label>
            {closed && <span className="safi-pill safi-pill--green"><Icon name="check" size={10}/> Reconciled {closed.at} by {closed.by}</span>}
          </div>
          {!entries.length && <div className="safi-callout"><Icon name="alert" size={14}/><span>No statements uploaded yet. Use <b>Upload statement & verify</b> first, so the check can see what reached the accounts.</span></div>}
          <div className="safi-recon-sum">
            <div><span>Matched</span><b className="safi-mono">KES {sum(matched).toLocaleString()}</b><small>M-Pesa {sum(byM('mpesa')).toLocaleString()} · Bank {sum(byM('bank')).toLocaleString()}</small></div>
            <div className={noOrder.length ? 'is-warn' : ''}><span>Money with no order</span><b className="safi-mono">{noOrder.length} · KES {sum(noOrder).toLocaleString()}</b><small>On the statement, not recorded</small></div>
            <div className={noMoney.length ? 'is-warn' : ''}><span>Paid with no money</span><b className="safi-mono">{noMoney.length} · KES {sum(noMoney).toLocaleString()}</b><small>Recorded, not on a statement</small></div>
          </div>
          <h4 className="safi-section-h">1 · Matched ({matched.length})</h4>
          <T cols={['Order', 'Customer', 'Method', 'Code', 'Amount']} rows={matched.map(p => <tr key={p.id}><td className="safi-mono">{orderNo(p.order)}</td><td>{p.customer || '—'}</td><td>{p.method === 'mpesa' ? 'M-Pesa' : 'Bank'}</td><td className="safi-mono">{p.txn}</td><td className="safi-mono">KES {Number(p.amount).toLocaleString()}</td></tr>)}/>
          <h4 className="safi-section-h">2 · Money with no order ({noOrder.length})</h4>
          <p className="safi-cell-sub" style={{ margin: '0 0 4px' }}>Received in the account but no payment in the system has this code. Find the order and record the payment, or mark it as not a customer payment.</p>
          <T cols={['Code', 'Date', 'Amount', '']} rows={noOrder.map(e => <tr key={e.code}><td className="safi-mono">{e.code}</td><td>{e.date || '—'}</td><td className="safi-mono">KES {Number(e.amount).toLocaleString()}</td><td><button className="safi-rowlink" onClick={() => ignore(e.code)}>Not a customer payment</button></td></tr>)}/>
          <h4 className="safi-section-h">3 · Paid with no money ({noMoney.length})</h4>
          <p className="safi-cell-sub" style={{ margin: '0 0 4px' }}>Recorded at the till but the code was not found on any statement uploaded. Check the code, or upload the right statement.</p>
          <T cols={['Order', 'Customer', 'Method', 'Code', 'Amount', 'Date']} rows={noMoney.map(p => <tr key={p.id}><td className="safi-mono">{orderNo(p.order)}</td><td>{p.customer || '—'}</td><td>{p.method === 'mpesa' ? 'M-Pesa' : 'Bank'}</td><td className="safi-mono">{p.txn || '—'}</td><td className="safi-mono">KES {Number(p.amount).toLocaleString()}</td><td>{dmy(p.date)}</td></tr>)}/>
        </div>
      </Modal>
    </>
  );
}

function StatementReconcile() {
  const D = useStore();
  const ref = useRefFD(null);
  const [busy, setBusy] = useStateFD(false);
  const [report, setReport] = useStateFD(null);
  const [pinAsk, setPinAsk] = useStateFD(null);   // { files, text, seen } waiting for PIN
  const [rPin, setRPin] = useStateFD('');
  const fpOf = (t) => { let h = 5381; const s = String(t).replace(/\s+/g, ' '); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return 'st' + (h >>> 0).toString(36) + s.length.toString(36); };
  async function onFiles(files) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      let text = '';
      for (const fl of files) text += '\n' + await statementText(fl);
      // A statement that was already uploaded can be checked again only with the Management PIN.
      const fp = fpOf(text);
      const seen = ((D.settings || {}).stmtUploads || {})[fp];
      if (seen) { setBusy(false); setRPin(''); setPinAsk({ files: [...files].map(x => x.name), text, seen, fp }); return; }
      runCheck([...files].map(x => x.name), text, fp, false);
    } catch (e) { toast(e.message || 'Could not read the statement', 'error'); }
    setBusy(false);
  }
  function runCheck(fileNames, text, fp, again) {
    try {
      // Code-like words: 5+ letters/digits with at least one digit and one letter.
      const words = new Set((text.toUpperCase().match(/[A-Z0-9]{5,}/g) || []).filter(w => /\d/.test(w) && /[A-Z]/.test(w)));
      const tails = new Set([...words].map(w => w.slice(-5)));
      // Also re-check payments already verified from a statement, so a re-upload corrects their amount.
      const pending = (D.payments || []).filter(p => String(p.txn || '').replace(/\s/g, '').length >= 5);
      const matched = [], already = [], missed = [];
      const ents = parseStatementEntries(text);
      for (const p of pending) {
        const code = String(p.txn).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (words.has(code) || tails.has(code.slice(-5))) {
          const hit = ents[code] || Object.values(ents).find(e => e.code.slice(-5) === code.slice(-5));
          // If the recorded amount appears in that statement row, it matches exactly.
          const amt = hit ? ((hit.cands || []).some(c => Math.round(c) === Math.round(p.amount)) ? p.amount : hit.amount) : null;
          if (p.verified) {
            // Already verified: keep it, refresh the statement amount (PIN given on a repeat upload).
            if (p.verifiedBy !== 'manual' && amt != null) window.SAFI_STORE.verifyPayment(p.id, { stmtAmount: amt });
            already.push({ ...p, stmtAmount: amt != null ? amt : p.stmtAmount });
          } else {
            window.SAFI_STORE.verifyPayment(p.id, { stmtAmount: amt });
            matched.push({ ...p, stmtAmount: amt });
          }
        } else if (!p.verified) missed.push(p);
      }
      saveStatementEntries(text, fileNames.join(', '));
      const ups = { ...((window.SAFI_STORE.get().settings || {}).stmtUploads || {}) };
      const prev = ups[fp];
      ups[fp] = { name: fileNames.join(', '), first: prev ? prev.first : SAFI_TIME.stamp(), last: SAFI_TIME.stamp(), times: (prev ? prev.times : 0) + 1 };
      window.SAFI_STORE.setSetting('stmtUploads', ups);
      setReport({ files: fileNames, words: words.size, matched, already, missed, again });
      toast(matched.length ? `${matched.length} payment${matched.length > 1 ? 's' : ''} verified` : already.length ? `${already.length} already verified` : 'No matching codes found', matched.length || already.length ? 'success' : 'error');
    } catch (e) { toast(e.message || 'Could not read the statement', 'error'); }
  }
  const diffCell = (p) => { if (p.stmtAmount == null) return <span className="safi-cell-sub">—</span>; const d = Math.round(p.stmtAmount - p.amount); return d === 0 ? <span className="safi-tick safi-tick--full safi-vtick"><svg viewBox="0 0 12 12" width="10" height="10"><path d="M2.5 6.4l2.3 2.3 4.7-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></span> : <span className={`safi-vres safi-vres--${d > 0 ? 'up' : 'down'}`}>{d > 0 ? '+' : '−'}{Math.abs(d).toLocaleString()}</span>; };
  const row = (p) => <tr key={p.id}><td className="safi-mono">{orderNo(p.order)}</td><td>{p.customer || '—'}</td><td>{p.method === 'mpesa' ? 'M-Pesa' : p.method === 'bank' ? 'Bank' : p.method}</td><td className="safi-mono">{p.txn}</td><td className="safi-mono">KES {Number(p.amount || 0).toLocaleString()}</td><td className="safi-mono">{p.stmtAmount != null ? Number(p.stmtAmount).toLocaleString() : '—'}</td><td>{diffCell(p)}</td></tr>;
  const TH = <thead><tr><th>Order</th><th>Customer</th><th>Method</th><th>Code</th><th>Amount</th><th>Statement</th><th></th></tr></thead>;
  return (
    <>
      <input ref={ref} type="file" accept=".pdf,.csv,.txt" multiple style={{ display: 'none' }} onChange={e => { onFiles(e.target.files); e.target.value = ''; }}/>
      <Button kind="primary" icon="check" onClick={() => ref.current && ref.current.click()} disabled={busy}>{busy ? 'Reading statement…' : 'Upload statement & verify'}</Button>
      <Modal open={!!pinAsk} onClose={() => setPinAsk(null)} title="This statement was uploaded before" width={440}
        footer={<><Button kind="ghost" onClick={() => setPinAsk(null)}>Cancel</Button><Button kind="primary" icon="lock" onClick={() => {
          if (window.__safiOwnerPin && String(rPin) !== String(window.__safiOwnerPin)) { toast('Wrong Management PIN', 'error'); return; }
          const a = pinAsk; setPinAsk(null); runCheck(a.files, a.text, a.fp, true);
        }}>Check again</Button></>}>
        {pinAsk && <div className="safi-form">
          <p className="safi-cell-sub" style={{ margin: 0 }}><b>{pinAsk.seen.name}</b> was first uploaded {pinAsk.seen.first}{pinAsk.seen.times > 1 ? ` and checked ${pinAsk.seen.times} times` : ''}. Checking it again refreshes the statement amounts on verified payments.</p>
          <MgmtPinField value={rPin} onChange={setRPin}/>
        </div>}
      </Modal>
      <Modal open={!!report} onClose={() => setReport(null)} title="Statement check" width={820}
        footer={<Button kind="primary" onClick={() => setReport(null)}>Done</Button>}>
        {report && <div className="safi-form">
          <p className="safi-cell-sub" style={{ margin: 0 }}>Read {report.files.join(', ')} · {report.words} codes found in the statement.</p>
          {report.again && <div className="safi-callout"><Icon name="lock" size={14}/><span>Repeat upload (approved with PIN). Statement amounts on already-verified payments were refreshed.</span></div>}
          <h4 className="safi-section-h">Verified now ({report.matched.length})</h4>
          {report.matched.length ? <table className="safi-approval-items">{TH}<tbody>{report.matched.map(row)}</tbody></table> : <p className="safi-cell-sub">None new.</p>}
          <h4 className="safi-section-h">Already verified · found on this statement ({report.already.length})</h4>
          {report.already.length ? <table className="safi-approval-items">{TH}<tbody>{report.already.map(row)}</tbody></table> : <p className="safi-cell-sub">None.</p>}
          <h4 className="safi-section-h">Still unverified ({report.missed.length})</h4>
          {report.missed.length ? <table className="safi-approval-items">{TH}<tbody>{report.missed.map(row)}</tbody></table> : <p className="safi-cell-sub">Everything with a code is verified.</p>}
          <p className="safi-hint">Not found usually means the payment is in a different month's statement, the code was typed wrongly, or it went to another account. Cash payments are checked by hand.</p>
        </div>}
      </Modal>
    </>
  );
}

// ─── Payments & Audit ─────────────────────────────────────────────────────
function PaymentsScreen({ lang, money, role }) {
  const D = useStore();
  const isManagement = role === 'owner';
  const [tab, setTab] = useStateFD('all');
  const [form, setForm] = useStateFD({ order: '', method: 'mpesa', amount: '', txn: '', date: SAFI_TIME.day() });

  const [preset, setPreset] = useStateFD(() => { const p = window.__safiPreset; window.__safiPreset = null; return p && p.kind === 'collectedToday' ? p : null; });
  const rows = D.payments.filter(p => (tab === 'all' || p.method === tab) && (!preset || (preset.ids || []).includes(p.order))).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const [pinFor, setPinFor] = useStateFD(null);
  const [vPin, setVPin] = useStateFD('');

  const totalsByMethod = ['mpesa', 'bank'].map(m => ({
    m, total: D.payments.filter(p => p.method === m).reduce((s, p) => s + p.amount, 0),
    count: D.payments.filter(p => p.method === m).length,
  }));
  const unverifiedCount = D.payments.filter(p => !p.verified).length;

  function submit() {
    if (!form.order || !form.amount) { toast('Order # and amount required', 'error'); return; }
    if (String(form.txn || '').trim().length < 5) { toast('Transaction code needs at least 5 characters (ideally the last 5)', 'error'); return; }
    const order = D.orders.find(o => o.id === form.order) || D.orders.find(o => orderNo(o.id) === form.order);
    if (!order) { toast(`Order ${form.order} not found`, 'error'); return; }
    const cust = D.customers.find(c => c.id === order.customer);
    window.SAFI_STORE.recordPayment({
      orderId: order.id, method: form.method,
      amount: parseFloat(form.amount), txn: form.txn,
      customer: cust?.name || form.order,
    });
    toast('Payment recorded', 'success');
    setForm({ order: '', method: 'mpesa', amount: '', txn: '', date: SAFI_TIME.day() });
  }

  return (
    <>
      <Topbar
        title={t('nav_payments', lang)}
        subtitle={isManagement
          ? "Verify staff entries against M-Pesa & bank statements. Reconciliation is a Management responsibility."
          : "Record payments and transaction codes. Management will verify them against statements."}
        right={<>
          {isManagement && <Button kind="ghost" icon="print" onClick={() => window.print()}>{t('print_summary', lang)}</Button>}
          {isManagement && <ReconcilePeriod/>}
          {isManagement && <StatementReconcile/>}
        </>}
      />
      {preset && <div className="safi-preset"><Icon name="income" size={14}/><span>Showing: <b>{preset.label}</b> · {(preset.ids || []).length} order{(preset.ids || []).length === 1 ? '' : 's'} · {rows.length} payment{rows.length === 1 ? '' : 's'} · {money(rows.reduce((s, p) => s + (p.amount || 0), 0))}</span><button className="safi-rowlink" onClick={() => setPreset(null)}>Show all payments</button></div>}

      <div className="safi-grid safi-grid--4">
        {/* M-Pesa / bank totals: Management only, so the till doesn't show total takings. */}
        {isManagement && totalsByMethod.map(({ m, total, count }) => (
          <div key={m} className={`safi-stat safi-stat--method safi-stat--${m}`}>
            <div className="safi-stat__top">
              <div className="safi-stat__label">{m === 'mpesa' ? 'M-Pesa' : m === 'cash' ? 'Cash' : 'Bank transfer'}</div>
              <Icon name={m === 'mpesa' ? 'mpesa' : 'wallet'} size={16}/>
            </div>
            <div className="safi-stat__value">{money(total)}</div>
            <div className="safi-stat__delta">{count} transactions</div>
          </div>
        ))}
        <div className="safi-stat safi-stat--accent">
          <div className="safi-stat__top"><div className="safi-stat__label">Unverified</div><Icon name="alert" size={16}/></div>
          <div className="safi-stat__value">{unverifiedCount}</div>
          <div className="safi-stat__delta safi-stat__delta--down">{unverifiedCount === 0 ? 'All good' : 'Needs audit'}</div>
        </div>
      </div>

      <Card title={isManagement ? 'Enter / verify transaction code' : 'Add transaction code'} action={<span className="safi-cell-sub">For monthly audit · {isManagement ? 'verifies on save' : 'awaits Management verification'}</span>}>
        <div className="safi-txn-form">
          <div className="safi-txn-form__group">
            <label>Order #</label>
            <OrderPicker D={D} value={form.order} onPick={(o) => setForm({ ...form, order: o ? o.id : '', amount: o && !form.amount ? String(Math.max(0, (o.total || 0) - (o.paid || 0))) : form.amount })}/>
          </div>
          <div className="safi-txn-form__group">
            <label>Method</label>
            <div className="safi-seg">
              {['mpesa', 'bank'].map(m => <button key={m} className={`safi-seg__btn ${form.method === m ? 'is-active' : ''}`} onClick={() => setForm({ ...form, method: m })}>{m === 'mpesa' ? 'M-Pesa' : m === 'bank' ? 'Bank' : 'Cash'}</button>)}
            </div>
          </div>
          <div className="safi-txn-form__group">
            <label>Transaction code (min. 5)</label>
            <input className={`safi-input safi-mono ${form.txn && form.txn.length < 5 ? 'is-error' : ''}`} maxLength={20} placeholder="Last 5, e.g. KL2M9" value={form.txn} onChange={e => setForm({ ...form, txn: e.target.value.toUpperCase().replace(/\s/g, '') })}/>
          </div>
          <div className="safi-txn-form__group">
            <label>Amount</label>
            <input className="safi-input safi-mono" placeholder="2,280" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}/>
          </div>
          <div className="safi-txn-form__group">
            <label>Date received</label>
            <input type="date" className="safi-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}/>
          </div>
          <Button kind="primary" icon="check" onClick={submit}>{t('verify', lang)} & save</Button>
        </div>
      </Card>

      <Card pad={false} title="Transaction ledger" action={
        <div className="safi-tabs">
          {['all', 'mpesa', 'bank'].map(x => (
            <button key={x} className={`safi-tabs__btn ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>{x === 'all' ? 'All' : x === 'mpesa' ? 'M-Pesa' : x === 'cash' ? 'Cash' : 'Bank'}</button>
          ))}
        </div>
      }>
        <Table
          cols={[
            { label: 'Date', render: r => <span className="safi-cell-sub">{dm(r.date)}</span> },
            { label: 'Order #', render: r => <span className="safi-mono safi-cell-strong">{orderNo(r.order)}</span> },
            { label: 'Customer', render: r => r.customer || '—' },
            { label: 'Method', render: r => <MethodBadge method={r.method}/> },
            { label: 'Amount', render: r => <span className="safi-mono safi-cell-strong">{money(r.amount)}</span> },
            { label: 'Txn code', render: r => r.txn ? <span className="safi-mono">{r.txn}</span> : <span className="safi-cell-sub">—</span> },
            { label: 'Status', render: r => r.verified ? <span className="safi-pill safi-pill--green"><Icon name="check" size={10}/> {t('verified', lang)}</span> : <span className="safi-pill safi-pill--amber">⚠ {t('unverified', lang)}</span> },
            { label: '', render: r => {
                if (!r.verified) return isManagement
                  ? <button className="safi-rowlink" onClick={() => { setVPin(''); setPinFor(r); }}>{t('verify', lang)} →</button>
                  : <span className="safi-cell-sub" title="Only Management can verify payments">🔒 Mgmt</span>;
                if (r.stmtAmount == null) return <span title={r.verifiedBy === 'manual' ? 'Verified manually (PIN)' : 'Verified'}><span className="safi-tick safi-tick--full safi-vtick"><svg viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 6.4l2.3 2.3 4.7-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></span></span>;
                const d = Math.round(r.stmtAmount - r.amount);
                if (d === 0) return <span title={`Statement KES ${r.stmtAmount.toLocaleString()}`}><span className="safi-tick safi-tick--full safi-vtick"><svg viewBox="0 0 12 12" width="12" height="12"><path d="M2.5 6.4l2.3 2.3 4.7-5" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg></span></span>;
                return <span className={`safi-vres safi-vres--${d > 0 ? 'up' : 'down'}`} title={`Statement shows KES ${r.stmtAmount.toLocaleString()}`}>{d > 0 ? '+' : '−'}{Math.abs(d).toLocaleString()}</span>;
              } },
          ]}
          rows={rows}
          empty="No payments yet."
        />
      </Card>

      {preset ? (() => {
        const sum = (m) => rows.filter(r => !m || r.method === m).reduce((s, r) => s + (r.amount || 0), 0);
        const cnt = (m) => rows.filter(r => !m || r.method === m).length;
        return (
          <Card title="Collected today" action={<span className="safi-cell-sub">Payments on orders delivered / collected today</span>}>
            <div className="safi-diffsum">
              <div className="safi-diffsum__t is-up"><span>Total collected</span><b className="safi-mono">{money(sum())}</b><span className="safi-cell-sub">{cnt()} payment{cnt() === 1 ? '' : 's'}</span></div>
              <div className="safi-diffsum__t"><span>Bank</span><b className="safi-mono">{money(sum('bank'))}</b><span className="safi-cell-sub">{cnt('bank')} payment{cnt('bank') === 1 ? '' : 's'}</span></div>
              <div className="safi-diffsum__t"><span>M-Pesa</span><b className="safi-mono">{money(sum('mpesa'))}</b><span className="safi-cell-sub">{cnt('mpesa')} payment{cnt('mpesa') === 1 ? '' : 's'}</span></div>
            </div>
          </Card>
        );
      })() : (() => {
        const diffs = rows.filter(r => r.verified && r.stmtAmount != null).map(r => ({ r, d: Math.round(r.stmtAmount - r.amount) }));
        const short = diffs.filter(x => x.d < 0), over = diffs.filter(x => x.d > 0), exact = diffs.filter(x => x.d === 0);
        const sumS = short.reduce((s, x) => s + x.d, 0), sumO = over.reduce((s, x) => s + x.d, 0);
        return (
          <Card title="Statement differences" action={<span className="safi-cell-sub">Verified payments in this list · statement minus recorded</span>}>
            <div className="safi-diffsum">
              <div className="safi-diffsum__t is-down"><span>Short-paid (−)</span><b className="safi-mono">−{Math.abs(sumS).toLocaleString()}</b><span className="safi-cell-sub">{short.length} payment{short.length === 1 ? '' : 's'}</span></div>
              <div className="safi-diffsum__t is-up"><span>Over-paid (+)</span><b className="safi-mono">+{sumO.toLocaleString()}</b><span className="safi-cell-sub">{over.length} payment{over.length === 1 ? '' : 's'}</span></div>
              <div className="safi-diffsum__t"><span>Net difference</span><b className="safi-mono">{sumS + sumO > 0 ? '+' : sumS + sumO < 0 ? '−' : ''}{Math.abs(sumS + sumO).toLocaleString()}</b><span className="safi-cell-sub">{exact.length} matched exactly</span></div>
            </div>
          </Card>
        );
      })()}

      <Modal open={!!pinFor} onClose={() => setPinFor(null)} title={pinFor ? `Verify manually · ${orderNo(pinFor.order)}` : ''} width={420}
        footer={<>
          <Button kind="ghost" onClick={() => setPinFor(null)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={() => {
            if (String(vPin) !== String(window.__safiOwnerPin || '')) { toast('Wrong Management PIN', 'error'); return; }
            window.SAFI_STORE.verifyPayment(pinFor.id, { manual: true });
            toast('Verified'); setPinFor(null);
          }}>Verify</Button>
        </>}>
        {pinFor && <div className="safi-form">
          <p className="safi-cell-sub" style={{ margin: 0 }}>{pinFor.customer} · {pinFor.method === 'bank' ? 'Bank' : 'M-Pesa'} · KES {Number(pinFor.amount).toLocaleString()} · code {pinFor.txn}</p>
          <p className="safi-cell-sub" style={{ margin: 0 }}>Verifying without a statement. Confirm you have checked this code yourself.</p>
          <MgmtPinField value={vPin} onChange={setVPin}/>
        </div>}
      </Modal>
    </>
  );
}

// ─── Packages & Discounts ─────────────────────────────────────────────────
function PackagesScreen({ lang, money, role }) {
  const canEdit = role !== 'frontdesk';
  const D = useStore();
  const [showAdd, setShowAdd] = useStateFD(false);
  const [pkg, setPkg] = useStateFD({ name: '', target: 'normal', period: 'month', price: '', includes: '' });

  function submit() {
    if (!pkg.name || !pkg.price) { toast('Name and price required', 'error'); return; }
    window.SAFI_STORE.addPackage({ ...pkg, price: parseFloat(pkg.price) });
    toast(`${pkg.name} added`, 'success');
    setPkg({ name: '', target: 'normal', period: 'month', price: '', includes: '' });
    setShowAdd(false);
  }

  return (
    <>
      <Topbar
        title={t('nav_packages', lang)}
        subtitle={canEdit ? 'Subscription bundles for students, families, and corporate clients.' : 'Packages set by management. Ask management to add or change one.'}
        right={canEdit ? <>
          <Button kind="primary" icon="plus" onClick={() => setShowAdd(true)}>New package</Button>
        </> : null}
      />

      <div className="safi-grid safi-grid--3">
        {D.packages.filter(p => canEdit || p.active).map(p => (
          <div key={p.id} className={`safi-pkg ${!p.active ? 'is-inactive' : ''}`}>
            <div className="safi-pkg__hd">
              <span className={`safi-pkg__period safi-pkg__period--${p.period}`}>{p.period.toUpperCase()}</span>
              <GroupBadge group={p.target}/>
            </div>
            <h3 className="safi-pkg__name">{p.name}</h3>
            <div className="safi-pkg__price"><span className="safi-mono">{money(p.price)}</span><span className="safi-pkg__per">/ {p.period}</span></div>
            <p className="safi-pkg__inc">{p.includes}</p>
            <div className="safi-pkg__foot">
              <span>{p.subscribers || 0} subscribers</span>
              {canEdit && <button className="safi-pkg__edit" onClick={() => window.SAFI_STORE.updatePackage(p.id, { active: !p.active })}>{p.active ? 'Pause →' : 'Activate →'}</button>}
            </div>
          </div>
        ))}
        {canEdit && <div className="safi-pkg safi-pkg--add" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={28}/>
          <span>Create a new package</span>
          <p>Bundle services for repeat customers — monthly, weekly, or one-off.</p>
        </div>}
      </div>

      <Card title={canEdit ? "Discount codes" : "Active discount codes"} action={<span className="safi-cell-sub">{canEdit ? "Switch a code on to let Front Desk pick it in New Order" : "Pick a code in New Order → Summary → Discount"}</span>}>
        <Table
          cols={[
            { label: 'Name', render: r => <b>{r.name}</b> },
            { label: 'Code', render: r => <span className="safi-mono safi-tag safi-tag--blue">{r.code}</span> },
            { label: 'Value', render: r => <b>{r.type === 'pct' ? `-${r.value}%` : `-${money(r.value)}`}</b> },
            { label: 'Expires', render: r => r.expires },
            { label: 'Times used', render: r => r.uses || 0 },
            { label: 'Status', render: r => canEdit
              ? <label className="safi-toggle"><input type="checkbox" checked={r.active !== false} onChange={e => { window.SAFI_STORE.setDiscountActive(r.id, e.target.checked); toast(`${r.code} ${e.target.checked ? 'on' : 'off'}`); }}/><span/><b>{r.active !== false ? 'On' : 'Off'}</b></label>
              : <span className={`safi-pill safi-pill--${r.active !== false ? 'green' : 'gray'}`}>{r.active !== false ? 'On' : 'Off'}</span> },
          ]}
          rows={canEdit ? D.discounts : (D.discounts || []).filter(x => x.active !== false)}
          empty="No discounts."
        />
      </Card>

      <Modal open={canEdit && showAdd} onClose={() => setShowAdd(false)} title="New package"
        footer={<>
          <Button kind="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          <Button kind="primary" icon="check" onClick={submit}>Create package</Button>
        </>}>
        <div className="safi-form">
          <label>Name<input className="safi-input" value={pkg.name} onChange={e => setPkg({ ...pkg, name: e.target.value })} placeholder="e.g. Hostel Weekly"/></label>
          <label>Target tier
            <div className="safi-seg">
              {['student', 'normal', 'corporate'].map(g => (
                <button key={g} className={`safi-seg__btn ${pkg.target === g ? 'is-active' : ''}`} onClick={() => setPkg({ ...pkg, target: g })}>{g[0].toUpperCase() + g.slice(1)}</button>
              ))}
            </div>
          </label>
          <label>Period
            <div className="safi-seg">
              {['week', 'month'].map(p => (
                <button key={p} className={`safi-seg__btn ${pkg.period === p ? 'is-active' : ''}`} onClick={() => setPkg({ ...pkg, period: p })}>{p[0].toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
          </label>
          <label>Price (KES)<input type="number" className="safi-input safi-mono" value={pkg.price} onChange={e => setPkg({ ...pkg, price: e.target.value })}/></label>
          <label>What's included<input className="safi-input" value={pkg.includes} onChange={e => setPkg({ ...pkg, includes: e.target.value })} placeholder="e.g. 15 kg wash & fold"/></label>
        </div>
      </Modal>
    </>
  );
}

// ─── Issues board ─────────────────────────────────────────────────────────
function IssuesScreen({ lang }) {
  const D = useStore();
  const [tab, setTab] = useStateFD('all');
  const [form, setForm] = useStateFD({ subject: '', order: '', priority: 'medium', details: '' });

  const rows = D.issues.filter(i => tab === 'all' || i.status === tab);
  const counts = ['open', 'in-review', 'resolved'].map(s => ({ s, n: D.issues.filter(i => i.status === s).length }));

  function submit() {
    if (!form.subject.trim()) { toast('Subject required', 'error'); return; }
    window.SAFI_STORE.addIssue(form);
    toast('Issue raised', 'success');
    setForm({ subject: '', order: '', priority: 'medium', details: '' });
  }

  return (
    <>
      <Topbar
        title={t('nav_issues', lang)}
        subtitle="Raise & track problems — customer complaints, equipment, missing items."
      />

      <div className="safi-grid safi-grid--3">
        {counts.map(({ s, n }) => (
          <div key={s} className={`safi-stat safi-stat--issue safi-stat--${s}`}>
            <div className="safi-stat__label">{s.replace('-', ' ')}</div>
            <div className="safi-stat__value">{n}</div>
          </div>
        ))}
      </div>

      <Card title="Raise an issue">
        <div className="safi-issue-form">
          <div className="safi-issue-form__group safi-issue-form__group--wide">
            <label>{t('subject', lang)}</label>
            <input className="safi-input" placeholder="What happened?" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}/>
          </div>
          <div className="safi-issue-form__group">
            <label>Related order (optional)</label>
            <OrderPicker D={D} value={form.order} onPick={(o) => setForm({ ...form, order: o ? o.id : '', amount: o && !form.amount ? String(Math.max(0, (o.total || 0) - (o.paid || 0))) : form.amount })}/>
          </div>
          <div className="safi-issue-form__group">
            <label>{t('priority', lang)}</label>
            <div className="safi-seg">
              {['low', 'medium', 'high'].map(p => (
                <button key={p} className={`safi-seg__btn ${form.priority === p ? 'is-active' : ''}`} onClick={() => setForm({ ...form, priority: p })}>{p[0].toUpperCase() + p.slice(1)}</button>
              ))}
            </div>
          </div>
          <div className="safi-issue-form__group safi-issue-form__group--wide">
            <label>Details</label>
            <textarea className="safi-textarea" placeholder="Describe the issue, expected outcome, customer reaction…" value={form.details} onChange={e => setForm({ ...form, details: e.target.value })}/>
          </div>
          <Button kind="primary" icon="alert" onClick={submit}>Submit issue</Button>
        </div>
      </Card>

      <Card pad={false} title="All issues" action={
        <div className="safi-tabs">
          {['all', 'open', 'in-review', 'resolved'].map(x => (
            <button key={x} className={`safi-tabs__btn ${tab === x ? 'is-active' : ''}`} onClick={() => setTab(x)}>{x === 'all' ? 'All' : x}</button>
          ))}
        </div>
      }>
        <Table
          cols={[
            { label: 'Date', render: r => <span className="safi-cell-sub">{dmy(r.date)}</span> },
            { label: 'Subject', render: r => <b>{r.subject}</b> },
            { label: 'Raised by', render: r => r.raisedBy },
            { label: 'Order', render: r => r.order ? <span className="safi-mono">{orderNo(r.order)}</span> : <span className="safi-cell-sub">—</span> },
            { label: 'Priority', render: r => <span className={`safi-tag safi-tag--${r.priority === 'high' ? 'red' : r.priority === 'medium' ? 'amber' : 'gray'}`}>{r.priority}</span> },
            { label: 'Status', render: r => <span className={`safi-pill safi-pill--${r.status === 'open' ? 'red' : r.status === 'in-review' ? 'amber' : 'green'}`}><span className="safi-pill__dot"/>{r.status}</span> },
            { label: '', render: r => (
              <select className="safi-mini-select" value={r.status} onChange={e => { window.SAFI_STORE.updateIssue(r.id, { status: e.target.value }); toast('Status updated'); }}>
                <option value="open">Open</option>
                <option value="in-review">In review</option>
                <option value="resolved">Resolved</option>
              </select>
            )},
          ]}
          rows={rows}
          empty="No issues raised."
        />
      </Card>
    </>
  );
}

// ─── Shift open / close ────────────────────────────────────────
// Counting the drawer at a known moment is what makes cash checkable at all. Framed as
// handover, because that is what it is — the attendant signs for the float and signs it
// back out. The comparison against expected happens out of sight.
function ShiftModal({ open, onClose, money }) {
  const D = useStore();
  const sh = window.SAFI_STORE.getOpenShift();
  const [float_, setFloat] = useStateFD(0);
  const [counted, setCounted] = useStateFD('');
  const [note, setNote] = useStateFD('');

  useEffectFD(() => { if (open) { setFloat(0); setCounted(''); setNote(''); } }, [open]);

  const staff = window.SAFI_STORE.getCurrentStaff();

  if (sh) {
    return (
      <Modal open={open} onClose={onClose} title="Close shift" width={420}
        footer={<>
          <Button kind="ghost" onClick={onClose}>Cancel</Button>
          <Button kind="primary" icon="check" disabled={counted === ''} onClick={() => {
            window.SAFI_STORE.closeShift({ declaredCash: Number(counted) || 0, note });
            toast('Shift closed', 'success');
            if ((window.SAFI_STORE.get().settings || {}).lockEnabled && window.safiLock) setTimeout(() => window.safiLock('Shift closed'), 600);
            onClose();
          }}>Close shift</Button>
        </>}>
        <div className="safi-form">
          <div className="safi-mini-cust__row"><span>Attendant</span><b>{(D.staff.find(s => s.id === sh.staff) || staff).name}</b></div>
          <div className="safi-mini-cust__row"><span>Opened</span><b>{sh.openedAtLabel}</b></div>
          <div className="safi-mini-cust__row"><span>Opening float</span><b className="safi-mono">{money(sh.openingFloat)}</b></div>
          <label>Cash counted in the drawer now
            <input className="safi-input safi-mono" inputMode="numeric" value={counted} placeholder="0"
              autoFocus onChange={e => setCounted(e.target.value.replace(/[^\d]/g, ''))}/>
          </label>
          <label>Note (optional)
            <input className="safi-input" value={note} placeholder="Anything unusual today"
              onChange={e => setNote(e.target.value)}/>
          </label>
          <p className="safi-hint">Count the notes and coins and enter the figure. Do not work it out from the orders.</p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Open shift" width={400}
      footer={<>
        <Button kind="ghost" onClick={onClose}>Cancel</Button>
        <Button kind="primary" icon="check" onClick={() => {
          window.SAFI_STORE.openShift({ openingFloat: Number(float_) || 0 });
          toast('Shift open — karibu', 'success');
          onClose();
        }}>Open shift</Button>
      </>}>
      <div className="safi-form">
        <div className="safi-mini-cust__row"><span>Attendant</span><b>{staff.name}</b></div>
        <label>Opening float in the drawer
          <input className="safi-input safi-mono" inputMode="numeric" value={float_} autoFocus
            onChange={e => setFloat(e.target.value.replace(/[^\d]/g, ''))}/>
        </label>
        <p className="safi-hint">Count the float before the first customer. You will count again at close.</p>
      </div>
    </Modal>
  );
}

Object.assign(window, { FrontDeskDashboard, NewOrder, OrdersQueue, OrderDetail, Receipt, CustomersScreen, PaymentsScreen, PackagesScreen, IssuesScreen, AddCustomerModal, PaymentModal, ShiftModal });
